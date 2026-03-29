/**
 * themes.ts
 * Definição dos temas de cores da aplicação
 */

export type ThemeName = 'light' | 'dark' | 'purple';

export interface ThemeColors {
  // Fundos
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  
  // Texto
  textPrimary: string;
  textSecondary: string;
  textInverse: string;
  
  // Acentos
  accentPrimary: string;      // Roxo/Lilás (logo)
  accentSuccess: string;       // Verde WhatsApp
  accentWarning: string;
  accentError: string;
  
  // Componentes
  headerBg: string;
  sidebarBg: string;
  sidebarText: string;
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  borderColor: string;
  shadowColor: string;
  
  // Especiais
  deviceConnectedGradientStart: string;
  deviceConnectedGradientEnd: string;
  stepIndicatorColor: string;
}

export const themes: Record<ThemeName, ThemeColors> = {
  light: {
    // Fundos
    bgPrimary: '#f0f9ff',           // Azul bem claro e suave
    bgSecondary: '#ffffff',         // Branco puro
    bgTertiary: '#f8fafc',          // Cinza muito claro
    
    // Texto
    textPrimary: '#1f2937',         // Cinza escuro forte (excelente legibilidade)
    textSecondary: '#64748b',       // Cinza médio mais escuro
    textInverse: '#ffffff',         // Branco
    
    // Acentos
    accentPrimary: '#7c3aed',       // Roxo vibrante (marca)
    accentSuccess: '#25D366',       // Verde WhatsApp forte
    accentWarning: '#f59e0b',       // Âmbar
    accentError: '#ef4444',         // Vermelho
    
    // Componentes
    headerBg: '#ffffff',
    sidebarBg: '#ffffff',
    sidebarText: '#1f2937',
    buttonPrimaryBg: '#25D366',     // Verde WhatsApp gradiente start
    buttonPrimaryText: '#ffffff',
    buttonSecondaryBg: '#f3e8ff',   // Lilás muito claro
    buttonSecondaryText: '#7c3aed', // Roxo vibrante
    borderColor: '#e2e8f0',         // Cinza claro suave
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    
    // Especiais
    deviceConnectedGradientStart: '#25D366',
    deviceConnectedGradientEnd: '#10b981',
    stepIndicatorColor: '#7c3aed',  // Roxo da marca
  },

  dark: {
    // Fundos
    bgPrimary: '#0f172a',           // Azul muito escuro
    bgSecondary: '#1e293b',         // Cinza azulado escuro
    bgTertiary: '#334155',          // Cinza escuro
    
    // Texto
    textPrimary: '#f1f5f9',         // Branco quase puro
    textSecondary: '#cbd5e1',       // Cinza claro
    textInverse: '#0f172a',         // Azul escuro
    
    // Acentos
    accentPrimary: '#a78bfa',       // Roxo claro
    accentSuccess: '#10b981',       // Verde (mantém)
    accentWarning: '#f59e0b',       // Âmbar
    accentError: '#f87171',         // Vermelho claro
    
    // Componentes
    headerBg: '#1e293b',
    sidebarBg: '#1e293b',
    sidebarText: '#f1f5f9',
    buttonPrimaryBg: '#25D366',
    buttonPrimaryText: '#0f172a',
    buttonSecondaryBg: '#7c3aed',   // Roxo mais saturado
    buttonSecondaryText: '#ffffff',
    borderColor: '#475569',         // Cinza médio
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    
    // Especiais
    deviceConnectedGradientStart: '#10b981',
    deviceConnectedGradientEnd: '#14b8a6',
    stepIndicatorColor: '#818cf8',  // Índigo claro
  },

  purple: {
    // Fundos (baseado em roxo/lilás)
    bgPrimary: '#faf5ff',           // Roxo muito claro
    bgSecondary: '#ffffff',         // Branco
    bgTertiary: '#f3e8ff',          // Roxo claro
    
    // Texto
    textPrimary: '#4c1d95',         // Roxo muito escuro
    textSecondary: '#7e22ce',       // Roxo médio
    textInverse: '#ffffff',
    
    // Acentos
    accentPrimary: '#7c3aed',       // Roxo vibrante (tema principal)
    accentSuccess: '#059669',       // Verde mais opaco
    accentWarning: '#d97706',       // Âmbar mais opaco
    accentError: '#dc2626',         // Vermelho mais opaco
    
    // Componentes
    headerBg: '#ffffff',
    sidebarBg: '#ffffff',
    sidebarText: '#4c1d95',
    buttonPrimaryBg: '#7c3aed',     // Roxo (tema)
    buttonPrimaryText: '#ffffff',
    buttonSecondaryBg: '#e9d5ff',   // Roxo muito claro
    buttonSecondaryText: '#4c1d95',
    borderColor: '#ddd6fe',         // Roxo claro
    shadowColor: 'rgba(124, 58, 237, 0.15)',
    
    // Especiais
    deviceConnectedGradientStart: '#7c3aed',
    deviceConnectedGradientEnd: '#6366f1',
    stepIndicatorColor: '#6366f1',
  },
};

export const DEFAULT_THEME: ThemeName = 'light';
