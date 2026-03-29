/**
 * ThemeSwitcher.tsx
 * Componente para trocar temas
 */

import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon, Palette } from 'lucide-react';
import type { ThemeName } from '@/lib/themes';

export function ThemeSwitcher() {
  const { currentTheme, setTheme, availableThemes } = useTheme();

  const themeLabels: Record<ThemeName, { label: string; icon: React.ReactNode }> = {
    light: { label: 'Claro', icon: <Sun className="w-4 h-4" /> },
    dark: { label: 'Escuro', icon: <Moon className="w-4 h-4" /> },
    purple: { label: 'Roxo', icon: <Palette className="w-4 h-4" /> },
  };

  return (
    <div className="flex gap-2">
      {availableThemes.map((theme) => {
        const isActive = theme === currentTheme;
        const { label, icon } = themeLabels[theme];

        return (
          <button
            key={theme}
            onClick={() => setTheme(theme)}
            title={`Ativar tema ${label}`}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md transition-all
              ${
                isActive
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'
              }
            `}
          >
            {icon}
            <span className="text-sm font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
