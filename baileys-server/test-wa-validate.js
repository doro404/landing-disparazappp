'use strict';
const https = require('https');

function req(label, url) {
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const hasInvalid = d.includes('"invalid"') || d.includes('link is no longer valid') || d.includes('This invite link has expired');
        const hasValidBtn = d.includes('action-button') || d.includes('action-icon');
        const og = d.match(/og:title[^>]*content="([^"]+)"/);
        // Procura por dados JSON embutidos
        const dataMatch = d.match(/"groupInviteInfo":\s*(\{[^}]+\})/);
        const statusMatch = d.match(/"status":\s*"([^"]+)"/);
        console.log(label, res.statusCode);
        console.log('  has_invalid_text:', hasInvalid);
        console.log('  has_valid_button:', hasValidBtn);
        console.log('  og:title:', og ? og[1] : 'none');
        console.log('  status_in_json:', statusMatch ? statusMatch[1] : 'none');
        console.log('  data_match:', dataMatch ? dataMatch[1] : 'none');
        // Mostra trecho do HTML que pode diferenciar
        const bodySnippet = d.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500);
        console.log('  text_content:', bodySnippet);
        resolve();
      });
    }).on('error', e => { console.log(label, 'ERR', e.message); resolve(); });
  });
}

async function main() {
  await req('VALID', 'https://chat.whatsapp.com/HVcvc6JXdA6JjnCyBTc03d');
  console.log('---');
  await req('BAD',   'https://chat.whatsapp.com/XXXXXXXXXXXXXXXXXXXXXXXXXXX');
}

main();
