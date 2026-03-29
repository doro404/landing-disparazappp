'use strict';
const { chromium } = require('playwright-core');

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // 1. Tags page
  console.log('=== Tags page ===');
  await page.goto('https://gruposwpp.com.br/tags/animes', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  const cards = await page.evaluate(() => {
    return [...document.querySelectorAll('section a[href^="/groups/"]')].map(a => ({
      href: a.href,
      name: a.querySelector('h3')?.textContent?.trim() || '',
      category: a.querySelector('span')?.textContent?.trim() || '',
    })).filter((v,i,arr) => arr.findIndex(x=>x.href===v.href)===i).slice(0,5);
  });
  console.log('Cards found:', cards.length);
  console.log('Sample:', JSON.stringify(cards.slice(0,3), null, 2));

  // Check pagination
  const pagination = await page.evaluate(() => {
    return [...document.querySelectorAll('a')].map(a => ({ text: a.textContent.trim().slice(0,30), href: a.href }))
      .filter(l => l.href.includes('page') || l.text.match(/próx|next|2|3/i));
  });
  console.log('Pagination:', pagination.slice(0,5));

  // 2. Group page
  if (cards[0]) {
    console.log('\n=== Group page:', cards[0].href);

    // Intercept ALL requests and responses
    const allRequests = [];
    const allResponses = [];
    page.on('request', r => allRequests.push({ url: r.url(), method: r.method(), postData: r.postData() }));
    page.on('response', async r => {
      const url = r.url();
      if (url.includes('api') || url.includes('group') || url.includes('join') || url.includes('link') || url.includes('whatsapp')) {
        try {
          const body = await r.text().catch(() => '');
          allResponses.push({ url, status: r.status(), body: body.slice(0, 300) });
        } catch {}
      }
    });

    await page.goto(cards[0].href, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    const hasCF = (await page.content()).includes('turnstile') || (await page.content()).includes('cf-challenge');
    console.log('Has Cloudflare Turnstile:', hasCF);

    // Button info
    const btnInfo = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('Entrar'));
      return btns.map(b => ({
        text: b.textContent.trim().slice(0,50),
        disabled: b.disabled,
        onclick: b.getAttribute('onclick'),
        'data-*': Object.fromEntries([...b.attributes].map(a => [a.name, a.value])),
      }));
    });
    console.log('Buttons:', JSON.stringify(btnInfo, null, 2));

    // Check all links in page
    const allLinks = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h.includes('chat.whatsapp') || h.includes('invite'))
    );
    console.log('Invite links in DOM:', allLinks);

    // Check page source for hidden data
    const content = await page.content();
    const waMatches = [...content.matchAll(/chat\.whatsapp\.com\/([A-Za-z0-9_-]{10,})/g)].map(m => m[0]);
    console.log('WA in page content before click:', waMatches);

    // Check for data attributes or JSON in page
    const jsonData = await page.evaluate(() => {
      const scripts = [...document.querySelectorAll('script:not([src])')];
      return scripts.map(s => s.textContent?.slice(0, 200)).filter(t => t && (t.includes('chat.whatsapp') || t.includes('invite') || t.includes('groupLink') || t.includes('group_link')));
    });
    console.log('Script data with WA/invite:', jsonData);

    // Click button and wait for network
    console.log('\n--- Clicking "Entrar no Grupo" ---');
    await page.click('button:has-text("Entrar no Grupo")').catch(e => console.log('click err:', e.message));
    await page.waitForTimeout(3000);

    console.log('URL after click:', page.url());

    // WA links after click
    const waAfter = await page.evaluate(() =>
      [...document.querySelectorAll('a[href*="chat.whatsapp"]')].map(a => a.href)
    );
    console.log('WA links after click:', waAfter);

    const contentAfter = await page.content();
    const waMatchesAfter = [...contentAfter.matchAll(/chat\.whatsapp\.com\/([A-Za-z0-9_-]{10,})/g)].map(m => m[0]);
    console.log('WA in page content after click:', waMatchesAfter);

    // Show relevant requests made after click
    console.log('\nAll API/group requests:', JSON.stringify(allRequests.filter(r => r.url.includes('api') || r.url.includes('group') || r.url.includes('join') || r.url.includes('link')), null, 2));
    console.log('\nAll relevant responses:', JSON.stringify(allResponses, null, 2));
  }

  await browser.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
