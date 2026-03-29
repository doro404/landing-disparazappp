/**
 * useThemeStyles.ts
 * Hook para usar cores do tema em componentes React
 */

import { useTheme } from '@/context/ThemeContext';

export function useThemeStyles() {
  const { colors } = useTheme();

  return {
    // Fundos
    bg: {
      primary: colors.bgPrimary,
      secondary: colors.bgSecondary,
      tertiary: colors.bgTertiary,
    },
    
    // Texto
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      inverse: colors.textInverse,
    },
    
    // Acentos
    accent: {
      primary: colors.accentPrimary,
      success: colors.accentSuccess,
      warning: colors.accentWarning,
      error: colors.accentError,
    },
    
    // Componentes
    components: {
      headerBg: colors.headerBg,
      sidebarBg: colors.sidebarBg,
      sidebarText: colors.sidebarText,
      buttonPrimaryBg: colors.buttonPrimaryBg,
      buttonPrimaryText: colors.buttonPrimaryText,
      buttonSecondaryBg: colors.buttonSecondaryBg,
      buttonSecondaryText: colors.buttonSecondaryText,
    },
    
    // Utilitários
    border: colors.borderColor,
    shadow: colors.shadowColor,
    gradients: {
      deviceConnected: `linear-gradient(135deg, ${colors.deviceConnectedGradientStart}, ${colors.deviceConnectedGradientEnd})`,
    },
  };
}
