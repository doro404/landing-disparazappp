/**
 * notify.ts
 * Wrapper para notificações nativas do Windows via tauri-plugin-notification.
 * Só dispara quando a janela não está em foco.
 * Clicar na notificação abre/foca a janela automaticamente.
 */

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  onAction,
} from '@tauri-apps/plugin-notification';
import { getCurrentWindow } from '@tauri-apps/api/window';

let _permissionChecked = false;
let _hasPermission = false;
let _clickListenerSetup = false;

async function ensurePermission(): Promise<boolean> {
  if (_permissionChecked) return _hasPermission;
  _permissionChecked = true;
  _hasPermission = await isPermissionGranted();
  if (!_hasPermission) {
    const result = await requestPermission();
    _hasPermission = result === 'granted';
  }
  return _hasPermission;
}

function showWindow(): void {
  const win = getCurrentWindow();
  win.show().catch(() => {});
  win.unminimize().catch(() => {});
  win.setFocus().catch(() => {});
}

/** Chama uma vez no boot do app para registrar o handler de clique em notificações. */
export function setupNotificationClickHandler(): void {
  if (_clickListenerSetup) return;
  _clickListenerSetup = true;
  // onAction é disparado quando o usuário clica na notificação do sistema
  onAction(() => showWindow()).catch(() => {});
}

async function isWindowFocused(): Promise<boolean> {
  try {
    return await getCurrentWindow().isFocused();
  } catch {
    return true;
  }
}

export interface NotifyOptions {
  title: string;
  body: string;
  /** Se true, notifica mesmo com a janela em foco */
  force?: boolean;
}

export async function notify({ title, body, force = false }: NotifyOptions): Promise<void> {
  try {
    if (!force) {
      const focused = await isWindowFocused();
      if (focused) return;
    }
    const ok = await ensurePermission();
    if (!ok) return;
    sendNotification({ title, body });
  } catch {
    // silencioso — notificação é best-effort
  }
}

// ─── Helpers prontos ──────────────────────────────────────────────────────────

export const Notify = {
  disparoConcluido: (sent: number, failed: number) =>
    notify({
      title: '✅ Disparo concluído',
      body: `${sent} enviados${failed > 0 ? ` · ${failed} falhas` : ''}`,
    }),

  disparoPausado: () =>
    notify({ title: '⏸ Disparo pausado', body: 'Clique para retomar quando quiser.' }),

  sessaoDesconectada: (sessionId: string) =>
    notify({
      title: '⚠️ Sessão desconectada',
      body: `A sessão ${sessionId} perdeu a conexão com o WhatsApp.`,
    }),

  trialQuaseEsgotado: (sendsLeft: number) =>
    notify({
      title: '⚠️ Trial quase no limite',
      body: `Restam apenas ${sendsLeft} envios no seu trial.`,
    }),

  trialEsgotado: () =>
    notify({
      title: '🔒 Trial esgotado',
      body: 'Você atingiu o limite de envios. Ative uma licença para continuar.',
      force: true,
    }),

  iaRespondeu: (contact: string) =>
    notify({
      title: '🤖 IA respondeu',
      body: `Nova resposta automática enviada para ${contact}`,
    }),
};
