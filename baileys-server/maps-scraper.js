'use strict';

/**
 * maps-scraper.js — Scraping do Google Maps via Playwright
 * Extrai dados diretamente dos cards da lista (sem abrir cada lugar).
 * NOTA: page.evaluate() usa strings para evitar problemas de serialização com esbuild.
 */

const { chromium } = require('playwright-core');

// Função de extração como STRING — imune a minificação do esbuild
const EXTRACT_CARDS_FN = `() => {
  const articles = document.querySelectorAll('[role="feed"] [role="article"]');
  return Array.from(articles).map(function(article) {
    var nameEl = article.querySelector('.qBF1Pd');
    var name = nameEl ? (nameEl.textContent || '').trim() : '';

    var phoneEl = article.querySelector('.UsdlK');
    var phone = phoneEl ? (phoneEl.textContent || '').trim() : '';

    var ratingEl = article.querySelector('.MW4etd');
    var rating = ratingEl ? (ratingEl.textContent || '').trim().replace(',', '.') : '';

    var reviewsEl = article.querySelector('.UY7F9');
    var reviews = reviewsEl ? (reviewsEl.textContent || '').trim().replace(/[()]/g, '') : '';

    var websiteEl = article.querySelector('a.lcr4fd');
    var website = websiteEl ? (websiteEl.getAttribute('href') || '') : '';

    var infoRows = article.querySelectorAll('.W4Efsd .W4Efsd');
    var address = '';
    var category = '';
    if (infoRows.length > 0) {
      var spans = infoRows[0].querySelectorAll('span > span');
      if (spans.length > 0) category = (spans[0].textContent || '').trim();
      var allSpans = Array.from(infoRows[0].querySelectorAll('span'));
      var addrSpan = allSpans.filter(function(s) {
        return !s.querySelector('span') && (s.textContent || '').trim() && !s.getAttribute('aria-hidden');
      }).pop();
      address = addrSpan ? (addrSpan.textContent || '').trim() : '';
    }

    return { name: name, phone: phone, rating: rating, reviews: reviews, website: website, address: address, category: category };
  }).filter(function(c) { return c.name; });
}`;

const SCROLL_FEED_FN = `() => {
  var feed = document.querySelector('[role="feed"]');
  if (!feed) return false;
  var before = feed.scrollTop;
  feed.scrollTop = feed.scrollHeight;
  return feed.scrollTop !== before;
}`;

async function scrapeGoogleMaps(keyword, location, maxResults, onLead, onLog, signal, { minRating = 0, categoryFilter = '' } = {}) {
  const query = `${keyword} em ${location}`;
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=pt-BR`;

  onLog('Abrindo navegador...', 'info');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  if (signal) signal.addEventListener('abort', () => browser.close().catch(() => {}));

  try {
    onLog(`Buscando: "${query}"`, 'info');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Aceita cookies se aparecer
    try {
      await page.click('button:has-text("Aceitar tudo")', { timeout: 3000 });
    } catch { /* sem popup */ }

    // Aguarda o feed de resultados
    await page.waitForSelector('[role="feed"]', { timeout: 15000 });
    onLog('Resultados carregados, extraindo dados...', 'info');

    const seen = new Set();
    let noNewCount = 0;

    while (seen.size < maxResults && noNewCount < 5) {
      if (signal?.aborted) break;

      // Usa string para evitar problema de serialização com esbuild
      const cards = await page.evaluate(new Function('return (' + EXTRACT_CARDS_FN + ')()'))

      let newThisBatch = 0;
      for (const card of cards) {
        if (seen.size >= maxResults || signal?.aborted) break;
        if (!card.name || seen.has(card.name)) continue;
        // Apply filters
        if (minRating > 0) {
          const r = parseFloat(card.rating);
          if (isNaN(r) || r < minRating) continue;
        }
        if (categoryFilter) {
          const cat = (card.category || '').toLowerCase();
          if (!cat.includes(categoryFilter.toLowerCase())) continue;
        }
        seen.add(card.name);
        newThisBatch++;
        onLead({
          name: card.name,
          phone: card.phone,
          website: card.website,
          address: card.address,
          rating: card.rating,
          reviews: card.reviews,
          category: card.category,
        });
        onLog(`✓ ${card.name}${card.phone ? ' — ' + card.phone : ''}`, 'success');
      }

      if (newThisBatch === 0) {
        noNewCount++;
      } else {
        noNewCount = 0;
      }

      if (seen.size >= maxResults) break;

      // Rola o feed — também como string
      const scrolled = await page.evaluate(new Function('return (' + SCROLL_FEED_FN + ')()'));

      if (!scrolled && noNewCount >= 2) break;

      await page.waitForTimeout(1500);
    }

    onLog(`Extração concluída. ${seen.size} leads coletados.`, 'success');
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = { scrapeGoogleMaps };
