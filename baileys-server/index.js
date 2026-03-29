'use strict';

// Polyfill para globalThis.crypto (necessário para pkg + Node 18 + Baileys)
if (!globalThis.crypto) {
  const { webcrypto } = require('node:crypto');
  globalThis.crypto = webcrypto;
}

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const scheduler = require('./scheduler');
const iaEngine = require('./ia-engine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json({ limit: '100mb' }));
// Timeout global de 60s para rotas de grupos (podem ser lentas com muitos grupos)
app.use((req, res, next) => {
  res.setTimeout(60000, () => {
    if (!res.headersSent) res.status(503).json({ ok: false, error: 'Timeout' });
  });
  next();
});

const PORT = 3001;

// Diretório de dados:
// - DISPARA_DATA_DIR: variável de ambiente (setada pelo Tauri ou pelo usuário)
// - process.pkg: empacotado com @yao-pkg/pkg → ao lado do .exe
// - fallback: baileys-server/dispara-zapp-data/ (dev direto via node)
let DATA_DIR;
if (process.env.DISPARA_DATA_DIR) {
  DATA_DIR = process.env.DISPARA_DATA_DIR;
} else if (process.pkg) {
  DATA_DIR = path.join(path.dirname(process.execPath), 'dispara-zapp-data');
} else {
  DATA_DIR = path.join(__dirname, 'dispara-zapp-data');
}
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const BLACKLIST_FILE = path.join(DATA_DIR, 'blacklist.json');

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── Estado global ────────────────────────────────────────────────────────────
const sessions = {}; // sessionId -> { sock, store, status, qr, pairingCode }
const sendStats = {}; // sessionId -> { sent, failed, total, startTime }
const bulkPaused = {}; // sessionId -> boolean
const bulkReports = {}; // sessionId -> [{ number, status, error, ts }]
const qrAttempts = {}; // sessionId -> number (quantas vezes gerou QR sem conectar)

// ─── Blacklist ────────────────────────────────────────────────────────────────
function loadBlacklist() {
  try { return new Set(JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'))); } catch { return new Set(); }
}
function saveBlacklist(set) {
  fs.writeFileSync(BLACKLIST_FILE, JSON.stringify([...set]), 'utf8');
}
let blacklist = loadBlacklist();

// chatStore: sessionId -> Map<jid, ChatEntry>
const chatStore = {};
// messageStore: sessionId -> Map<jid, Message[]> (últimas 50 mensagens por conversa)
const messageStore = {};

// ─── WebSocket broadcast ──────────────────────────────────────────────────────
function broadcast(event, data) {
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// ─── Criar / reconectar sessão ────────────────────────────────────────────────
async function createSession(sessionId) {
  const sessionPath = path.join(SESSIONS_DIR, sessionId);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    let version;
    try {
      const result = await fetchLatestBaileysVersion();
      version = result.version;
    } catch {
      version = [2, 3000, 1015901307];
    }

    console.log(`[${sessionId}] Iniciando com versão WA: ${version}`);

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: ['Dispara Zapp', 'Chrome', '120.0.0'],
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
    });

    sessions[sessionId] = { sock, status: 'connecting', qr: null, pairingCode: null };
    broadcast('connection', { sessionId, status: 'connecting' });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await qrcode.toDataURL(qr);
          if (sessions[sessionId]) {
            sessions[sessionId].qr = qrDataUrl;
            sessions[sessionId].status = 'qr';
          }
          // Incrementa contador de QRs gerados sem scan
          qrAttempts[sessionId] = (qrAttempts[sessionId] || 0) + 1;
          broadcast('qr', { sessionId, qr: qrDataUrl, attempt: qrAttempts[sessionId] });
          console.log(`[${sessionId}] QR gerado (tentativa ${qrAttempts[sessionId]})`);
        } catch (e) {
          console.error(`[${sessionId}] Erro ao gerar QR:`, e.message);
        }
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = code === DisconnectReason.loggedOut;

        // QR expirou sem ser escaneado (408) ou conexão caiu durante QR
        const qrExpired = sessions[sessionId]?.status === 'qr';
        const attempts = qrAttempts[sessionId] || 0;
        const MAX_QR_ATTEMPTS = 3; // para de reconectar após 3 QRs ignorados

        console.log(`[${sessionId}] Fechou - code: ${code}, qrExpired: ${qrExpired}, attempts: ${attempts}`);

        if (sessions[sessionId]) {
          sessions[sessionId].status = 'disconnected';
          sessions[sessionId].qr = null;
        }

        if (isLoggedOut) {
          // Deslogado explicitamente — limpa sessão, não reconecta
          broadcast('connection', { sessionId, status: 'disconnected', code, reason: 'logged_out' });
          delete sessions[sessionId];
          delete qrAttempts[sessionId];
          return;
        }

        // 408 sem QR = sessão rejeitada pelo WhatsApp (deslogada remotamente)
        // Não reconecta automaticamente — usuário precisa escanear QR novamente
        if (code === 408 && !qrExpired) {
          broadcast('connection', { sessionId, status: 'disconnected', code, reason: 'logged_out' });
          delete sessions[sessionId];
          delete qrAttempts[sessionId];
          console.log(`[${sessionId}] Sessão rejeitada pelo WhatsApp (408 sem QR) — precisa reconectar`);
          return;
        }

        if (qrExpired && attempts >= MAX_QR_ATTEMPTS) {
          // Muitos QRs ignorados — para o loop, aguarda ação do usuário
          broadcast('connection', { sessionId, status: 'disconnected', code, reason: 'qr_timeout' });
          delete qrAttempts[sessionId];
          // Marca a sessão como "aguardando usuário" para não reconectar no próximo boot
          const sessionPath = path.join(SESSIONS_DIR, sessionId);
          fs.writeFileSync(path.join(sessionPath, '.qr_timeout'), '', 'utf8');
          console.log(`[${sessionId}] Parou reconexão automática após ${attempts} QRs não escaneados`);
          return;
        }

        // Reconexão normal (queda de rede, etc.)
        broadcast('connection', { sessionId, status: 'disconnected', code });
        const delay = qrExpired ? 1000 : 3000;
        setTimeout(() => createSession(sessionId), delay);
      }

      if (connection === 'open') {
        if (sessions[sessionId]) {
          sessions[sessionId].status = 'connected';
          sessions[sessionId].qr = null;
        }
        // Conectou com sucesso — zera contador de tentativas
        delete qrAttempts[sessionId];
        broadcast('connection', { sessionId, status: 'connected', user: sock.user });

        // Limpeza de sender-keys antigas (> 30 dias) para evitar acúmulo de arquivos
        try {
          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          const files = fs.readdirSync(sessionPath);
          let removed = 0;
          for (const f of files) {
            if (!f.startsWith('sender-key-')) continue;
            const fp = path.join(sessionPath, f);
            const stat = fs.statSync(fp);
            if (stat.mtimeMs < cutoff) { fs.rmSync(fp); removed++; }
          }
          if (removed > 0) console.log(`[${sessionId}] Limpeza: ${removed} sender-keys antigas removidas`);
        } catch (_) {}
        console.log(`[${sessionId}] Conectado como: ${sock.user?.id}`);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type === 'notify') {
        messages.forEach((msg) => {
          // ─── Atualiza chatStore ───────────────────────────────────────────
          const jid = msg.key?.remoteJid;
          if (jid) {
            if (!chatStore[sessionId]) chatStore[sessionId] = new Map();
            const text = msg.message?.conversation
              || msg.message?.extendedTextMessage?.text
              || msg.message?.imageMessage?.caption
              || msg.message?.videoMessage?.caption
              || '[mídia]';
            const isFromMe = !!msg.key?.fromMe;
            const senderName = isFromMe
              ? (sock.user?.name || 'Você')
              : (msg.pushName || jid.replace('@s.whatsapp.net', '').replace('@g.us', ''));
            const existing = chatStore[sessionId].get(jid) || { unread: 0 };
            chatStore[sessionId].set(jid, {
              jid,
              name: existing.name || senderName,
              lastMessage: text,
              lastMessageTs: (msg.messageTimestamp || Date.now() / 1000) * 1000,
              unread: isFromMe ? (existing.unread || 0) : (existing.unread || 0) + 1,
              isGroup: jid.endsWith('@g.us'),
            });

            // Armazena mensagem no messageStore (máx 50 por conversa)
            if (!messageStore[sessionId]) messageStore[sessionId] = new Map();
            const msgs = messageStore[sessionId].get(jid) || [];
            msgs.push({
              id: msg.key?.id || Date.now().toString(),
              fromMe: isFromMe,
              text,
              ts: (msg.messageTimestamp || Date.now() / 1000) * 1000,
              senderName: isFromMe ? (sock.user?.name || 'Você') : senderName,
            });
            if (msgs.length > 50) msgs.splice(0, msgs.length - 50);
            messageStore[sessionId].set(jid, msgs);

            broadcast('chat_updated', { sessionId, jid });
          }
          if (!msg.key?.fromMe) {
            broadcast('message', { sessionId, message: msg });
            processAutoReply(sessionId, msg).catch(console.error);
            processIAReply(sessionId, msg).catch(console.error);
          }
        });
      }
    });

    return sessions[sessionId];

  } catch (err) {
    console.error(`[${sessionId}] Erro ao criar sessão:`, err);
    broadcast('connection', { sessionId, status: 'disconnected', error: err.message });
    throw err;
  }
}

