'use strict';

/**
 * groups-scraper.js — Busca grupos públicos do WhatsApp via Playwright + Firestore REST
 *
 * Fontes:
 *  1. gruposwpp.com.br  — Tags page com Playwright, link WA via Firestore REST API
 *  2. whatgrouplinks.org  — WordPress, links WA diretos nos posts
 *  3. cheetahgroups.com   — WordPress, mesma estrutura
 */

const { chromium } = require('playwright-core');
const https = require('https');

// ─── Firebase config (extraída do site gruposwpp.com.br) ─────────────────────
const FIREBASE_PROJECT = 'grupos-wpp-br';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

// ─── Funções serializadas (new Function pattern — esbuild safe) ───────────────

// gruposwpp.com.br: extrai cards da página de tags
const EXTRACT_GRUPOSWPP_CARDS_FN = `function() {
  var seen = {};
  var result = [];
  var links = document.querySelectorAll('section a[href^="/groups/"], a[href^="/groups/"]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var href = a.href || '';
    if (!href || seen[href]) continue;
    seen[href] = true;
    var h3 = a.querySelector('h3');
    var span = a.querySelector('span');
    var slug = href.replace(/.*\\/groups\\//, '');
    if (!slug) continue;
    result.push({
      slug: slug,
      href: href,
      name: h3 ? h3.textContent.trim() : slug,
      category: span ? span.textContent.trim() : '',
    });
  }
  return result;
}`;

// gruposwpp.com.br: verifica se há próxima página
const EXTRACT_GRUPOSWPP_NEXT_FN = `function() {
  var links = document.querySelectorAll('a[href]');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].href || '';
    var text = links[i].textContent.trim();
    if (href.includes('/tags/') && href.includes('page') && (text === '>' || text.toLowerCase().includes('próx') || text.toLowerCase().includes('next'))) {
      return href;
    }
  }
  // Tenta padrão numérico: se URL atual é /tags/X/page/N, próxima é /tags/X/page/N+1
  return null;
}`;

// WordPress: extrai links de posts da página de busca
const EXTRACT_WP_POST_LINKS_FN = `function() {
  var found = [];
  var selectors = ['article a[href]', 'h2 a[href]', 'h3 a[href]', '.entry-title a', '.post-title a', '.elementor-post__title a'];
  for (var si = 0; si < selectors.length; si++) {
    var els = document.querySelectorAll(selectors[si]);
    for (var i = 0; i < els.length; i++) {
      var h = els[i].href || '';
      if (!h || h.includes('#')) continue;
      if (h.match(/\\.(png|jpg|jpeg|gif|webp|svg|css|js|xml|ico)$/i)) continue;
      if (h.includes('/feed/') || h.includes('/wp-json/') || h.includes('/wp-content/')) continue;
      if (found.indexOf(h) === -1) found.push(h);
    }
  }
  return found.slice(0, 30);
}`;

