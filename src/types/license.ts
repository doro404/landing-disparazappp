// ─── Status ───────────────────────────────────────────────────────────────────

export type LicenseStatus =
  | 'initializing'       // app acabou de abrir, ainda não verificou nada
  | 'checking_fp'        // coletando fingerprint da máquina
  | 'validating_sig'     // verificando assinatura Ed25519 offline
  | 'online_pending'     // aguardando resposta do servidor
  | 'valid'              // licença válida e verificada
  | 'grace_period'       // expirou mas ainda dentro dos 5 dias de graça
  | 'activating'         // usuário submeteu chave, aguardando ativação
  | 'expired'            // expirou e grace period também passou
  | 'revoked'            // revogada pelo servidor
  | 'tampered'           // assinatura inválida / storage adulterado
  | 'invalid'            // sem token ou chave inválida
  | 'offline_grace'      // sem internet, usando cache dentro do grace period
  | 'trial';             // modo trial ativo (sem licença)

// ─── JWT-like payload ─────────────────────────────────────────────────────────

export interface LicensePayload {
  jti: string;           // unique token id (uuid)
  sub: string;           // license id
  key: string;           // license key
  product: string;       // product slug
  device_fp_hash: string;// sha256 do fingerprint da máquina
  entitlements: string[];
  exp: number;           // unix timestamp de expiração (0 = sem expiração)
  iat: number;           // unix timestamp de emissão
  nbf: number;           // not before (unix timestamp)
}

export interface StoredToken {
  payload: LicensePayload;
  signature: string;     // Ed25519 hex
  activatedAt: number;   // timestamp local da ativação
  lastOnlineCheck: number; // timestamp do último heartbeat bem-sucedido
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ActivateResponse {
  success: boolean;
  data?: {
    payload: LicensePayload;
    signature: string;
  };
  error?: string;
  code?: string;
}

export interface ValidateResponse {
  success: boolean;
  data?: {
    valid: boolean;
    reason?: string;
    grace?: boolean;
    license?: {
      id: string;
      key: string;
      product: string;
      maxMachines: number;
      activatedMachines: number;
      expiresAt: string | null;
      entitlements: string[];
    };
  };
  error?: string;
}

export interface HeartbeatResponse {
  success: boolean;
  data?: {
    valid: boolean;
    revoked?: boolean;
    grace?: boolean;
    reason?: string;
    newToken?: { payload: LicensePayload; signature: string };
  };
}

export interface TrialPayload extends LicensePayload {
  trial: true;
  sendsUsed: number;
  sendsLimit: number;
}

export interface TrialStartResponse {
  success: boolean;
  data?: {
    payload: TrialPayload;
    signature: string;
    trial: {
      id: string;
      productSlug: string;
      startedAt: string;
      expiresAt: string;
      sends: number;
      sendsLeft: number;
      exhausted: boolean;
      expired: boolean;
    };
  };
  error?: string;
  code?: string;
}

export interface TrialHeartbeatResponse {
  success: boolean;
  data?: {
    valid: boolean;
    sendsLeft: number;
    exhausted: boolean;
    payload?: TrialPayload;
    signature?: string;
  };
}

// ─── Hook return ──────────────────────────────────────────────────────────────

export interface LicenseInfo {
  status: LicenseStatus;
  key: string | null;
  entitlements: string[];
  expiresAt: number | null; // unix timestamp
  daysUntilExpiry: number | null;
  isGracePeriod: boolean;
  isTrial: boolean;
  trialSendsLeft: number;
  trialDaysLeft: number;
}

export interface UseLicenseReturn {
  info: LicenseInfo;
  activate: (key: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  recheck: () => Promise<void>;
  hasEntitlement: (flag: string) => boolean;
  startTrial: () => void;
}