// ─── Pairing Code ─────────────────────────────────────────────────────────────
async function requestPairingCode(sessionId, phoneNumber) {
  const session = sessions[sessionId];
  if (!session) throw new Error('Sessão não encontrada');
  const code = await session.sock.requestPairingCode(phoneNumber);
  sessions[sessionId].pairingCode = code;
  broadcast('pairing_code', { sessionId, code });
  return code;
}

// ─── Delay aleatório anti-ban ─────────────────────────────────────────────────
function randomDelay(min = 1200, max = 3500) {
  return new Promise((r) => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function formatPhone(number) {
  const clean = number.replace(/\D/g, '');
  return clean.includes('@') ? clean : `${clean}@s.whatsapp.net`;
}

// ─── Rotas REST ───────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => res.json({ ok: true, version: '1.0.0' }));

// Listar chats recebidos — usa chatStore em memória (populado por messages.upsert)
app.get('/sessions/:id/chats', (req, res) => {
  const { id } = req.params;
  const session = sessions[id];
  if (!session || session.status !== 'connected') {
    return res.json({ ok: true, chats: [] });
  }

  const map = chatStore[id];
  const chats = map
    ? Array.from(map.values()).sort((a, b) => b.lastMessageTs - a.lastMessageTs)
    : [];

  res.json({ ok: true, chats });
});

// Marcar conversa como lida (zera unread no chatStore)
app.post('/sessions/:id/chats/:jid/read', (req, res) => {
  const { id, jid } = req.params;
  const decoded = decodeURIComponent(jid);
  if (chatStore[id]?.has(decoded)) {
    chatStore[id].get(decoded).unread = 0;
  }
  res.json({ ok: true });
});

// Mensagens de uma conversa
app.get('/sessions/:id/chats/:jid/messages', (req, res) => {
  const { id, jid } = req.params;
  const decoded = decodeURIComponent(jid);
  const msgs = messageStore[id]?.get(decoded) || [];
  res.json({ ok: true, messages: msgs });
});

// Listar sessões
app.get('/sessions', (req, res) => {
  const list = Object.entries(sessions).map(([id, s]) => ({
    id,
    status: s.status,
    user: s.sock?.user || null,
    qr: s.qr,
    pairingCode: s.pairingCode,
  }));
  res.json(list);
});

// Criar sessão
app.post('/sessions/:id/connect', async (req, res) => {
  try {
    const { id } = req.params;
    if (sessions[id]) return res.json({ ok: true, status: sessions[id].status });
    // Remove flag de qr_timeout para permitir nova tentativa
    const timeoutFlag = path.join(SESSIONS_DIR, id, '.qr_timeout');
    if (fs.existsSync(timeoutFlag)) fs.rmSync(timeoutFlag);
    await createSession(id);
    res.json({ ok: true, status: 'connecting' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Desconectar sessão
app.post('/sessions/:id/disconnect', async (req, res) => {
  try {
    const { id } = req.params;
    if (sessions[id]) {
      await sessions[id].sock.logout();
      delete sessions[id];
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Limpar dados de conexão da sessão (factory reset)
app.delete('/sessions/:id/data', async (req, res) => {
  try {
    const { id } = req.params;
    // Para a sessão se estiver ativa
    if (sessions[id]) {
      try { await sessions[id].sock.logout(); } catch (_) {}
      delete sessions[id];
    }
    // Apaga todos os arquivos da pasta da sessão
    const sessionPath = path.join(SESSIONS_DIR, id);
    if (fs.existsSync(sessionPath)) {
      fs.readdirSync(sessionPath).forEach((f) =>
        fs.rmSync(path.join(sessionPath, f), { recursive: true, force: true })
      );
    }
    broadcast('connection', { sessionId: id, status: 'not_found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Solicitar pairing code
app.post('/sessions/:id/pairing-code', async (req, res) => {
  try {
    const { id } = req.params;
    const { phone } = req.body;
    if (!sessions[id]) await createSession(id);
    const code = await requestPairingCode(id, phone);
    res.json({ ok: true, code });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Status de uma sessão
app.get('/sessions/:id/status', (req, res) => {
  const s = sessions[req.params.id];
  if (!s) return res.json({ status: 'not_found' });
  res.json({ status: s.status, user: s.sock?.user || null, qr: s.qr, pairingCode: s.pairingCode });
});

// ─── Envio de mensagem simples ────────────────────────────────────────────────
app.post('/sessions/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const { to, text, media, mediaType, caption, delayMin, delayMax } = req.body;
    const session = sessions[id];
    if (!session || session.status !== 'connected') {
      return res.status(400).json({ ok: false, error: 'Sessão não conectada' });
    }

    const jid = formatPhone(to);
    let message = {};

    if (media) {
      const buffer = Buffer.from(media, 'base64');
      if (mediaType === 'image') {
        message = { image: buffer, caption: caption || '' };
      } else if (mediaType === 'video') {
        message = { video: buffer, caption: caption || '' };
      } else if (mediaType === 'document') {
        message = { document: buffer, mimetype: 'application/pdf', fileName: 'arquivo.pdf', caption: caption || '' };
      } else if (mediaType === 'sticker') {
        message = { sticker: buffer };
      }
    } else {
      message = { text };
    }

    await session.sock.sendMessage(jid, message);

    if (delayMin && delayMax) await randomDelay(delayMin, delayMax);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Disparo em massa ─────────────────────────────────────────────────────────
app.post('/sessions/:id/bulk-send', async (req, res) => {
  const { id } = req.params;
  const { numbers, messages: msgList, text, media, mediaType, caption, options = {} } = req.body;
  const session = sessions[id];

  if (!session || session.status !== 'connected') {
    return res.status(400).json({ ok: false, error: 'Sessão não conectada' });
  }

  // Suporte legado (campo único) e novo formato (array de mensagens)
  const sequence = msgList && msgList.length > 0
    ? msgList
    : [{ text, media, mediaType, caption }];

  const {
    delayMin = 1200, delayMax = 3500, delayMode = 'random',
    progressiveStep = 100, batchSize = 0, batchPause = 60000,
    limitPerHour = 200, simulateTyping = true, typingDuration = 1500,
    markAsRead = false, sendPresence = false,
    retryFailed = true, retryDelay = 5000, maxRetries = 2,
    interMessageDelay = 1000,
  } = options;

  res.json({ ok: true, total: numbers.length, message: 'Disparo iniciado' });

  (async () => {
    bulkPaused[id] = false;
    bulkReports[id] = [];
    sendStats[id] = { total: numbers.length, sent: 0, failed: 0, skipped: 0, startTime: Date.now() };
    const stats = sendStats[id];

    let hourCount = 0;
    let hourStart = Date.now();
    let progressiveDelay = 0;

    for (let i = 0; i < numbers.length; i++) {
      // Aguardar se pausado
      while (bulkPaused[id]) {
        await new Promise((r) => setTimeout(r, 500));
      }

      // Reset limite por hora
      if (Date.now() - hourStart > 3600000) { hourCount = 0; hourStart = Date.now(); }
      if (hourCount >= limitPerHour) {
        const wait = 3600000 - (Date.now() - hourStart);
        broadcast('bulk_paused', { reason: 'limit_per_hour', resumeIn: wait });
        await new Promise((r) => setTimeout(r, wait));
        hourCount = 0; hourStart = Date.now();
      }

      // Pausa entre lotes
      if (batchSize > 0 && i > 0 && i % batchSize === 0) {
        broadcast('bulk_paused', { reason: 'batch_pause', resumeIn: batchPause, batch: Math.floor(i / batchSize) });
        await new Promise((r) => setTimeout(r, batchPause));
      }

      // Suporte a { number, vars } ou string pura
      const entry = typeof numbers[i] === 'object' ? numbers[i] : { number: numbers[i], vars: {} };
      const number = entry.number;
      const vars = entry.vars || {};

      // Blacklist check
      const normalized = number.replace(/\D/g, '');
      if (blacklist.has(normalized)) {
        stats.skipped++;
        bulkReports[id].push({ number, status: 'blacklisted', error: '', ts: new Date().toISOString() });
        broadcast('bulk_progress', { sessionId: id, index: i + 1, total: numbers.length, number, status: 'blacklisted', stats: { ...stats } });
        continue;
      }

      let attempt = 0;
      let success = false;

      while (attempt <= maxRetries && !success) {
        try {
          const jid = formatPhone(number);

          // Presença online (uma vez por número)
          if (sendPresence) await session.sock.sendPresenceUpdate('available', jid);

          // Enviar cada mensagem da sequência
          for (let mi = 0; mi < sequence.length; mi++) {
            let { text: msgText, media: msgMedia, mediaType: msgMediaType, caption: msgCaption } = sequence[mi];

            // Substituir variáveis no texto e legenda
            if (msgText) msgText = substituteVars(msgText, { name: vars.nome || vars.name || '', number, groupName: '', message: '' });
            if (msgCaption) msgCaption = substituteVars(msgCaption, { name: vars.nome || vars.name || '', number, groupName: '', message: '' });
            // Substituir variáveis extras (colunas do CSV)
            for (const [k, v] of Object.entries(vars)) {
              if (msgText) msgText = msgText.replace(new RegExp(`\\{${k}\\}`, 'gi'), v);
              if (msgCaption) msgCaption = msgCaption.replace(new RegExp(`\\{${k}\\}`, 'gi'), v);
            }

            // Simular digitação antes de cada mensagem
            if (simulateTyping) {
              await session.sock.sendPresenceUpdate('composing', jid);
              await new Promise((r) => setTimeout(r, typingDuration));
              await session.sock.sendPresenceUpdate('paused', jid);
            }

            // Montar mensagem
            let message = {};
            if (msgMedia) {
              const buffer = Buffer.from(msgMedia, 'base64');
              if (msgMediaType === 'image') message = { image: buffer, caption: msgCaption || msgText || '' };
              else if (msgMediaType === 'video') message = { video: buffer, caption: msgCaption || msgText || '' };
              else if (msgMediaType === 'document') message = { document: buffer, mimetype: 'application/pdf', fileName: 'arquivo.pdf' };
              else if (msgMediaType === 'sticker') message = { sticker: buffer };
            } else if (msgText) {
              message = { text: msgText };
            } else {
              continue; // pula mensagem vazia
            }

            await session.sock.sendMessage(jid, message);

            // Delay entre mensagens da sequência (exceto após a última)
            if (mi < sequence.length - 1 && interMessageDelay > 0) {
              await new Promise((r) => setTimeout(r, interMessageDelay));
            }
          }

          success = true;
          stats.sent++;
          hourCount++;
          bulkReports[id].push({ number, status: 'sent', error: '', ts: new Date().toISOString() });
          broadcast('bulk_progress', { sessionId: id, index: i + 1, total: numbers.length, number, status: 'sent', stats: { ...stats } });

        } catch (err) {
          attempt++;
          if (attempt <= maxRetries && retryFailed) {
            broadcast('bulk_progress', { sessionId: id, index: i + 1, total: numbers.length, number, status: 'retrying', attempt, stats: { ...stats } });
            await new Promise((r) => setTimeout(r, retryDelay));
          } else {
            stats.failed++;
            bulkReports[id].push({ number, status: 'failed', error: err.message, ts: new Date().toISOString() });
            broadcast('bulk_progress', { sessionId: id, index: i + 1, total: numbers.length, number, status: 'failed', error: err.message, stats: { ...stats } });
          }
        }
      }

      // Delay entre números
      if (i < numbers.length - 1) {
        let delay;
        if (delayMode === 'fixed') {
          delay = delayMin;
        } else if (delayMode === 'progressive') {
          progressiveDelay += progressiveStep;
          delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin + progressiveDelay;
        } else {
          delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
        }
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    broadcast('bulk_done', { sessionId: id, stats: { ...stats } });
  })();
});

// Pause / Resume
app.post('/sessions/:id/bulk-pause', (req, res) => {
  bulkPaused[req.params.id] = true;
  res.json({ ok: true });
});
app.post('/sessions/:id/bulk-resume', (req, res) => {
  bulkPaused[req.params.id] = false;
  res.json({ ok: true });
});

// Per-number report
app.get('/sessions/:id/bulk-report', (req, res) => {
  res.json({ ok: true, report: bulkReports[req.params.id] || [] });
});

// ─── Blacklist ────────────────────────────────────────────────────────────────
app.get('/blacklist', (req, res) => {
  res.json({ ok: true, numbers: [...blacklist] });
});
app.post('/blacklist', (req, res) => {
  const { numbers: nums } = req.body;
  if (!Array.isArray(nums)) return res.status(400).json({ ok: false, error: 'numbers must be array' });
  nums.forEach((n) => blacklist.add(String(n).replace(/\D/g, '')));
  saveBlacklist(blacklist);
  res.json({ ok: true, count: blacklist.size });
});
app.delete('/blacklist/:number', (req, res) => {
  blacklist.delete(req.params.number.replace(/\D/g, ''));
  saveBlacklist(blacklist);
  res.json({ ok: true });
});

// ─── Grupos ───────────────────────────────────────────────────────────────────
// Cache de grupos por sessão: { list: [], ts: number }
const groupsCache = {};
// Controle de refresh em andamento para evitar chamadas paralelas
const groupsRefreshing = {};

function mapGroup(g) {
  return {
    id: g.id, subject: g.subject || g.id || '',
    participantCount: g.participants?.length || 0,
    announce: g.announce || false, restrict: g.restrict || false,
    isCommunity: g.isCommunity || false, isCommunityAnnounce: g.isCommunityAnnounce || false,
    joinApprovalMode: g.joinApprovalMode || false, memberAddMode: g.memberAddMode || false,
  };
}

async function refreshGroupsCache(sessionId) {
  if (groupsRefreshing[sessionId]) return; // já está atualizando
  const session = sessions[sessionId];
  if (!session || session.status !== 'connected') return;
  groupsRefreshing[sessionId] = true;
  try {
    const groups = await session.sock.groupFetchAllParticipating();
    const list = Object.values(groups).map(mapGroup);
    groupsCache[sessionId] = { list, ts: Date.now() };
    broadcast('groups_updated', { sessionId, count: list.length });
    console.log(`[groups] Cache atualizado para ${sessionId}: ${list.length} grupos`);
  } catch (e) {
    console.error(`[groups] Erro ao atualizar cache de ${sessionId}:`, e.message);
  } finally {
    groupsRefreshing[sessionId] = false;
  }
}

app.get('/sessions/:id/groups', (req, res) => {
  const session = sessions[req.params.id];
  if (!session || session.status !== 'connected') {
    return res.status(400).json({ ok: false, error: 'Sessão não conectada' });
  }

  const forceRefresh = req.query.refresh === 'true';
  const cached = groupsCache[req.params.id];
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  // Tem cache válido e não é refresh forçado → retorna imediatamente
  if (cached && !forceRefresh && (Date.now() - cached.ts) < CACHE_TTL) {
    return res.json({ ok: true, groups: cached.list, cached: true });
  }

  // Tem cache (mesmo expirado) → retorna imediatamente e atualiza em background
  if (cached) {
    res.json({ ok: true, groups: cached.list, cached: true, refreshing: !groupsRefreshing[req.params.id] });
    refreshGroupsCache(req.params.id); // não await — background
    return;
  }

  // Sem cache nenhum → precisa buscar agora, mas de forma não-bloqueante via SSE/polling
  // Inicia o refresh e retorna lista vazia com flag loading
  res.json({ ok: true, groups: [], cached: false, loading: true });
  refreshGroupsCache(req.params.id);
});

app.get('/sessions/:id/groups/:groupId/participants', async (req, res) => {
  try {
    const session = sessions[req.params.id];
    if (!session || session.status !== 'connected') {
      return res.status(400).json({ ok: false, error: 'Sessão não conectada' });
    }
    const meta = await session.sock.groupMetadata(req.params.groupId);
    const participants = meta.participants.map((p) => ({
      id: p.id,
      phone: p.id.replace('@s.whatsapp.net', '').replace('@g.us', ''),
      admin: p.admin || null,
    }));
    res.json({ ok: true, participants, subject: meta.subject });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /sessions/:id/groups/from-link — extrai participantes via link de convite (sem ser membro)
app.post('/sessions/:id/groups/from-link', async (req, res) => {
  try {
    const session = sessions[req.params.id];
    if (!session || session.status !== 'connected') {
      return res.status(400).json({ ok: false, error: 'Sessão não conectada' });
    }
    const { link } = req.body;
    if (!link) return res.status(400).json({ ok: false, error: 'link é obrigatório' });

    // Extrai código do link
    const match = String(link).match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]{10,})/);
    const code = match ? match[1] : (/^[A-Za-z0-9_-]{10,}$/.test(link.trim()) ? link.trim() : null);
    if (!code) return res.status(400).json({ ok: false, error: 'Link inválido' });

    const info = await session.sock.groupGetInviteInfo(code);
    const participants = (info.participants || []).map((p) => ({
      id: p.id,
      phone: p.id.replace('@s.whatsapp.net', '').replace('@g.us', ''),
      admin: p.admin || null,
    }));
    res.json({
      ok: true,
      groupId: info.id,
      subject: info.subject || '',
      participantCount: info.size ?? participants.length,
      participants,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Marcar como lido ─────────────────────────────────────────────────────────
app.post('/sessions/:id/read', async (req, res) => {
  try {
    const session = sessions[req.params.id];
    const { jid, messageId } = req.body;
    await session.sock.readMessages([{ remoteJid: jid, id: messageId, participant: undefined }]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Simular digitação ────────────────────────────────────────────────────────
app.post('/sessions/:id/typing', async (req, res) => {
  try {
    const session = sessions[req.params.id];
    const { jid, duration = 2000 } = req.body;
    await session.sock.sendPresenceUpdate('composing', jid);
    setTimeout(() => session.sock.sendPresenceUpdate('paused', jid), duration);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Estatísticas ─────────────────────────────────────────────────────────────
app.get('/stats', (req, res) => {
  res.json({ ok: true, stats: sendStats });
});

app.get('/stats/:id', (req, res) => {
  res.json({ ok: true, stats: sendStats[req.params.id] || { sent: 0, failed: 0, total: 0, startTime: null } });
});

// ─── Auto-resposta com regras ─────────────────────────────────────────────────
const autoReplyRules = {}; // sessionId -> { enabled, rules: AutoRule[] }
const cooldownMap = {};
const respondedOnce = {};
const ruleStats = {}; // sessionId -> { ruleId -> { hitCount, lastHit } }
const replyQueue = {}; // sessionId -> [{ id, jid, ruleName, msgText, ts, status }]
const RULES_FILE = path.join(DATA_DIR, 'auto-reply-rules.json');

// Carrega regras persistidas do disco
function loadPersistedRules() {
  try {
    if (fs.existsSync(RULES_FILE)) {
      const data = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
      Object.assign(autoReplyRules, data);
      console.log(`[auto-reply] Regras carregadas: ${Object.keys(data).join(', ')}`);
    }
  } catch (e) {
    console.error('[auto-reply] Erro ao carregar regras:', e.message);
  }
}

function persistRules() {
  try {
    fs.writeFileSync(RULES_FILE, JSON.stringify(autoReplyRules, null, 2));
  } catch (e) {
    console.error('[auto-reply] Erro ao salvar regras:', e.message);
  }
}

function substituteVars(text, { name, number, groupName, message }) {
  const now = new Date();
  return text
    .replace(/{nome}/g, name || number || '')
    .replace(/{numero}/g, number || '')
    .replace(/{hora}/g, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    .replace(/{data}/g, now.toLocaleDateString('pt-BR'))
    .replace(/{grupo}/g, groupName || '')
    .replace(/{mensagem}/g, message || '');
}

function matchesTrigger(trigger, matchMode, caseSensitive, msgText) {
  if (!trigger) return true; // sem gatilho = responde sempre
  const t = caseSensitive ? trigger : trigger.toLowerCase();
  const m = caseSensitive ? msgText : msgText.toLowerCase();
  if (matchMode === 'exact') return m === t;
  if (matchMode === 'startsWith') return m.startsWith(t);
  if (matchMode === 'regex') { try { return new RegExp(trigger, caseSensitive ? '' : 'i').test(msgText); } catch { return false; } }
  return m.includes(t); // contains
}

async function processAutoReply(sessionId, msg) {
  const config = autoReplyRules[sessionId];
  if (!config?.enabled || !config.rules?.length) return;

  const session = sessions[sessionId];
  if (!session || session.status !== 'connected') return;

  const jid = msg.key.remoteJid;
  if (!jid || msg.key.fromMe) return;

  const isGroup = jid.endsWith('@g.us');
  const msgText = msg.message?.conversation
    || msg.message?.extendedTextMessage?.text
    || msg.message?.imageMessage?.caption
    || '';

  if (!msgText) return;

  const senderJid = isGroup ? (msg.key.participant || jid) : jid;
  const senderNumber = senderJid.replace('@s.whatsapp.net', '').replace('@g.us', '');

  for (const rule of config.rules) {
    if (!rule.enabled) continue;
    if (rule.targetType === 'private' && isGroup) continue;
    if (rule.targetType === 'groups' && !isGroup) continue;
    if (rule.targetType === 'specific') {
      const targets = rule.targetNumbers.map((t) => t.replace(/\D/g, ''));
      if (!targets.includes(senderNumber) && !targets.includes(jid)) continue;
    }

    if (!matchesTrigger(rule.trigger, rule.matchMode, rule.caseSensitive, msgText)) continue;

    // Horário de funcionamento por regra
    if (rule.workingHours?.enabled) {
      const now = new Date();
      const [sh, sm] = (rule.workingHours.start || '08:00').split(':').map(Number);
      const [eh, em] = (rule.workingHours.end || '18:00').split(':').map(Number);
      const cur = now.getHours() * 60 + now.getMinutes();
      if (cur < sh * 60 + sm || cur > eh * 60 + em) continue;
    }

    const onceKey = `${sessionId}:${rule.id}:${senderJid}`;
    if (rule.onlyOnce && respondedOnce[onceKey]) continue;

    const coolKey = `${sessionId}:${senderJid}`;
    if ((Date.now() - (cooldownMap[coolKey] || 0)) < rule.cooldown) continue;

    let contactName = senderNumber;
    try {
      const contact = await session.sock.onWhatsApp(senderJid);
      contactName = contact?.[0]?.notify || senderNumber;
    } catch {}

    let groupName = '';
    if (isGroup) {
      try { const meta = await session.sock.groupMetadata(jid); groupName = meta.subject; } catch {}
    }

    const responseText = substituteVars(rule.response, {
      name: contactName, number: senderNumber, groupName, message: msgText,
    });

    // Enfileirar
    if (!replyQueue[sessionId]) replyQueue[sessionId] = [];
    const queueEntry = { id: generateId(), jid, senderNumber, ruleName: rule.name, msgText, ts: Date.now(), status: 'pending' };
    replyQueue[sessionId].push(queueEntry);
    broadcast('auto_reply_queued', { sessionId, queue: replyQueue[sessionId].slice(-50) });

    try {
      if (rule.simulateTyping) {
        await session.sock.sendPresenceUpdate('composing', jid);
        await new Promise((r) => setTimeout(r, rule.typingDelay || 1500));
        await session.sock.sendPresenceUpdate('paused', jid);
      }

      // Enviar mídia se configurada
      if (rule.mediaBase64 && rule.mediaType && rule.mediaType !== 'none') {
        const buffer = Buffer.from(rule.mediaBase64, 'base64');
        let mediaMsg = {};
        if (rule.mediaType === 'image') mediaMsg = { image: buffer, caption: responseText || '' };
        else if (rule.mediaType === 'video') mediaMsg = { video: buffer, caption: responseText || '' };
        else if (rule.mediaType === 'audio') mediaMsg = { audio: buffer, mimetype: 'audio/mp4', ptt: false };
        else if (rule.mediaType === 'document') mediaMsg = { document: buffer, mimetype: 'application/octet-stream', fileName: rule.mediaName || 'arquivo' };
        await session.sock.sendMessage(jid, mediaMsg);
        // Se tem texto E mídia, envia texto separado (exceto se já foi como caption)
        if (responseText && (rule.mediaType === 'audio' || rule.mediaType === 'document')) {
          await session.sock.sendMessage(jid, { text: responseText });
        }
      } else {
        await session.sock.sendMessage(jid, { text: responseText });
      }

      cooldownMap[coolKey] = Date.now();
      if (rule.onlyOnce) respondedOnce[onceKey] = true;

      // Atualizar stats
      if (!ruleStats[sessionId]) ruleStats[sessionId] = {};
      if (!ruleStats[sessionId][rule.id]) ruleStats[sessionId][rule.id] = { hitCount: 0, lastHit: null };
      ruleStats[sessionId][rule.id].hitCount++;
      ruleStats[sessionId][rule.id].lastHit = new Date().toISOString();

      // Atualizar fila
      queueEntry.status = 'sent';
      broadcast('auto_reply_sent', { sessionId, jid, rule: rule.name, response: responseText });
      broadcast('auto_reply_queued', { sessionId, queue: replyQueue[sessionId].slice(-50) });
    } catch (err) {
      queueEntry.status = 'failed';
      broadcast('auto_reply_queued', { sessionId, queue: replyQueue[sessionId].slice(-50) });
      console.error(`[auto-reply:${sessionId}] Erro ao enviar:`, err.message);
    }
    break;
  }
}

app.post('/sessions/:id/auto-reply', (req, res) => {
  const { id } = req.params;
  const { enabled, systemPrompt } = req.body;
  let rules = [];
  try { rules = JSON.parse(systemPrompt || '[]'); } catch {}
  autoReplyRules[id] = { enabled, rules };
  persistRules();
  res.json({ ok: true });
});

app.get('/sessions/:id/auto-reply-stats', (req, res) => {
  res.json({ ok: true, stats: ruleStats[req.params.id] || {} });
});

app.get('/sessions/:id/auto-reply-queue', (req, res) => {
  res.json({ ok: true, queue: (replyQueue[req.params.id] || []).slice(-50) });
});

app.delete('/sessions/:id/auto-reply-queue', (req, res) => {
  replyQueue[req.params.id] = [];
  res.json({ ok: true });
});

// ─── IA Atendimento ───────────────────────────────────────────────────────────
const iaConfigs = {};
const iaCooldown = {};async function processIAReply(sessionId, msg) {
  const cfg = iaConfigs[sessionId];
  if (!cfg?.enabled) return;
  if (!cfg.provider || cfg.provider === 'none') return;
  if (cfg.provider !== 'ollama' && !cfg.apiKey) return;

  const session = sessions[sessionId];
  if (!session || session.status !== 'connected') return;

  const jid = msg.key?.remoteJid;
  if (!jid || msg.key?.fromMe) return;

  const isGroup = jid.endsWith('@g.us');
  if (cfg.chatScope === 'private' && isGroup) return;
  if (cfg.chatScope === 'groups' && !isGroup) return;

  const msgText = msg.message?.conversation
    || msg.message?.extendedTextMessage?.text
    || msg.message?.imageMessage?.caption
    || msg.message?.videoMessage?.caption
    || '';
  if (!msgText) return;

  const now = Date.now();
  if (iaCooldown[jid] && (now - iaCooldown[jid]) < 3000) return;

  if (cfg.workingHoursEnabled) {
    const nowTime = new Date();
    const [startH, startM] = (cfg.workingHoursStart || '08:00').split(':').map(Number);
    const [endH, endM] = (cfg.workingHoursEnd || '18:00').split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    const curMins = nowTime.getHours() * 60 + nowTime.getMinutes();
    if (curMins < startMins || curMins > endMins) return;
  }

  const lowerText = msgText.toLowerCase();
  if (cfg.sensitiveWords?.some(w => lowerText.includes(w.toLowerCase()))) {
    broadcast('ia_transfer', { sessionId, jid, reason: 'sensitive_word' });
    // Fire transfer webhook
    if (cfg.transferWebhook) {
      fetch(cfg.transferWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, jid, reason: 'sensitive_word', ts: Date.now() }),
      }).catch(e => console.error('[ia] webhook error:', e.message));
    }
    return;
  }

  iaCooldown[jid] = now;

  const delayMin = (cfg.responseDelayMin || 1) * 1000;
  const delayMax = (cfg.responseDelayMax || 3) * 1000;
  const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;

  try {
    await new Promise(r => setTimeout(r, delay));
    await session.sock.sendPresenceUpdate('composing', jid);
    await new Promise(r => setTimeout(r, 1500));
    await session.sock.sendPresenceUpdate('paused', jid);

    // ── Contexto avançado ──────────────────────────────────────────────────
    const key = `${sessionId}:${jid}`;
    const senderName = msg.pushName || jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    const senderNumber = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');

    // Atualiza perfil do cliente
    iaEngine.updateClientProfile(key, senderName, senderNumber);

    // Persiste mensagem recebida no histórico
    appendIAHistory(sessionId, jid, 'user', msgText);

    // Pega histórico do messageStore
    if (!messageStore[sessionId]) messageStore[sessionId] = new Map();
    const history = messageStore[sessionId].get(jid) || [];

    // Gera resumo a cada 20 mensagens
    if (history.length > 0 && history.length % 20 === 0) {
      const summary = await iaEngine.generateSummary(cfg.provider, cfg.apiKey, cfg.model, history);
      if (summary) iaEngine.conversationSummaries[key] = summary;
    }

    // Monta prompt com contexto avançado (últimas 10 mensagens + resumo + perfil)
    const messages = iaEngine.buildMessages(
      cfg.basePrompt || 'Você é um assistente prestativo. Responda de forma breve e amigável.',
      key,
      history,
      10
    );

    const response = await iaEngine.callAIRaw(cfg.provider, cfg.apiKey, cfg.model, messages);

    if (!response) {
      if (cfg.fallbackMessage) await session.sock.sendMessage(jid, { text: cfg.fallbackMessage });
      return;
    }

    const respLower = response.toLowerCase();
    if (cfg.forbiddenWords?.some(w => respLower.includes(w.toLowerCase()))) {
      if (cfg.fallbackMessage) await session.sock.sendMessage(jid, { text: cfg.fallbackMessage });
      return;
    }

    await session.sock.sendMessage(jid, { text: response });

    // Persiste resposta da IA no histórico
    appendIAHistory(sessionId, jid, 'assistant', response);

    // Salva resposta no messageStore
    const storedMsgs = messageStore[sessionId].get(jid) || [];
    storedMsgs.push({ id: Date.now().toString(), fromMe: true, text: response, ts: Date.now(), senderName: 'IA' });
    if (storedMsgs.length > 50) storedMsgs.splice(0, storedMsgs.length - 50);
    messageStore[sessionId].set(jid, storedMsgs);

    broadcast('ia_reply_sent', { sessionId, jid, response: response.slice(0, 100) });
    broadcast('chat_updated', { sessionId, jid });
    console.log(`[ia:${sessionId}] Respondeu ${jid}: ${response.slice(0, 60)}...`);

  } catch (err) {
    console.error(`[ia:${sessionId}] Erro ao responder:`, err.message);
    broadcast('ia_error', { sessionId, jid, error: err.message });
    if (cfg.fallbackMessage) {
      try { await session.sock.sendMessage(jid, { text: cfg.fallbackMessage }); } catch {}
    }
  }
}

// Endpoint para salvar config da IA
app.post('/sessions/:id/ia-config', (req, res) => {
  const { id } = req.params;
  iaConfigs[id] = req.body;
  console.log(`[ia:${id}] Config atualizada — enabled: ${req.body.enabled}, provider: ${req.body.provider}`);
  res.json({ ok: true });
});

app.get('/sessions/:id/ia-config', (req, res) => {
  res.json({ ok: true, config: iaConfigs[req.params.id] || null });
});

// ─── IA History persistence ───────────────────────────────────────────────────
const IA_HISTORY_FILE = path.join(DATA_DIR, 'ia-history.json');
let iaHistory = {}; // { sessionId: { jid: [{ role, text, ts }] } }

try {
  if (fs.existsSync(IA_HISTORY_FILE)) iaHistory = JSON.parse(fs.readFileSync(IA_HISTORY_FILE, 'utf8'));
} catch { iaHistory = {}; }

function saveIAHistory() {
  try { fs.writeFileSync(IA_HISTORY_FILE, JSON.stringify(iaHistory, null, 2)); } catch {}
}

function appendIAHistory(sessionId, jid, role, text) {
  if (!iaHistory[sessionId]) iaHistory[sessionId] = {};
  if (!iaHistory[sessionId][jid]) iaHistory[sessionId][jid] = [];
  iaHistory[sessionId][jid].push({ role, text, ts: Date.now() });
  // Keep last 100 messages per conversation
  if (iaHistory[sessionId][jid].length > 100) iaHistory[sessionId][jid].splice(0, iaHistory[sessionId][jid].length - 100);
  saveIAHistory();
}

// GET /sessions/:id/ia-history — list all conversations with history
app.get('/sessions/:id/ia-history', (req, res) => {
  const hist = iaHistory[req.params.id] || {};
  const list = Object.entries(hist).map(([jid, msgs]) => ({
    jid,
    messageCount: msgs.length,
    lastTs: msgs[msgs.length - 1]?.ts || 0,
    lastText: msgs[msgs.length - 1]?.text || '',
  })).sort((a, b) => b.lastTs - a.lastTs);
  res.json({ ok: true, conversations: list });
});

// GET /sessions/:id/ia-history/:jid — get full history for a conversation
app.get('/sessions/:id/ia-history/:jid', (req, res) => {
  const jid = decodeURIComponent(req.params.jid);
  const msgs = (iaHistory[req.params.id] || {})[jid] || [];
  res.json({ ok: true, messages: msgs });
});

// DELETE /sessions/:id/ia-history/:jid — clear history for a conversation
app.delete('/sessions/:id/ia-history/:jid', (req, res) => {
  const jid = decodeURIComponent(req.params.jid);
  if (iaHistory[req.params.id]) delete iaHistory[req.params.id][jid];
  saveIAHistory();
  res.json({ ok: true });
});

// POST /sessions/:id/ia-transfer — manually trigger transfer notification
app.post('/sessions/:id/ia-transfer', async (req, res) => {
  const { jid, reason = 'manual' } = req.body || {};
  const cfg = iaConfigs[req.params.id];
  if (!jid) return res.status(400).json({ ok: false, error: 'jid required' });
  broadcast('ia_transfer', { sessionId: req.params.id, jid, reason });
  // Fire webhook if configured
  if (cfg?.transferWebhook) {
    try {
      await fetch(cfg.transferWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: req.params.id, jid, reason, ts: Date.now() }),
      });
    } catch (e) { console.error('[ia] webhook error:', e.message); }
  }
  res.json({ ok: true });
});

// POST /sessions/:id/ia-test — real AI test call
app.post('/sessions/:id/ia-test', async (req, res) => {
  const cfg = iaConfigs[req.params.id];
  const { message, history = [] } = req.body || {};
  if (!message) return res.status(400).json({ ok: false, error: 'message required' });
  if (!cfg) return res.status(400).json({ ok: false, error: 'IA não configurada para esta sessão' });
  if (!cfg.provider || cfg.provider === 'none') return res.status(400).json({ ok: false, error: 'Provider não configurado' });
  if (cfg.provider !== 'ollama' && !cfg.apiKey) return res.status(400).json({ ok: false, error: 'API key não configurada' });

  const start = Date.now();
  try {
    const messages = [
      { role: 'system', content: cfg.basePrompt || 'Você é um assistente prestativo.' },
      ...history.map(m => ({ role: m.role, content: m.text })),
      { role: 'user', content: message },
    ];
    const response = await iaEngine.callAIRaw(cfg.provider, cfg.apiKey, cfg.model, messages);
    res.json({ ok: true, response, latencyMs: Date.now() - start, provider: cfg.provider, model: cfg.model });
  } catch (err) {
    res.json({ ok: false, error: err.message, latencyMs: Date.now() - start });
  }
});

// ─── Campanhas agendadas ──────────────────────────────────────────────────────
app.get('/campaigns', (req, res) => res.json(scheduler.getCampaigns()));

app.post('/campaigns', (req, res) => {
  try {
    const campaign = req.body;
    if (!campaign.id) campaign.id = Math.random().toString(36).slice(2, 9);
    res.json(scheduler.upsertCampaign(campaign));
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.put('/campaigns/:id', (req, res) => {
  try {
    const campaign = { ...req.body, id: req.params.id };
    res.json(scheduler.upsertCampaign(campaign));
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.delete('/campaigns/:id', (req, res) => {
  scheduler.deleteCampaign(req.params.id);
  res.json({ ok: true });
});

app.post('/campaigns/:id/toggle', (req, res) => {
  const result = scheduler.toggleCampaign(req.params.id, req.body.enabled);
  res.json({ ok: !!result, campaign: result });
});

app.post('/campaigns/:id/run-now', (req, res) => {
  scheduler.runNow(req.params.id);
  res.json({ ok: true, message: 'Disparo iniciado' });
});

// ─── WebSocket connection ─────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  // Envia estado atual de todas as sessões para o cliente que acabou de conectar
  const currentSessions = Object.entries(sessions).map(([id, s]) => ({
    id,
    status: s.status,
    user: s.sock?.user || null,
    qr: s.qr,
    pairingCode: s.pairingCode,
  }));
  ws.send(JSON.stringify({ event: 'connected', data: { sessions: currentSessions } }));

  // Emite evento de conexão individual para cada sessão já ativa
  Object.entries(sessions).forEach(([id, s]) => {
    if (s.status === 'connected') {
      ws.send(JSON.stringify({ event: 'connection', data: { sessionId: id, status: 'connected', user: s.sock?.user } }));
    } else if (s.status === 'qr' && s.qr) {
      ws.send(JSON.stringify({ event: 'qr', data: { sessionId: id, qr: s.qr } }));
    }
  });
});

// ─── Google Maps Scraper ──────────────────────────────────────────────────────
const { scrapeGoogleMaps } = require('./maps-scraper');
const { scrapeWhatsAppGroups } = require('./groups-scraper');
const { joinGroupsFromLinks, extractInviteCode } = require('./grupo-joiner');

// Mapa de jobs ativos: jobId → AbortController
const mapsJobs = new Map();

// POST /maps/start — inicia scraping, retorna jobId
app.post('/maps/start', (req, res) => {
  const { keyword, location, maxResults = 50, minRating = 0, categoryFilter = '' } = req.body || {};
  if (!keyword || !location) return res.status(400).json({ ok: false, error: 'keyword e location são obrigatórios' });

  const jobId = `maps-${Date.now()}`;
  const ctrl = new AbortController();
  mapsJobs.set(jobId, { ctrl, leads: [], logs: [], done: false, error: null });

  const job = mapsJobs.get(jobId);

  scrapeGoogleMaps(
    keyword, location, Number(maxResults),
    (lead) => { job.leads.push(lead); },
    (msg, level = 'info') => { job.logs.push({ msg, level, ts: Date.now() }); },
    ctrl.signal,
    { minRating: Number(minRating), categoryFilter: String(categoryFilter) },
  ).then(() => {
    job.done = true;
  }).catch((err) => {
    job.done = true;
    job.error = err.message || String(err);
  });

  res.json({ ok: true, jobId });
});

// GET /maps/stream/:jobId — SSE stream de leads e logs
app.get('/maps/stream/:jobId', (req, res) => {
  const job = mapsJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job não encontrado' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let leadIdx = 0;
  let logIdx = 0;

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const interval = setInterval(() => {
    // Envia novos logs
    while (logIdx < job.logs.length) {
      send('log', job.logs[logIdx++]);
    }
    // Envia novos leads
    while (leadIdx < job.leads.length) {
      send('lead', job.leads[leadIdx++]);
    }
    // Finaliza
    if (job.done) {
      if (job.error) send('error', { message: job.error });
      send('done', { total: job.leads.length });
      clearInterval(interval);
      res.end();
      mapsJobs.delete(req.params.jobId);
    }
  }, 300);

  req.on('close', () => {
    clearInterval(interval);
    job.ctrl.abort();
    mapsJobs.delete(req.params.jobId);
  });
});

// DELETE /maps/stop/:jobId — cancela job
app.delete('/maps/stop/:jobId', (req, res) => {
  const job = mapsJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job não encontrado' });
  job.ctrl.abort();
  mapsJobs.delete(req.params.jobId);
  res.json({ ok: true });
});

// ─── WhatsApp Groups Scraper ──────────────────────────────────────────────────
const groupsJobs = new Map();

app.post('/groups/start', (req, res) => {
  const { keyword, location, maxResults = 100 } = req.body || {};
  if (!keyword) return res.status(400).json({ ok: false, error: 'keyword é obrigatório' });

  const jobId = `groups-${Date.now()}`;
  const ctrl = new AbortController();
  groupsJobs.set(jobId, { ctrl, groups: [], logs: [], done: false, error: null });

  const job = groupsJobs.get(jobId);

  scrapeWhatsAppGroups(
    keyword, location || '', Number(maxResults),
    (group) => { job.groups.push(group); },
    (msg, level = 'info') => { job.logs.push({ msg, level, ts: Date.now() }); },
    ctrl.signal,
  ).then(() => {
    job.done = true;
  }).catch((err) => {
    job.done = true;
    job.error = err.message || String(err);
  });

  res.json({ ok: true, jobId });
});

app.get('/groups/stream/:jobId', (req, res) => {
  const job = groupsJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job não encontrado' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let groupIdx = 0;
  let logIdx = 0;
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const interval = setInterval(() => {
    while (logIdx < job.logs.length) send('log', job.logs[logIdx++]);
    while (groupIdx < job.groups.length) send('group', job.groups[groupIdx++]);
    if (job.done) {
      if (job.error) send('error', { message: job.error });
      send('done', { total: job.groups.length });
      clearInterval(interval);
      res.end();
      groupsJobs.delete(req.params.jobId);
    }
  }, 300);

  req.on('close', () => {
    clearInterval(interval);
    job.ctrl.abort();
    groupsJobs.delete(req.params.jobId);
  });
});

app.delete('/groups/stop/:jobId', (req, res) => {
  const job = groupsJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job não encontrado' });
  job.ctrl.abort();
  groupsJobs.delete(req.params.jobId);
  res.json({ ok: true });
});

// POST /groups/validate — verifica status de links chat.whatsapp.com via Baileys
// Body: { links: string[], sessionId?: string }
// Retorna: { results: { link, status: 'valid'|'expired'|'unknown', name?, members? }[] }
app.post('/groups/validate', async (req, res) => {
  res.setTimeout(120000); // 2 min — serializado com delay, pode demorar
  const { links = [], sessionId } = req.body || {};
  if (!Array.isArray(links) || links.length === 0) {
    return res.json({ ok: true, results: [] });
  }

  // Pega sessão conectada
  const sid = sessionId || Object.keys(sessions).find(k => sessions[k]?.status === 'connected');
  const session = sid ? sessions[sid] : null;

  if (!session || session.status !== 'connected') {
    return res.status(400).json({ ok: false, error: 'Nenhuma sessão WhatsApp conectada. Conecte uma sessão para validar links.' });
  }

  // Serializa as chamadas com delay para evitar rate-limit do WhatsApp
  const results = [];
  for (const link of links) {
    const code = link
      .replace('https://chat.whatsapp.com/', '')
      .replace('http://chat.whatsapp.com/', '')
      .split('?')[0]
      .split('/')[0]
      .replace(/[^A-Za-z0-9_-]/g, '')  // remove qualquer char não-alfanumérico
      .trim();
    if (!code || code.length < 10) {
      results.push({ link, status: 'expired' });
      continue;
    }

    try {
      console.log(`[validate] tentando código: "${code}" (len=${code.length})`);
      const info = await session.sock.groupGetInviteInfo(code);
      results.push({
        link,
        status: 'valid',
        name: info.subject || '',
        members: info.size ?? (info.participants?.length ?? null),
      });
    } catch (err) {
      const msg = err?.message || String(err);
      console.log(`[validate] ${code} (len=${code.length}) → erro: ${msg}`);
      if (msg.includes('invalid') || msg.includes('not-authorized') || msg.includes('404') || msg.includes('gone') || msg.includes('bad-request')) {
        results.push({ link, status: 'expired' });
      } else {
        results.push({ link, status: 'unknown' });
      }
    }

    // Delay entre chamadas para não bater rate-limit
    await new Promise(r => setTimeout(r, 600));
  }

  res.json({ ok: true, results });
});

// ─── Group Joiner ─────────────────────────────────────────────────────────────
const joinJobs = new Map();
const JOIN_HISTORY_FILE = path.join(DATA_DIR, 'join-history.json');

// Carrega histórico do disco
function loadJoinHistory() {
  try {
    if (fs.existsSync(JOIN_HISTORY_FILE)) return JSON.parse(fs.readFileSync(JOIN_HISTORY_FILE, 'utf8'));
  } catch {}
  return [];
}

function saveJoinHistory(history) {
  try { fs.writeFileSync(JOIN_HISTORY_FILE, JSON.stringify(history.slice(-500), null, 2)); } catch {}
}

// POST /groups/join/start — inicia job de join em background, retorna jobId
// Suporta múltiplas sessões: se sessionIds[] for passado, distribui links entre elas
app.post('/groups/join/start', (req, res) => {
  const { links = [], sessionId, sessionIds, options = {} } = req.body || {};
  if (!Array.isArray(links) || links.length === 0) {
    return res.status(400).json({ ok: false, error: 'links é obrigatório' });
  }

  // Resolve sessões a usar
  let targetSessions = [];
  if (Array.isArray(sessionIds) && sessionIds.length > 0) {
    targetSessions = sessionIds
      .map(id => ({ id, session: sessions[id] }))
      .filter(({ session }) => session?.status === 'connected');
  } else {
    const sid = sessionId || Object.keys(sessions).find(k => sessions[k]?.status === 'connected');
    if (sid && sessions[sid]?.status === 'connected') targetSessions = [{ id: sid, session: sessions[sid] }];
  }

  if (targetSessions.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nenhuma sessão conectada' });
  }

  const jobId = `join-${Date.now()}`;
  const job = {
    results: [],
    logs: [],
    done: false,
    paused: false,
    error: null,
    aborted: false,
    sessionIds: targetSessions.map(s => s.id),
    total: links.length,
    startedAt: new Date().toISOString(),
  };
  joinJobs.set(jobId, job);

  const onProgress = (upd, sid) => {
    const entry = { ...upd, sessionId: sid, ts: Date.now() };
    job.logs.push(entry);
    broadcast('join_progress', { jobId, sessionId: sid, ...upd });
  };

  // Distribui links entre sessões
  const chunks = targetSessions.map((_, i) =>
    links.filter((_, li) => li % targetSessions.length === i)
  );

  const promises = targetSessions.map(({ id, session }, i) =>
    joinGroupsFromLinks(session.sock, chunks[i], {
      maxJoinsPerHour: options.maxJoinsPerHour ?? 20,
      delayMinMs:      options.delayMinMs      ?? 8000,
      delayMaxMs:      options.delayMaxMs      ?? 25000,
      maxRetries:      options.maxRetries      ?? 2,
      minMembers:      options.minMembers      ?? null,
      maxMembers:      options.maxMembers      ?? null,
      groupType:       options.groupType       ?? null,
      onProgress:      (upd) => onProgress(upd, id),
      shouldPause:     () => job.paused,
      shouldAbort:     () => job.aborted,
    })
  );

  Promise.all(promises).then(allResults => {
    job.results = allResults.flat();
    job.done = true;
    // Persistir histórico
    const history = loadJoinHistory();
    history.push({
      jobId,
      startedAt: job.startedAt,
      finishedAt: new Date().toISOString(),
      sessionIds: job.sessionIds,
      total: job.total,
      results: job.results,
    });
    saveJoinHistory(history);
    broadcast('join_done', { jobId, results: job.results });
  }).catch(err => {
    job.done = true;
    job.error = err.message;
    broadcast('join_done', { jobId, error: err.message });
  });

  res.json({ ok: true, jobId, total: links.length, sessions: targetSessions.map(s => s.id) });
});

// GET /groups/join/stream/:jobId — SSE com progresso em tempo real
app.get('/groups/join/stream/:jobId', (req, res) => {
  const job = joinJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job não encontrado' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  let logIdx = 0;
  const interval = setInterval(() => {
    while (logIdx < job.logs.length) send('progress', job.logs[logIdx++]);
    if (job.done) {
      if (job.error) send('error', { message: job.error });
      else send('done', { results: job.results });
      clearInterval(interval);
      res.end();
    }
  }, 300);

  req.on('close', () => clearInterval(interval));
});

// GET /groups/join/status/:jobId — polling simples
app.get('/groups/join/status/:jobId', (req, res) => {
  const job = joinJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job não encontrado' });
  res.json({ ok: true, done: job.done, paused: job.paused, results: job.results, logs: job.logs, error: job.error });
});

// POST /groups/join/pause/:jobId
app.post('/groups/join/pause/:jobId', (req, res) => {
  const job = joinJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job não encontrado' });
  job.paused = true;
  res.json({ ok: true });
});

// POST /groups/join/resume/:jobId
app.post('/groups/join/resume/:jobId', (req, res) => {
  const job = joinJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job não encontrado' });
  job.paused = false;
  res.json({ ok: true });
});

// DELETE /groups/join/stop/:jobId — cancela job
app.delete('/groups/join/stop/:jobId', (req, res) => {
  const job = joinJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job não encontrado' });
  job.aborted = true;
  joinJobs.delete(req.params.jobId);
  res.json({ ok: true });
});

// GET /groups/join/history — histórico persistido
app.get('/groups/join/history', (req, res) => {
  res.json({ ok: true, history: loadJoinHistory() });
});

// DELETE /groups/join/history — limpa histórico
app.delete('/groups/join/history', (req, res) => {
  saveJoinHistory([]);
  res.json({ ok: true });
});

// POST /sessions/:id/check-whatsapp — verifica quais números têm WhatsApp
app.post('/sessions/:id/check-whatsapp', async (req, res) => {
  const session = sessions[req.params.id];
  if (!session || session.status !== 'connected') {
    return res.status(400).json({ ok: false, error: 'Sessão não conectada' });
  }
  const { numbers = [] } = req.body;
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.json({ ok: true, results: [] });
  }

  const results = [];
  // Processa em lotes de 10 para não sobrecarregar
  const BATCH = 10;
  for (let i = 0; i < numbers.length; i += BATCH) {
    const batch = numbers.slice(i, i + BATCH);
    await Promise.all(batch.map(async (raw) => {
      const clean = String(raw).replace(/\D/g, '');
      if (clean.length < 10) { results.push({ number: raw, hasWhatsapp: false }); return; }
      try {
        const jid = clean.includes('@') ? clean : `${clean}@s.whatsapp.net`;
        const [result] = await session.sock.onWhatsApp(jid);
        results.push({ number: raw, hasWhatsapp: !!(result?.exists) });
      } catch {
        results.push({ number: raw, hasWhatsapp: false });
      }
    }));
    // Pequeno delay entre lotes para não bater rate limit
    if (i + BATCH < numbers.length) await new Promise(r => setTimeout(r, 500));
  }

  res.json({ ok: true, results });
});
const { execFile, spawn } = require('child_process');

function getChromiumExecPath() {
  try {
    const { chromium } = require('playwright-core');
    return chromium.executablePath();
  } catch { return null; }
}

// GET /maps/chromium-status — verifica se Chromium está instalado
app.get('/maps/chromium-status', (req, res) => {
  try {
    const execPath = getChromiumExecPath();
    const installed = !!(execPath && fs.existsSync(execPath));
    res.json({ ok: true, installed, execPath: installed ? execPath : null });
  } catch (e) {
    res.json({ ok: true, installed: false, execPath: null });
  }
});

// POST /maps/chromium-install — instala Chromium via playwright-core (SSE progress)
app.post('/maps/chromium-install', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // Resolve o caminho do executável playwright-core
  let pwCorePath;
  try {
    pwCorePath = require.resolve('playwright-core/cli');
  } catch {
    // fallback: tenta npx
    pwCorePath = null;
  }

  const args = pwCorePath
    ? [pwCorePath, 'install', 'chromium']
    : ['playwright-core', 'install', 'chromium'];

  const cmd = pwCorePath ? process.execPath : 'npx';
  const child = spawn(cmd, pwCorePath ? [pwCorePath, 'install', 'chromium'] : ['playwright-core', 'install', 'chromium'], {
    env: { ...process.env },
    shell: !pwCorePath,
  });

  send('log', { msg: 'Iniciando instalação do Chromium...', level: 'info' });

  child.stdout.on('data', (d) => {
    const line = d.toString().trim();
    if (line) send('log', { msg: line, level: 'info' });
  });
  child.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (line) send('log', { msg: line, level: 'info' });
  });
  child.on('close', (code) => {
    if (code === 0) {
      const execPath = getChromiumExecPath();
      send('done', { success: true, execPath });
    } else {
      send('done', { success: false, error: `Processo encerrou com código ${code}` });
    }
    res.end();
  });
  child.on('error', (err) => {
    send('done', { success: false, error: err.message });
    res.end();
  });

  req.on('close', () => { try { child.kill(); } catch {} });
});

// DELETE /maps/chromium-uninstall — remove pasta do Chromium
app.delete('/maps/chromium-uninstall', (req, res) => {
  try {
    const execPath = getChromiumExecPath();
    if (!execPath) return res.json({ ok: false, error: 'Chromium não encontrado' });

    // Sobe até a pasta raiz do browser (ex: chromium-1208/chrome-win64 → chromium-1208)
    const browserDir = path.dirname(path.dirname(execPath));
    if (!fs.existsSync(browserDir)) return res.json({ ok: false, error: 'Diretório não encontrado' });

    fs.rmSync(browserDir, { recursive: true, force: true });
    res.json({ ok: true, removed: browserDir });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
function killPortAndListen() {
  return new Promise((resolve) => {
    const net = require('net');
    const tester = net.createServer();
    tester.once('error', () => {
      // Porta ocupada — tenta conectar e destruir para forçar liberação
      const killer = net.createConnection({ port: PORT, host: '127.0.0.1' });
      killer.on('connect', () => { killer.destroy(); });
      killer.on('error', () => {});
      // Aguarda o SO liberar o socket (TIME_WAIT)
      setTimeout(resolve, 2000);
    });
    tester.once('listening', () => {
      tester.close(resolve); // porta livre
    });
    tester.listen(PORT, '127.0.0.1');
  });
}

function startServer() {
  killPortAndListen().then(() => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[baileys-server] Rodando em http://127.0.0.1:${PORT}`);
      loadPersistedRules();
      scheduler.init(sessions, broadcast);
      if (fs.existsSync(SESSIONS_DIR)) {
        const saved = fs.readdirSync(SESSIONS_DIR).filter((f) => {
          if (!fs.statSync(path.join(SESSIONS_DIR, f)).isDirectory()) return false;
          // Não reconecta se estava em qr_timeout (usuário não escaneou)
          if (fs.existsSync(path.join(SESSIONS_DIR, f, '.qr_timeout'))) return false;
          // Só reconecta se tiver creds.json com conta autenticada (campo "me")
          const credsPath = path.join(SESSIONS_DIR, f, 'creds.json');
          if (!fs.existsSync(credsPath)) return false;
          try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            return !!(creds.me?.id); // só reconecta se já tinha conta vinculada
          } catch {
            return false;
          }
        });
        saved.forEach((sid) => {
          console.log(`[baileys-server] Reconectando sessão: ${sid}`);
          createSession(sid).catch(console.error);
        });
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[baileys-server] Porta ${PORT} ainda em uso, aguardando 4s...`);
        setTimeout(() => {
          server.listen(PORT, '127.0.0.1');
        }, 4000);
      } else {
        console.error('[baileys-server] Erro no servidor:', err.message);
      }
    });
  });
}

startServer();
