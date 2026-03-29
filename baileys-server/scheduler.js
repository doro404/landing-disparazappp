'use strict';

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

let DATA_DIR;
if (process.env.DISPARA_DATA_DIR) {
  DATA_DIR = process.env.DISPARA_DATA_DIR;
} else if (process.pkg) {
  DATA_DIR = path.join(path.dirname(process.execPath), 'dispara-zapp-data');
} else {
  DATA_DIR = path.join(__dirname, 'dispara-zapp-data');
}
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');

// Referência para sessions e broadcast (injetados pelo index.js)
let _sessions = null;
let _broadcast = null;

// Map de tasks cron ativas: campaignId -> cron.ScheduledTask
const activeTasks = {};

// Set de campanhas canceladas mid-execution
const cancelledCampaigns = new Set();

// ─── Persistência ─────────────────────────────────────────────────────────────
function loadCampaigns() {
  try {
    if (fs.existsSync(CAMPAIGNS_FILE)) {
      return JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[scheduler] Erro ao carregar campanhas:', e.message);
  }
  return [];
}

function saveCampaigns(campaigns) {
  try {
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
  } catch (e) {
    console.error('[scheduler] Erro ao salvar campanhas:', e.message);
  }
}

// ─── Variáveis dinâmicas ──────────────────────────────────────────────────────
function substituteVars(text, extra = {}) {
  const now = new Date();
  return text
    .replace(/{nome}/g, extra.nome || extra.numero || '')
    .replace(/{numero}/g, extra.numero || '')
    .replace(/{hora}/g, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    .replace(/{data}/g, now.toLocaleDateString('pt-BR'))
    .replace(/{grupo}/g, extra.grupo || '')
    .replace(/{campanha}/g, extra.campanha || '');
}

// ─── Delay aleatório anti-ban ─────────────────────────────────────────────────
function randomDelay(min = 10000, max = 30000) {
  return new Promise((r) => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));
}

function formatPhone(number) {
  const clean = number.replace(/\D/g, '');
  // JID de grupo já vem completo (ex: 120363xxxxxxx@g.us)
  if (number.includes('@g.us')) return number;
  if (number.includes('@s.whatsapp.net')) return number;
  return `${clean}@s.whatsapp.net`;
}

// ─── Converter periodicidade para cron expression ─────────────────────────────
function buildCronExpression(schedule) {
  const { type, intervalValue, intervalUnit, dailyTime, weeklyDays, weeklyTime, monthlyDay, monthlyTime } = schedule;

  if (type === 'interval') {
    const v = parseInt(intervalValue) || 1;
    if (intervalUnit === 'minutes') return `*/${v} * * * *`;
    if (intervalUnit === 'hours')   return `0 */${v} * * *`;
    if (intervalUnit === 'days')    return `0 0 */${v} * *`;
  }

  if (type === 'daily') {
    const [h, m] = (dailyTime || '09:00').split(':');
    return `${parseInt(m)} ${parseInt(h)} * * *`;
  }

  if (type === 'weekly') {
    const days = (weeklyDays || [0]).join(',');
    const [h, m] = (weeklyTime || '09:00').split(':');
    return `${parseInt(m)} ${parseInt(h)} * * ${days}`;
  }

  if (type === 'monthly') {
    const day = parseInt(monthlyDay) || 1;
    const [h, m] = (monthlyTime || '09:00').split(':');
    return `${parseInt(m)} ${parseInt(h)} ${day} * *`;
  }

  return '0 9 * * *'; // fallback: todo dia 9h
}

// ─── Calcular próximo disparo ─────────────────────────────────────────────────
function getNextRun(cronExpr) {
  try {
    // Estimativa simples baseada na expressão
    const now = new Date();
    const parts = cronExpr.split(' ');
    if (parts.length !== 5) return null;
    return new Date(now.getTime() + 60000).toISOString(); // placeholder
  } catch {
    return null;
  }
}

// ─── Executar campanha ────────────────────────────────────────────────────────
async function executeCampaign(campaign) {
  const session = _sessions[campaign.sessionId];
  if (!session || session.status !== 'connected') {
    console.log(`[scheduler] Campanha "${campaign.name}": sessão ${campaign.sessionId} não conectada`);
    _broadcast('campaign_log', { id: campaign.id, level: 'warn', message: `Sessão ${campaign.sessionId} não conectada` });
    return;
  }

  const numbers = [...(campaign.numbers || [])];
  if (numbers.length === 0) {
    console.log(`[scheduler] Campanha "${campaign.name}": sem destinatários`);
    return;
  }

  // Verifica limite diário
  const today = new Date().toDateString();
  if (!campaign.dailySentCount) campaign.dailySentCount = {};
  if (campaign.dailySentCount.date !== today) {
    campaign.dailySentCount = { date: today, count: 0 };
  }
  const maxDaily = campaign.limitPerDay || 150;

  console.log(`[scheduler] Iniciando campanha "${campaign.name}" → ${numbers.length} destinatários`);
  _broadcast('campaign_start', { id: campaign.id, name: campaign.name, total: numbers.length });

  let sent = 0, failed = 0;

  for (let i = 0; i < numbers.length; i++) {
    // Verifica se campanha foi cancelada mid-execution
    if (cancelledCampaigns.has(campaign.id)) {
      cancelledCampaigns.delete(campaign.id);
      _broadcast('campaign_log', { id: campaign.id, level: 'warn', message: 'Campanha interrompida pelo usuário' });
      console.log(`[scheduler] Campanha "${campaign.name}" interrompida`);
      break;
    }

    if (campaign.dailySentCount.count >= maxDaily) {
      _broadcast('campaign_log', { id: campaign.id, level: 'warn', message: `Limite diário atingido (${maxDaily})` });
      break;
    }

    const number = numbers[i];
    try {
      const jid = formatPhone(number);
      const isGroup = jid.endsWith('@g.us');
      const text = substituteVars(campaign.message, {
        numero: number.replace(/\D/g, ''),
        campanha: campaign.name,
        grupo: isGroup ? (number.split('@')[0]) : '',
      });

      let message = {};
      if (campaign.media) {
        const buffer = Buffer.from(campaign.media, 'base64');
        if (campaign.mediaType === 'image')    message = { image: buffer, caption: text };
        else if (campaign.mediaType === 'video')    message = { video: buffer, caption: text };
        else if (campaign.mediaType === 'document') message = { document: buffer, mimetype: 'application/pdf', fileName: 'arquivo.pdf', caption: text };
        else message = { text };
      } else {
        message = { text };
      }

      const result = await session.sock.sendMessage(jid, message);
      if (!result || !result.key) {
        throw new Error('sendMessage retornou sem confirmação (possível falha silenciosa)');
      }
      sent++;
      campaign.dailySentCount.count++;

      const logMsg = `✓ [${campaign.name}] → ${jid} (id: ${result.key.id})`;
      console.log(`[scheduler] ${logMsg}`);
      _broadcast('campaign_progress', { id: campaign.id, index: i + 1, total: numbers.length, number, status: 'sent', sent, failed });

    } catch (err) {
      failed++;
      const logMsg = `✗ [${campaign.name}] → ${number}: ${err.message}`;
      console.error(`[scheduler] ${logMsg}`);
      _broadcast('campaign_progress', { id: campaign.id, index: i + 1, total: numbers.length, number, status: 'failed', sent, failed });
    }

    // Delay anti-ban entre envios (com check de cancelamento a cada 1s)
    if (i < numbers.length - 1) {
      const dMin = (campaign.delayMin || 10) * 1000;
      const dMax = (campaign.delayMax || 30) * 1000;
      const total = Math.floor(Math.random() * (dMax - dMin + 1)) + dMin;
      const step = 1000;
      let elapsed = 0;
      while (elapsed < total) {
        if (cancelledCampaigns.has(campaign.id)) break;
        await new Promise((r) => setTimeout(r, Math.min(step, total - elapsed)));
        elapsed += step;
      }
    }
  }

  // Atualiza lastRun e nextRun
  campaign.lastRun = new Date().toISOString();
  campaign.lastStats = { sent, failed, total: numbers.length };

  _broadcast('campaign_done', { id: campaign.id, name: campaign.name, sent, failed, total: numbers.length });
  console.log(`[scheduler] Campanha "${campaign.name}" concluída: ${sent} enviados, ${failed} falhas`);

  // Persiste estado atualizado
  const all = loadCampaigns();
  const idx = all.findIndex((c) => c.id === campaign.id);
  if (idx >= 0) { all[idx] = campaign; saveCampaigns(all); }
}

// ─── Agendar campanha ─────────────────────────────────────────────────────────
function scheduleCampaign(campaign) {
  // Remove task anterior se existir
  if (activeTasks[campaign.id]) {
    activeTasks[campaign.id].stop();
    delete activeTasks[campaign.id];
  }

  if (!campaign.enabled) return;

  const cronExpr = buildCronExpression(campaign.schedule);
  if (!cron.validate(cronExpr)) {
    console.error(`[scheduler] Expressão cron inválida para "${campaign.name}": ${cronExpr}`);
    return;
  }

  console.log(`[scheduler] Agendando "${campaign.name}" → cron: ${cronExpr}`);

  const task = cron.schedule(cronExpr, async () => {
    // Reler campanha do disco para pegar estado atual de enabled
    const all = loadCampaigns();
    const current = all.find((c) => c.id === campaign.id);
    if (!current || !current.enabled) return;
    await executeCampaign(current);
  }, { timezone: 'America/Sao_Paulo' });

  activeTasks[campaign.id] = task;
  campaign.cronExpr = cronExpr;
  campaign.status = 'running';
}

// ─── API pública ──────────────────────────────────────────────────────────────
function init(sessions, broadcast) {
  _sessions = sessions;
  _broadcast = broadcast;

  // Carrega e agenda campanhas salvas
  const campaigns = loadCampaigns();
  campaigns.forEach((c) => { if (c.enabled) scheduleCampaign(c); });
  console.log(`[scheduler] ${campaigns.length} campanhas carregadas`);
}

function getCampaigns() {
  return loadCampaigns().map((c) => ({
    ...c,
    status: activeTasks[c.id] ? 'running' : (c.enabled ? 'scheduled' : 'paused'),
    media: undefined, // não retorna mídia na listagem (pesada)
    hasMedia: !!c.media, // indica se tem mídia salva
  }));
}

function upsertCampaign(campaign) {
  const campaigns = loadCampaigns();
  const idx = campaigns.findIndex((c) => c.id === campaign.id);
  if (idx >= 0) {
    // Preserva mídia existente se a nova não trouxe (getCampaigns omite media na listagem)
    // null = usuário removeu intencionalmente; undefined = não foi enviado (preserva)
    if (campaign.media === undefined && campaigns[idx].media) {
      campaign.media = campaigns[idx].media;
      campaign.mediaType = campaigns[idx].mediaType;
    }
    campaigns[idx] = campaign;
  } else {
    campaigns.push(campaign);
  }
  saveCampaigns(campaigns);
  // Só agenda se o scheduler já foi inicializado
  if (_sessions) scheduleCampaign(campaign);
  return campaign;
}

function deleteCampaign(id) {
  if (activeTasks[id]) { activeTasks[id].stop(); delete activeTasks[id]; }
  const campaigns = loadCampaigns().filter((c) => c.id !== id);
  saveCampaigns(campaigns);
}

function toggleCampaign(id, enabled) {
  const campaigns = loadCampaigns();
  const c = campaigns.find((c) => c.id === id);
  if (!c) return null;
  c.enabled = enabled;
  saveCampaigns(campaigns);
  if (enabled) {
    cancelledCampaigns.delete(id); // limpa cancelamento anterior
    scheduleCampaign(c);
  } else {
    if (activeTasks[id]) { activeTasks[id].stop(); delete activeTasks[id]; c.status = 'paused'; }
    cancelledCampaigns.add(id); // interrompe execução em andamento
  }
  return c;
}

function runNow(id) {
  const campaigns = loadCampaigns();
  const c = campaigns.find((c) => c.id === id);
  if (c && c.enabled) executeCampaign(c).catch(console.error);
}

module.exports = { init, getCampaigns, upsertCampaign, deleteCampaign, toggleCampaign, runNow, buildCronExpression };
