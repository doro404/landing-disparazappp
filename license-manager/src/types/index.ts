export interface CreateLicenseInput {
  productSlug: string;
  maxMachines?: number;
  expiresAt?: string;       // ISO date string
  expiresInDays?: number;
  entitlements?: string[];
  metadata?: Record<string, unknown>;
  customerEmail?: string;
  customerName?: string;
  orderId?: string;
  notes?: string;
}

export interface ActivateInput {
  key: string;
  fingerprint: string;      // raw HWID from client
}

export interface ValidateInput {
  key: string;
  fingerprint?: string;
}

export interface RevokeInput {
  key: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
