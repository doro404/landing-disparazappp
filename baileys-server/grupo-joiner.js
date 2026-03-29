'use strict';

/**
 * grupo-joiner.js
 * Módulo para entrar automaticamente em grupos do WhatsApp via Baileys.
 * Anti-ban: delays randômicos, limite por hora, retry com backoff exponencial.
 *
 * @module grupo-joiner
 */

// ─── Tipos (JSDoc) ────────────────────────────────────────────────────────────

/**
 * @typedef {'processing'|'success'|'failed'|'retrying'} ProgressStatus
 *
 * @typedef {{ index: number, link: string, status: ProgressStatus, message?: string }} JoinProgress
 *
 * @typedef {'joined'|'already_member'|'invalid'|'full'|'request_sent'|'rate_limit'|'error'} JoinStatus
 *
 * @typedef {{
 *   link: string,
 *   code: string | null,
 *   groupId?: string,
 *   groupName?: string,
 *   memberCount?: number,
 *   status: JoinStatus,
 *   errorMessage?: string,
 *   timestamp: Date
 * }} JoinResult
 *
 * @typedef {{
 *   maxJoinsPerHour?: number,
 *   delayMinMs?: number,
 *   delayMaxMs?: number,
 *   maxRetries?: number,
 *   onProgress?: (update: JoinProgress) => void
 * }} JoinOptions
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrai o código de convite de uma URL ou código puro.
 * @param {string} urlOrCode
 * @returns {string | null}
 */
function extractInviteCode(urlOrCode) {
  if (!urlOrCode || typeof urlOrCode !== 'string') return null;
  const trimmed = urlOrCode.trim();

  // URL completa: https://chat.whatsapp.com/CODIGO
  const match = trimmed.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]{10,})/);
  if (match) return match[1];

  // Código puro (só alfanumérico, sem espaços)
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;

  return null;
}

/**
 * Delay randômico entre min e max ms.
 * @param {number} min
 * @param {number} max
 * @returns {Promise<void>}
 */
function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Backoff exponencial: 2^attempt * base (com jitter).
 * @param {number} attempt  (0-indexed)
 * @param {number} baseMs
 * @returns {Promise<void>}
 */
