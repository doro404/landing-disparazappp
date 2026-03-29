# Super Robô Baileys

WhatsApp Automation Pro — Tauri 2.x + React 19 + Baileys 6.7.21

## Pré-requisitos

- Node.js 18+ e npm 9+
- Rust + Cargo (https://rustup.rs)
- Tauri CLI v2: `npm install -g @tauri-apps/cli@^2`
- (Windows) Microsoft C++ Build Tools ou Visual Studio 2022
- (Windows) WebView2 Runtime (já incluso no Windows 11)

## Instalação

### 1. Instalar dependências do frontend

```bash
cd SuperRoboBaileys
npm install
```

### 2. Instalar dependências do sidecar

```bash
cd baileys-server
npm install
cd ..
```

### 3. Compilar o sidecar (necessário antes do build final)

```bash
node scripts/build-sidecar.js
```

Isso gera `src-tauri/binaries/baileys-server-x86_64-pc-windows-msvc.exe`

## Desenvolvimento

```bash
npm run tauri:dev
```
npm run tauri:dev:fresh

O Tauri inicia o Vite dev server (porta 1420) e abre a janela do app.
O sidecar baileys-server é iniciado automaticamente na porta 3001.

> Em modo dev, o sidecar roda como processo Node.js separado.
> Para testar sem Tauri: `cd baileys-server && node index.js`

## Build para produção (.exe)

```bash
# 1. Compilar sidecar primeiro
node scripts/build-sidecar.js

# 2. Build Tauri
npm run tauri:build
```

O instalador `.exe` estará em `src-tauri/target/release/bundle/nsis/`

## Estrutura do projeto

```
SuperRoboBaileys/
├── src/                    # Frontend React 19 + TypeScript
│   ├── components/         # Componentes UI
│   ├── context/            # AppContext (estado global)
│   ├── hooks/              # useWebSocket
│   ├── lib/                # api.ts, utils.ts
│   └── types/              # Tipos TypeScript
├── src-tauri/              # Backend Rust/Tauri
│   ├── src/lib.rs          # Comandos Tauri + sidecar
│   ├── tauri.conf.json     # Configuração Tauri
│   └── binaries/           # Sidecar compilado (gerado)
├── baileys-server/         # Sidecar Node.js
│   └── index.js            # Express + WebSocket + Baileys 6.7.21
└── scripts/
    └── build-sidecar.js    # Script de compilação do sidecar
```

## Funcionalidades

- Multi-sessões (5 contas simultâneas)
- QR Code + Pairing Code
- Disparo em massa com delay anti-ban (1.2s–3.5s)
- Suporte a TXT/CSV/Excel para lista de números
- Envio com mídia (imagem, vídeo, PDF, sticker)
- Extração de participantes de grupos (+100 grupos)
- Auto-resposta IA (Ollama local ou Grok API)
- Relatórios CSV com status de entrega
- Log em tempo real (terminal embutido)
- Configurações de delay, limite por hora/dia, proxy

## Versões fixas

- `@whiskeysockets/baileys`: **6.7.21** (exato, sem ^)
- Tauri: 2.x
- React: 19.x
