# License Manager

Backend self-hosted de gerenciamento de licenças para softwares desktop (Tauri, Electron, etc.), inspirado no Keygen.sh Community Edition.

## Stack

- Node.js 20+ / TypeScript
- Express + Zod (validação)
- Prisma ORM + SQLite
- Ed25519 (`@noble/ed25519`) para assinatura criptográfica offline
- Helmet + CORS + Rate Limit

## Estrutura

```
license-manager/
├── prisma/
│   └── schema.prisma        # Modelos: Product, License, Activation
├── src/
│   ├── config/
│   │   ├── env.ts           # Variáveis de ambiente tipadas
│   │   └── prisma.ts        # Singleton PrismaClient
│   ├── middleware/
│   │   ├── adminAuth.ts     # Proteção por x-api-key
│   │   └── errorHandler.ts  # Handler global de erros
│   ├── routes/
│   │   ├── licenses.ts      # CRUD + ativação + validação
│   │   ├── products.ts      # Gerenciamento de produtos
│   │   ├── updates.ts       # Checagem de atualizações
│   │   └── health.ts        # Health check
│   ├── services/
│   │   ├── crypto.ts        # Geração de chaves Ed25519 + assinatura
│   │   ├── license.ts       # Regras de negócio de licenças
│   │   └── hwid.ts          # Normalização de fingerprint
│   ├── scripts/
│   │   ├── generateKeys.ts  # Gera par de chaves Ed25519
│   │   └── seed.ts          # Cria produto e licença de teste
│   └── index.ts             # Entry point (porta 8080)
├── .env.example
└── discloud.config
```

## Setup

```bash
# 1. Instalar dependências
npm install

# 2. Copiar e configurar variáveis de ambiente
cp .env.example .env

# 3. Gerar par de chaves Ed25519
npm run keys:generate
# Cole as chaves geradas no .env

# 4. Rodar migrations
npm run prisma:migrate

# 5. (Opcional) Criar produto e licença de teste
npm run seed

# 6. Iniciar em desenvolvimento
npm run dev
```

O servidor sobe em `http://localhost:8080`.

## Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `PORT` | Porta do servidor (padrão: `8080`) |
| `DATABASE_URL` | Caminho do SQLite (ex: `file:./dev.db`) |
| `ADMIN_API_KEY` | Chave para endpoints administrativos |
| `ED25519_PRIVATE_KEY` | Chave privada hex para assinar tokens |
| `ED25519_PUBLIC_KEY` | Chave pública hex (embed no cliente) |
| `CORS_ORIGINS` | Origins permitidas, separadas por vírgula (`*` para dev) |

## Endpoints

### Públicos

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Status do servidor |
| `POST` | `/api/v1/licenses/activate` | Ativar licença em uma máquina |
| `GET` | `/api/v1/licenses/validate` | Validar licença online |
| `POST` | `/api/v1/licenses/verify-token` | Verificar assinatura de token |
| `GET` | `/api/v1/updates` | Checar atualizações disponíveis |

### Admin (requer `x-api-key` header)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/v1/products` | Criar produto |
| `GET` | `/api/v1/products` | Listar produtos |
| `POST` | `/api/v1/licenses` | Criar licença |
| `POST` | `/api/v1/licenses/revoke` | Revogar licença |
| `POST` | `/api/v1/updates` | Publicar nova versão |

## Exemplos de Uso

### Criar produto (admin)

```bash
curl -X POST http://localhost:8080/api/v1/products \
  -H "Content-Type: application/json" \
  -H "x-api-key: sua-admin-key" \
  -d '{
    "slug": "meu-app",
    "name": "Meu App Desktop",
    "defaultMaxMachines": 2,
    "defaultTrialDays": 14
  }'
```

### Criar licença (admin)

```bash
curl -X POST http://localhost:8080/api/v1/licenses \
  -H "Content-Type: application/json" \
  -H "x-api-key: sua-admin-key" \
  -d '{
    "productSlug": "meu-app",
    "maxMachines": 2,
    "entitlements": ["pro", "feature-x"]
  }'
```

### Ativar licença (cliente)

```bash
curl -X POST http://localhost:8080/api/v1/licenses/activate \
  -H "Content-Type: application/json" \
  -d '{
    "key": "XXXX-XXXX-XXXX-XXXX",
    "fingerprint": "hwid-da-maquina"
  }'
```

Resposta:
```json
{
  "success": true,
  "data": {
    "payload": {
      "sub": "license-id",
      "key": "XXXX-XXXX-XXXX-XXXX",
      "product": "meu-app",
      "fingerprint": "sha256-do-hwid",
      "entitlements": ["pro", "feature-x"],
      "expiresAt": null,
      "iat": 1710000000
    },
    "signature": "hex-da-assinatura-ed25519"
  }
}
```

### Validar online

```bash
curl "http://localhost:8080/api/v1/licenses/validate?key=XXXX-XXXX-XXXX-XXXX&fingerprint=hwid"
```

## Verificação Offline no Cliente (Tauri/Electron)

O cliente recebe `{ payload, signature }` na ativação e pode verificar offline sem chamar o servidor:

```typescript
import * as ed from '@noble/ed25519';

const PUBLIC_KEY = 'cole-aqui-a-ED25519_PUBLIC_KEY-do-env'; // embed no app

async function verifyLicenseOffline(
  payload: object,
  signature: string
): Promise<boolean> {
  const message = new TextEncoder().encode(JSON.stringify(payload));
  const sig = Buffer.from(signature, 'hex');
  const pubKey = Buffer.from(PUBLIC_KEY, 'hex');
  return ed.verify(sig, message, pubKey);
}

// Uso
const { payload, signature } = JSON.parse(localStorage.getItem('license')!);
const valid = await verifyLicenseOffline(payload, signature);

// Checar expiração localmente
if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) {
  console.log('Licença expirada');
}
```

> A chave privada fica **somente no servidor**. O cliente embute apenas a chave pública.

## Scripts

```bash
npm run dev              # Dev com hot reload
npm run build            # Compila TypeScript
npm run start            # Roda build compilado
npm run keys:generate    # Gera novo par Ed25519
npm run seed             # Cria produto + licença de teste
npm run prisma:migrate   # Aplica migrations
npm run prisma:studio    # Abre Prisma Studio (GUI do banco)
```

## Deploy (Discloud)

O projeto já inclui `discloud.config` configurado. Basta zipar a pasta e fazer upload no painel da Discloud. A porta usada é `8080`.
