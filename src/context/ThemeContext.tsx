/**
 * ThemeContext.tsx
 * Gerenciamento global de temas
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeName, themes, ThemeColors, DEFAULT_THEME } from '@/lib/themes';

interface ThemeContextType {
  currentTheme: ThemeName;
  colors: ThemeColors;
  setTheme: (theme: ThemeName) => void;
  availableThemes: ThemeName[];
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>(() => {
    // Tenta carregar tema salvo no localStorage
    if (typeof window === 'undefined') return DEFAULT_THEME;
    const saved = localStorage.getItem('app-theme') as ThemeName | null;
    return saved && saved in themes ? saved : DEFAULT_THEME;
  });

  // Aplica estilos CSS quando o tema muda
  useEffect(() => {
    const colors = themes[currentTheme];
    const root = document.documentElement;

    // Define variáveis CSS para fácil acesso em componentes
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Salva preferência
    localStorage.setItem('app-theme', currentTheme);

    // Aplica classe ao body para uso em CSS
    document.body.className = `theme-${currentTheme}`;
  }, [currentTheme]);

  const handleSetTheme = (theme: ThemeName) => {
    if (theme in themes) {
      setCurrentTheme(theme);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        colors: themes[currentTheme],
        setTheme: handleSetTheme,
        availableThemes: Object.keys(themes) as ThemeName[],
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
