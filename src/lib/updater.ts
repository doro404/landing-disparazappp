import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { open } from '@tauri-apps/plugin-shell';

const API = 'https://license-manager.discloud.app';
const PRODUCT = 'dispara-zapp';

export interface UpdateInfo {
  updateAvailable: boolean;
  latestVersion?: string;
  currentVersion?: string;
  url?: string | null;
  changelog?: string | null;
  force?: boolean;
  fileSize?: number;
  publishedAt?: string;
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo> {
  const res = await tauriFetch(
    `${API}/api/v1/updates?product=${PRODUCT}&currentVersion=${encodeURIComponent(currentVersion)}`,
    { method: 'GET' }
  );
  const json = await res.json() as { success: boolean; data: UpdateInfo };
  if (!json.success) throw new Error('Falha ao verificar atualizações');
  return json.data;
}

export async function openDownloadUrl(url: string) {
  await open(url);
}
