/**
 * appConfig.ts
 * Configurações centrais do app lidas do .env.
 * Altere apenas o .env — todos os componentes usam daqui.
 */

export const APP_NAME    = import.meta.env.VITE_APP_NAME         ?? 'Dispara Zapp';
export const APP_SLUG    = import.meta.env.VITE_APP_SLUG         ?? 'dispara-zapp';
export const SUPPORT_URL = import.meta.env.VITE_APP_SUPPORT_URL  ?? 'https://sualicenca.com';
export const SUPPORT_EMAIL = import.meta.env.VITE_APP_SUPPORT_EMAIL ?? 'suporte@disparazapp.com';