// WordPress: extrai links chat.whatsapp.com de uma página de post
const EXTRACT_WA_LINKS_FN = `function() {
  var found = [];
  var all = document.querySelectorAll('a[href]');
  for (var i = 0; i < all.length; i++) {
    var h = all[i].href || '';
    if (h.includes('chat.whatsapp.com/')) {
      var match = h.match(/chat\\.whatsapp\\.com\\/([A-Za-z0-9_-]{10,})/);
      if (match) found.push('https://chat.whatsapp.com/' + match[1]);
      continue;
    }
    if (h.includes('link=https')) {
      var decoded = decodeURIComponent(h);
      var wMatch = decoded.match(/chat\\.whatsapp\\.com\\/([A-Za-z0-9_-]{10,})/);
      if (wMatch) found.push('https://chat.whatsapp.com/' + wMatch[1]);
    }
  }
  return Array.from(new Set(found));
}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function gotoSafe(page, url, onLog) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    return true;
  } catch {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      return true;
    } catch {
      onLog && onLog(`Timeout: ${url.slice(0, 60)}`, 'warn');
      return false;
    }
  }
}

// Fetch simples via https nativo (sem dependências extras)
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

// Busca o link WA de um grupo via Firestore REST
// Fluxo: slug → query groups where slug==X → docId → get groups/{docId}/private/info → inviteLink
async function getWaLinkFromFirestore(slug) {
  try {
    // 1. Query para achar o documento pelo slug
    const queryUrl = `${FIRESTORE_BASE}:runQuery`;
    const queryBody = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'groups' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'slug' },
            op: 'EQUAL',
            value: { stringValue: slug },
          },
        },
        limit: 1,
      },
    });

    const queryResult = await new Promise((resolve, reject) => {
      const url = new URL(queryUrl);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(queryBody) },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
      });
      req.on('error', reject);
      req.write(queryBody);
      req.end();
    });

    if (!queryResult || !Array.isArray(queryResult) || !queryResult[0]?.document?.name) return null;

    const docName = queryResult[0].document.name;
    const docId = docName.split('/').pop();

    // 2. Busca private/info do documento
    const privateUrl = `${FIRESTORE_BASE}/groups/${docId}/private/info`;
    const privateDoc = await fetchJson(privateUrl);

    if (!privateDoc?.fields) return null;

    // O campo pode ser inviteLink, invite_link, link, whatsappLink, etc.
    const fields = privateDoc.fields;
    for (const key of ['inviteLink', 'invite_link', 'link', 'whatsappLink', 'whatsapp_link', 'groupLink', 'group_link', 'url']) {
      const val = fields[key]?.stringValue;
      if (val && val.includes('chat.whatsapp.com/')) {
        const match = val.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]{10,})/);
        if (match) return `https://chat.whatsapp.com/${match[1]}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Fonte 1: gruposwpp.com.br ────────────────────────────────────────────────

async function scrapeGruposWpp(page, keyword, maxResults, seen, onGroup, onLog, signal) {
  onLog(`Buscando em gruposwpp.com.br: "${keyword}"`, 'info');

  let currentUrl = `https://gruposwpp.com.br/tags/${encodeURIComponent(keyword)}`;
  let pageNum = 1;

  while (currentUrl && seen.size < maxResults && !signal?.aborted) {
    onLog(`Página ${pageNum} — ${currentUrl.slice(0, 80)}`, 'info');

    const ok = await gotoSafe(page, currentUrl, onLog);
    if (!ok) break;

    const cards = await page.evaluate(new Function('return (' + EXTRACT_GRUPOSWPP_CARDS_FN + ')()'));

    if (cards.length === 0) {
      onLog('Nenhum grupo encontrado em gruposwpp.com.br', 'warn');
      break;
    }

    onLog(`${cards.length} grupos encontrados na página ${pageNum}`, 'info');

    for (const card of cards) {
      if (seen.size >= maxResults || signal?.aborted) break;

      const fakeKey = `gruposwpp:${card.slug}`;
      if (seen.has(fakeKey)) continue;

      // Tenta buscar link WA via Firestore REST
      const waLink = await getWaLinkFromFirestore(card.slug);

      if (waLink) {
        if (seen.has(waLink)) continue;
        seen.add(waLink);
        seen.add(fakeKey);
        const code = waLink.replace('https://chat.whatsapp.com/', '');
        onGroup({
          id: code,
          name: card.name,
          category: card.category,
          link: waLink,
          source: 'gruposwpp.com.br',
          status: 'unknown',
        });
        onLog(`✓ ${card.name} — ${waLink}`, 'success');
      } else {
        // Sem link WA — emite como site_only
        seen.add(fakeKey);
        onGroup({
          id: card.slug,
          name: card.name,
          category: card.category,
          link: card.href,
          source: 'gruposwpp.com.br',
          status: 'site_only',
        });
        onLog(`~ ${card.name} (sem link WA direto)`, 'warn');
      }
    }

    // Próxima página — tenta padrão /tags/{kw}/page/{n}
    const nextUrl = await page.evaluate(new Function('return (' + EXTRACT_GRUPOSWPP_NEXT_FN + ')()'));
    if (nextUrl) {
      currentUrl = nextUrl;
    } else {
      // Tenta construir URL de próxima página manualmente
      const pageMatch = currentUrl.match(/\/page\/(\d+)$/);
      if (pageMatch) {
        currentUrl = currentUrl.replace(/\/page\/\d+$/, `/page/${parseInt(pageMatch[1]) + 1}`);
      } else if (cards.length >= 10) {
        currentUrl = `https://gruposwpp.com.br/tags/${encodeURIComponent(keyword)}/page/${pageNum + 1}`;
      } else {
        break;
      }
    }
    pageNum++;
  }
}

