'use strict';
const { chromium } = require('playwright-core');

const CHECK_WA_LINK_FN = `function() {
  var main = document.getElementById('main_block');
  var fallback = document.getElementById('fallback_block');
  var actionBtn = document.getElementById('action-button');
  var nameEl = main ? main.querySelector('h3') : null;
  var name = nameEl ? nameEl.textContent.trim() : '';
  if (main && main.style.display !== 'none' && actionBtn) {
    return { status: 'valid', name: name };
  }
  if (fallback && fallback.style.display !== 'none') {
    return { status: 'expired', name: '' };
  }
  return { status: 'unknown', name: '' };
}`;

async function check(link) {
  const code = link.replace('https://chat.whatsapp.com/', '');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();

  // Intercepta todas as respostas de rede
  const apiResponses = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('whatsapp') || url.includes('facebook') || url.includes('graph')) {
      try {
        const text = await response.text().catch(() => '');
        if (text && text.length < 5000 && (text.includes('{') || text.includes('['))) {
          apiResponses.push({ url: url.slice(0, 100), status: response.status(), body: text.slice(0, 300) });
        }
      } catch {}
    }
  });

  try {
    await page.goto(`https://chat.whatsapp.com/${code}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    console.log(link.slice(-12), '-> API responses:');
    apiResponses.forEach(r => console.log(' ', r.status, r.url, '\n   ', r.body.slice(0, 150)));
  } finally {
    await browser.close();
  }
}

async function main() {
  await check('https://chat.whatsapp.com/HVcvc6JXdA6JjnCyBTc03d'); // válido (do HTML que você colou)
  await check('https://chat.whatsapp.com/XXXXXXXXXXXXXXXXXXXXXXXXXXX'); // inválido
}

main().catch(console.error);