function backoffDelay(attempt, baseMs = 5000) {
  const ms = Math.min(baseMs * Math.pow(2, attempt) + Math.random() * 2000, 60000);
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Classifica o erro do Baileys em um JoinStatus.
 * @param {Error|unknown} err
 * @returns {{ status: JoinStatus, message: string }}
 */
function classifyError(err) {
  const msg = (err?.message || String(err)).toLowerCase();

  if (msg.includes('bad-request') || msg.includes('invalid') || msg.includes('404') || msg.includes('gone')) {
    return { status: 'invalid', message: 'Link inválido ou expirado' };
  }
  if (msg.includes('not-authorized') || msg.includes('forbidden')) {
    return { status: 'invalid', message: 'Acesso negado ao grupo' };
  }
  if (msg.includes('already') || msg.includes('participant')) {
    return { status: 'already_member', message: 'Já é membro do grupo' };
  }
  if (msg.includes('full') || msg.includes('size')) {
    return { status: 'full', message: 'Grupo cheio' };
  }
  if (msg.includes('request') || msg.includes('approval')) {
    return { status: 'request_sent', message: 'Solicitação enviada (grupo com aprovação)' };
  }
  if (msg.includes('rate') || msg.includes('429') || msg.includes('too many')) {
    return { status: 'rate_limit', message: 'Rate limit atingido' };
  }
  if (msg.includes('connection') || msg.includes('timeout') || msg.includes('econnreset')) {
    return { status: 'rate_limit', message: 'Erro de conexão (retry possível)' };
  }

  return { status: 'error', message: err?.message || String(err) };
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Entra em uma lista de grupos do WhatsApp via Baileys.
 *
 * @param {import('@whiskeysockets/baileys').WASocket} sock  Socket Baileys conectado
 * @param {string[]} inviteLinks                             Array de URLs ou códigos puros
 * @param {JoinOptions} [options]
 * @returns {Promise<JoinResult[]>}
 *
 * @example
 * const results = await joinGroupsFromLinks(sock, [
 *   'https://chat.whatsapp.com/ABC123DEF456XYZ',
 *   'XYZ789GHI012JKL',
 * ], {
 *   maxJoinsPerHour: 15,
 *   delayMinMs: 8000,
 *   delayMaxMs: 20000,
 *   onProgress: (upd) => console.log(`[${upd.index + 1}] ${upd.status}: ${upd.link}`),
 * });
 * console.log(results);
 */
async function joinGroupsFromLinks(sock, inviteLinks, options = {}) {
  const {
    maxJoinsPerHour = 20,
    delayMinMs      = 8000,
    delayMaxMs      = 25000,
    maxRetries      = 2,
    minMembers      = null,
    maxMembers      = null,
    groupType       = null,
    onProgress      = null,
    shouldPause     = null,   // () => boolean — se retornar true, pausa até retornar false
    shouldAbort     = null,   // () => boolean — se retornar true, aborta o loop
  } = options;

  if (!sock) throw new Error('[grupo-joiner] sock é obrigatório');
  if (!Array.isArray(inviteLinks) || inviteLinks.length === 0) return [];

  /** @type {JoinResult[]} */
  const results = [];

  // Contador de joins na hora atual (anti-ban)
  let joinsThisHour = 0;
  let hourWindowStart = Date.now();

  const resetHourIfNeeded = () => {
    if (Date.now() - hourWindowStart >= 3_600_000) {
      joinsThisHour = 0;
      hourWindowStart = Date.now();
    }
  };

  const waitForHourReset = async () => {
    const elapsed = Date.now() - hourWindowStart;
    const remaining = 3_600_000 - elapsed;
    console.log(`[grupo-joiner] Limite de ${maxJoinsPerHour} joins/hora atingido. Aguardando ${Math.ceil(remaining / 60000)} min...`);
    await new Promise(r => setTimeout(r, remaining + 1000));
    joinsThisHour = 0;
    hourWindowStart = Date.now();
  };

  for (let i = 0; i < inviteLinks.length; i++) {
    // Abort check
    if (shouldAbort?.()) {
      console.log(`[grupo-joiner] Abortado no índice ${i}`);
      break;
    }

    // Pause check — espera até retomar
    while (shouldPause?.()) {
      await new Promise(r => setTimeout(r, 500));
    }

    const link = inviteLinks[i].trim();
    const code = extractInviteCode(link);

    // Código inválido — nem tenta
    if (!code) {
      console.log(`[grupo-joiner] [${i + 1}/${inviteLinks.length}] Código inválido: "${link}"`);
      onProgress?.({ index: i, link, status: 'failed', message: 'Código não reconhecido' });
      results.push({ link, code: null, status: 'invalid', errorMessage: 'Código não reconhecido', timestamp: new Date() });
      continue;
    }

    // Verifica limite por hora
    resetHourIfNeeded();
    if (joinsThisHour >= maxJoinsPerHour) {
      await waitForHourReset();
    }

    onProgress?.({ index: i, link, status: 'processing' });
    console.log(`[grupo-joiner] [${i + 1}/${inviteLinks.length}] Processando: ${code}`);

    let attempt = 0;
    let joined = false;

    while (attempt <= maxRetries && !joined) {
      if (attempt > 0) {
        onProgress?.({ index: i, link, status: 'retrying', message: `Tentativa ${attempt + 1}/${maxRetries + 1}` });
        console.log(`[grupo-joiner] Retry ${attempt}/${maxRetries} para ${code}`);
        await backoffDelay(attempt - 1);
      }

      try {
        // 1. Valida e pega metadata antes de entrar
        let groupName = '';
        let memberCount = 0;
        try {
          const info = await sock.groupGetInviteInfo(code);
          groupName   = info?.subject || '';
          memberCount = info?.size ?? info?.participants?.length ?? 0;
          // announce=true → só admins enviam (grupo fechado)
          const isClosed = !!(info?.announce);
          console.log(`[grupo-joiner] Info: "${groupName}" — ${memberCount} membros — ${isClosed ? 'fechado' : 'aberto'}`);

          // Filtro de membros
          if (memberCount > 0) {
            if (minMembers !== null && memberCount < minMembers) {
              const msg = `Pulado: ${memberCount} membros < mínimo ${minMembers}`;
              console.log(`[grupo-joiner] ${code} → ${msg}`);
              onProgress?.({ index: i, link, status: 'failed', message: msg });
              results.push({ link, code, groupName, memberCount, status: 'skipped_members', errorMessage: msg, timestamp: new Date() });
              joined = true;
              break;
            }
            if (maxMembers !== null && memberCount > maxMembers) {
              const msg = `Pulado: ${memberCount} membros > máximo ${maxMembers}`;
              console.log(`[grupo-joiner] ${code} → ${msg}`);
              onProgress?.({ index: i, link, status: 'failed', message: msg });
              results.push({ link, code, groupName, memberCount, status: 'skipped_members', errorMessage: msg, timestamp: new Date() });
              joined = true;
              break;
            }
          }

          // Filtro de tipo (aberto/fechado)
          if (groupType === 'open' && isClosed) {
            const msg = `Pulado: grupo fechado (só admins enviam)`;
            console.log(`[grupo-joiner] ${code} → ${msg}`);
            onProgress?.({ index: i, link, status: 'failed', message: msg });
            results.push({ link, code, groupName, memberCount, status: 'skipped_type', errorMessage: msg, timestamp: new Date() });
            joined = true;
            break;
          }
          if (groupType === 'closed' && !isClosed) {
            const msg = `Pulado: grupo aberto (qualquer um envia)`;
            console.log(`[grupo-joiner] ${code} → ${msg}`);
            onProgress?.({ index: i, link, status: 'failed', message: msg });
            results.push({ link, code, groupName, memberCount, status: 'skipped_type', errorMessage: msg, timestamp: new Date() });
            joined = true;
            break;
          }
        } catch (infoErr) {
          const { status } = classifyError(infoErr);
          // Se o link já é inválido na fase de info, não adianta tentar entrar
          if (status === 'invalid') {
            const msg = `Link inválido/expirado (info): ${infoErr?.message}`;
            console.log(`[grupo-joiner] ${code} → ${msg}`);
            onProgress?.({ index: i, link, status: 'failed', message: msg });
            results.push({ link, code, status: 'invalid', errorMessage: msg, timestamp: new Date() });
            joined = true; // sai do loop de retry
            break;
          }
          // Outros erros na fase de info: continua tentando entrar mesmo assim
          console.log(`[grupo-joiner] Aviso ao buscar info de ${code}: ${infoErr?.message}`);
        }

        // 2. Pequeno delay antes de entrar (simula comportamento humano)
        await randomDelay(1500, 4000);

        // 3. Entra no grupo
        const groupId = await sock.groupAcceptInvite(code);

        joinsThisHour++;
        joined = true;

        console.log(`[grupo-joiner] ✓ Entrou em "${groupName || code}" (${groupId}) — ${joinsThisHour}/${maxJoinsPerHour} joins esta hora`);
        onProgress?.({ index: i, link, status: 'success', message: groupName || groupId });
        results.push({
          link, code, groupId, groupName, memberCount,
          status: 'joined',
          timestamp: new Date(),
        });

      } catch (err) {
        const { status, message } = classifyError(err);

        // Erros definitivos — não faz retry
        const definitive = ['invalid', 'already_member', 'full', 'request_sent'];
        if (definitive.includes(status)) {
          console.log(`[grupo-joiner] ${code} → ${status}: ${message}`);
          onProgress?.({ index: i, link, status: status === 'already_member' ? 'success' : 'failed', message });
          results.push({ link, code, status, errorMessage: message, timestamp: new Date() });
          joined = true;
          break;
        }

        // Rate limit ou erro de conexão — retry
        attempt++;
        if (attempt > maxRetries) {
          console.log(`[grupo-joiner] ${code} → falhou após ${maxRetries + 1} tentativas: ${message}`);
          onProgress?.({ index: i, link, status: 'failed', message });
          results.push({ link, code, status, errorMessage: message, timestamp: new Date() });
        }
      }
    }

    // Delay entre joins (exceto no último)
    if (i < inviteLinks.length - 1 && !shouldAbort?.()) {
      const delayMs = Math.floor(Math.random() * (delayMaxMs - delayMinMs + 1)) + delayMinMs;
      console.log(`[grupo-joiner] Aguardando ${(delayMs / 1000).toFixed(1)}s antes do próximo...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  const summary = {
    total:          results.length,
    joined:         results.filter(r => r.status === 'joined').length,
    already_member: results.filter(r => r.status === 'already_member').length,
    invalid:        results.filter(r => r.status === 'invalid').length,
    failed:         results.filter(r => ['error', 'rate_limit', 'full'].includes(r.status)).length,
  };
  console.log(`[grupo-joiner] Concluído:`, summary);

  return results;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { joinGroupsFromLinks, extractInviteCode };
