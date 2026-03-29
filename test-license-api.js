/**
 * Script de teste para a API de licenças
 * Testa o servidor e mostra as respostas
 */

const LICENSE_API = 'https://license-manager.discloud.app/api/v1';
const TEST_KEY = '6HWJ-K8SG-VK3F-7RQM';

async function testValidate() {
  console.log('\n=== TESTE 1: Validar chave real ===\n');
  try {
    const response = await fetch(
      `${LICENSE_API}/licenses/validate?key=${encodeURIComponent(TEST_KEY)}&fingerprint=test-fp&stableFp=stable&volatileFp=volatile`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Erro:', e.message);
  }
}

async function testActivate() {
  console.log('\n=== TESTE 2: Ativar com chave real ===\n');
  try {
    const response = await fetch(`${LICENSE_API}/licenses/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: TEST_KEY,
        fingerprint: { combined: 'test-fp', stable: 'stable', volatile: 'volatile' },
        product: 'supersrb',
      }),
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Erro:', e.message);
  }
}

async function testHeartbeat() {
  console.log('\n=== TESTE 3: Heartbeat com chave real ===\n');
  try {
    const response = await fetch(`${LICENSE_API}/licenses/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: TEST_KEY,
        fingerprint: { combined: 'test-fp', stable: 'stable', volatile: 'volatile' },
        product: 'supersrb',
      }),
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Erro:', e.message);
  }
}

async function main() {
  console.log('🔍 Testando API de Licenças com chave real...');
  console.log(`📡 Servidor: ${LICENSE_API}`);
  console.log(`🔑 Chave: ${TEST_KEY}\n`);

  await testValidate();
  await testActivate();
  await testHeartbeat();

  console.log('\n✅ Testes concluídos!');
}

main();
