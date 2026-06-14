// All calls go through /api/admin/proxy so ADMIN_API_KEY stays server-side only
async function req<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch("/api/admin/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, method, body }),
  });

  const json = await res.json().catch(() => ({})) as { success?: boolean; data?: T; error?: string };

  if (!res.ok || json.success === false) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }

  // License Manager wraps responses in { success, data }
  return (json.data ?? json) as T;
}

export interface License {
  id: string;
  key: string;
  productSlug: string;
  maxMachines: number;
  status: "active" | "inactive" | "revoked";
  createdAt: string;
  expiresAt?: string | null;
  entitlements?: string[];
  customerEmail?: string | null;
  customerName?: string | null;
  orderId?: string | null;
  notes?: string | null;
  activations?: LicenseActivation[];
}

export interface LicenseActivation {
  id: string;
  fingerprint: string;
  stableFp?: string | null;
  volatileFp?: string | null;
  ip?: string | null;
  createdAt: string;
  lastSeen: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  defaultMaxMachines: number;
}

export interface CreateLicensePayload {
  productSlug: string;
  maxMachines?: number;
  entitlements?: string[];
  expiresInDays?: number;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  customerEmail?: string;
  customerName?: string;
  orderId?: string;
  notes?: string;
}

export interface Trial {
  id: string;
  fingerprint: string;
  productSlug: string;
  startedAt: string;
  expiresAt: string;
  sends: number;
  sendsLeft: number;
  exhausted: boolean;
  expired: boolean;
  ip?: string | null;
}

export interface AppUpdate {
  id: string;
  productSlug: string;
  version: string;
  target: string;
  arch: string;
  fileName: string;
  fileSize: number;
  signature: string;
  changelog: string;
  force: boolean;
  publishedAt: string;
}

export const adminApi = {
  licenses: {
    list: () => req<License[]>("/api/v1/licenses"),
    create: (data: CreateLicensePayload) =>
      req<License>("/api/v1/licenses", "POST", data),
    createBulk: (data: CreateLicensePayload & { count: number }) =>
      req<License[]>("/api/v1/licenses/bulk", "POST", data),
    delete: (id: string) =>
      req<{ message: string }>(`/api/v1/licenses/${id}`, "DELETE"),
  },
  products: {
    list: () => req<Product[]>("/api/v1/products"),
  },
  trials: {
    list: () => req<Trial[]>("/api/v1/trials"),
    delete: (id: string) => req<{ message: string }>(`/api/v1/trials/${id}`, "DELETE"),
  },
  updates: {
    list: () => req<AppUpdate[]>("/api/v1/updates/list"),
    delete: (id: string) => req<{ message: string }>(`/api/v1/updates/${id}`, "DELETE"),
    upload: async (formData: FormData) => {
      const tokenRes = await fetch("/api/admin/upload-token", { method: "POST" });
      const tokenJson = await tokenRes.json().catch(() => ({})) as {
        success?: boolean;
        data?: { uploadUrl?: string };
        error?: string;
      };

      if (!tokenRes.ok || tokenJson.success === false || !tokenJson.data?.uploadUrl) {
        throw new Error(tokenJson.error ?? `HTTP ${tokenRes.status}`);
      }

      let res: Response;
      try {
        res = await fetch(tokenJson.data.uploadUrl, { method: "POST", body: formData });
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? `Falha de rede no upload direto: ${error.message}. Verifique CORS, URL do License Manager e limite de upload do servidor.`
            : "Falha de rede no upload.",
        );
      }
      const json = await res.json().catch(() => ({})) as { success?: boolean; data?: AppUpdate; error?: string };
      if (!res.ok || json.success === false) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data as AppUpdate;
    },
  },
  ping: () =>
    req<unknown>("/api/v1/products")
      .then(() => ({ ok: true, status: 200 }))
      .catch(() => ({ ok: false, status: 0 })),
};