// ─── Fontes 2 & 3: WordPress scrapers ────────────────────────────────────────

const WP_SOURCES = [
  {
    name: 'whatgrouplinks.org',
    searchUrl: (kw) => `https://whatgrouplinks.org/?s=${encodeURIComponent(kw)}`,
    nextPage: (url, page) => `${url}&paged=${page}`,
  },
  {
    name: 'cheetahgroups.com',
    searchUrl: (kw) => `https://cheetahgroups.com/?s=${encodeURIComponent(kw)}`,
    nextPage: (url, page) => `${url}&paged=${page}`,
  },
];

async function scrapeWordPress(page, source, keyword, maxResults, seen, onGroup, onLog, signal) {
  const searchUrl = source.searchUrl(keyword);
  onLog(`Buscando em ${source.name}: "${keyword}"`, 'info');

  let pageNum = 1;
  let hasMore = true;

  while (hasMore && seen.size < maxResults && !signal?.aborted) {
    const url = pageNum === 1 ? searchUrl : source.nextPage(searchUrl, pageNum);
    onLog(`Página ${pageNum} — ${url.slice(0, 70)}...`, 'info');

    const ok = await gotoSafe(page, url, onLog);
    if (!ok) break;

    const postLinks = await page.evaluate(new Function('return (' + EXTRACT_WP_POST_LINKS_FN + ')()'));

    if (postLinks.length === 0) {
      onLog(`Nenhum post encontrado em ${source.name} página ${pageNum}`, 'warn');
      break;
    }

    onLog(`${postLinks.length} posts encontrados na página ${pageNum}`, 'info');

    for (const postUrl of postLinks) {
      if (seen.size >= maxResults || signal?.aborted) break;

      try {
        const ok2 = await gotoSafe(page, postUrl, null);
        if (!ok2) continue;

        const waLinks = await page.evaluate(new Function('return (' + EXTRACT_WA_LINKS_FN + ')()'));
        const title = await page.evaluate(new Function('return (function(){ return document.title || ""; })()'));

        for (const link of waLinks) {
          if (seen.size >= maxResults || signal?.aborted) break;
          if (seen.has(link)) continue;
          seen.add(link);

          const code = link.replace('https://chat.whatsapp.com/', '');
          const name = title
            ? title.replace(/\s*[-|–|·]\s*.*$/, '').trim() || `Grupo — ${code.slice(0, 8)}`
            : `Grupo — ${code.slice(0, 8)}`;

          onGroup({ id: code, name, link, source: source.name, status: 'unknown' });
          onLog(`✓ ${name} — ${link}`, 'success');
        }
      } catch { /* post inacessível */ }
    }

    pageNum++;
    if (postLinks.length < 5) hasMore = false;
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function scrapeWhatsAppGroups(keyword, location, maxResults, onGroup, onLog, signal) {
  onLog('Abrindo navegador...', 'info');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  if (signal) signal.addEventListener('abort', () => browser.close().catch(() => {}));

  const seen = new Set();

  try {
    // Fonte primária: gruposwpp.com.br (Firestore REST para links WA)
    await scrapeGruposWpp(page, keyword, maxResults, seen, onGroup, onLog, signal);

    // Fontes WordPress como fallback se ainda não atingiu o máximo
    for (const source of WP_SOURCES) {
      if (seen.size >= maxResults || signal?.aborted) break;
      await scrapeWordPress(page, source, keyword, maxResults, seen, onGroup, onLog, signal);
    }

    onLog(`Busca concluída. ${seen.size} grupos encontrados.`, 'success');
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = { scrapeWhatsAppGroups };
