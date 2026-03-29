/**
 * Compila o sidecar baileys-server:
 * 1. esbuild faz bundle de tudo num único index.bundle.cjs (resolve ESM->CJS)
 * 2. @yao-pkg/pkg empacota o bundle num executável standalone
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SIDECAR_DIR = path.join(ROOT, 'baileys-server');
const BINARIES_DIR = path.join(ROOT, 'src-tauri', 'binaries');
const BUNDLE = path.join(SIDECAR_DIR, 'index.bundle.cjs');

function getTargetTriple() {
  const p = process.platform, a = process.arch;
  if (p === 'win32')  return a === 'x64' ? 'x86_64-pc-windows-msvc' : 'aarch64-pc-windows-msvc';
  if (p === 'darwin') return a === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
  return a === 'x64' ? 'x86_64-unknown-linux-gnu' : 'aarch64-unknown-linux-gnu';
}

const triple = getTargetTriple();
const ext = process.platform === 'win32' ? '.exe' : '';
const outputPath = path.join(BINARIES_DIR, `baileys-server-${triple}${ext}`);

console.log(`[build-sidecar] Triple: ${triple}`);
console.log(`[build-sidecar] Output: ${outputPath}`);

if (!fs.existsSync(BINARIES_DIR)) fs.mkdirSync(BINARIES_DIR, { recursive: true });

// 1. Instalar deps
console.log('\n[1/3] Instalando dependências...');
execSync('npm install', { cwd: SIDECAR_DIR, stdio: 'inherit' });

// Garantir esbuild e @yao-pkg/pkg disponíveis
execSync('npm install --save-dev esbuild @yao-pkg/pkg', { cwd: SIDECAR_DIR, stdio: 'inherit' });

// 2. Bundle com esbuild (ESM -> CJS, tudo inline exceto módulos nativos)
console.log('\n[2/3] Bundlando com esbuild...');
execSync(
  `npx esbuild index.js` +
  ` --bundle` +
  ` --platform=node` +
  ` --target=node18` +
  ` --format=cjs` +
  ` --outfile=index.bundle.cjs` +
  ` --external:bufferutil` +       // módulos nativos .node — deixar externos
  ` --external:utf-8-validate` +
  ` --external:sharp` +
  ` --external:canvas` +
  ` --external:chromium-bidi` +    // playwright dependencies
  ` --external:playwright-core` +
  ` --log-level=warning`,
  { cwd: SIDECAR_DIR, stdio: 'inherit' }
);

// 3. Empacotar com pkg
console.log('\n[3/3] Empacotando com @yao-pkg/pkg...');
const nodeTarget = process.platform === 'win32' ? 'node18-win-x64' :
                   process.platform === 'darwin' ? 'node18-macos-x64' : 'node18-linux-x64';

execSync(
  `npx @yao-pkg/pkg index.bundle.cjs --targets ${nodeTarget} --output "${outputPath}"`,
  { cwd: SIDECAR_DIR, stdio: 'inherit' }
);

// Limpar bundle temporário
fs.unlinkSync(BUNDLE);

console.log(`\n[build-sidecar] ✓ Pronto: ${outputPath}`);
