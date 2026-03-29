# Sistema de Temas

## 📋 Visão Geral

O aplicativo possui um sistema robusto de temas que permite trocar entre:
- **Light** (Claro) - Tema padrão
- **Dark** (Escuro) - Tema escuro
- **Purple** (Roxo) - Tema roxo/lilás

## 🎨 Cores Disponíveis

### Light (Padrão)
- Fundo: Azul muito claro (#f0f9ff)
- Texto: Cinza escuro (#1f2937)
- Acento primário (Logo): Roxo (#7c3aed)
- Botão primário: Verde WhatsApp (#25D366)

### Dark
- Fundo: Azul muito escuro (#0f172a)
- Texto: Branco (#f1f5f9)
- Acento primário: Roxo claro (#a78bfa)
- Botão primário: Verde WhatsApp (#25D366)

### Purple
- Fundo: Roxo muito claro (#faf5ff)
- Texto: Roxo muito escuro (#4c1d95)
- Acento primário: Roxo vibrante (#7c3aed)
- Botão primário: Roxo (#7c3aed)

## 🔧 Como Usar em Componentes

### Método 1: Hook `useThemeStyles`

```tsx
import { useThemeStyles } from '@/hooks/useThemeStyles';

export function MyComponent() {
  const styles = useThemeStyles();

  return (
    <div style={{ backgroundColor: styles.bg.primary, color: styles.text.primary }}>
      <button style={{ backgroundColor: styles.components.buttonPrimaryBg }}>
        Clique aqui
      </button>
    </div>
  );
}
```

### Método 2: Hook `useTheme` (acesso direto)

```tsx
import { useTheme } from '@/context/ThemeContext';

export function MyComponent() {
  const { currentTheme, colors, setTheme } = useTheme();

  return (
    <div>
      <p>Tema atual: {currentTheme}</p>
      <p style={{ color: colors.textPrimary }}>Texto com cor do tema</p>
      <button onClick={() => setTheme('dark')}>Mudar para Escuro</button>
    </div>
  );
}
```

### Método 3: CSS com Variáveis

```css
.my-component {
  background-color: var(--color-bgPrimary);
  color: var(--color-textPrimary);
  border: 1px solid var(--color-borderColor);
}

.my-button {
  background-color: var(--color-buttonPrimaryBg);
  color: var(--color-buttonPrimaryText);
}
```

## 📱 Seletor de Temas

Use o componente `<ThemeSwitcher />` em seu layout:

```tsx
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

export function SettingsPanel() {
  return (
    <div>
      <h2>Temas</h2>
      <ThemeSwitcher />
    </div>
  );
}
```

## 💾 Persistência

O tema selecionado é automaticamente salvo em `localStorage` com a chave `app-theme`.

Ao recarregar a página, o tema anterior é restaurado.

## 🔄 Mudança de Tema Programática

```tsx
import { useTheme } from '@/context/ThemeContext';

export function ThemeButtons() {
  const { setTheme } = useTheme();

  return (
    <div>
      <button onClick={() => setTheme('light')}>Claro</button>
      <button onClick={() => setTheme('dark')}>Escuro</button>
      <button onClick={() => setTheme('purple')}>Roxo</button>
    </div>
  );
}
```

## 🎯 Cores Disponíveis no Hook

```
styles.bg.primary      // Fundo principal
styles.bg.secondary    // Fundo secundário
styles.bg.tertiary     // Fundo terciário

styles.text.primary    // Texto principal
styles.text.secondary  // Texto secundário
styles.text.inverse    // Texto inverso

styles.accent.primary  // Acento primário (roxo)
styles.accent.success  // Sucesso (verde)
styles.accent.warning  // Aviso (âmbar)
styles.accent.error    // Erro (vermelho)

styles.components.headerBg
styles.components.sidebarBg
styles.components.buttonPrimaryBg
styles.components.buttonSecondaryBg

styles.border          // Cor de borda
styles.shadow          // Cor de sombra
styles.gradients.deviceConnected  // Gradiente especial
```

## 🔌 Configuração Inicial

1. O tema padrão é **"light"**
2. Para mudar o padrão, edite `src/lib/themes.ts`:
   ```tsx
   export const DEFAULT_THEME: ThemeName = 'dark'; // Mudar para 'dark' ou 'purple'
   ```

## 📝 Estrutura de Arquivos

```
src/
├── lib/
│   ├── themes.ts           # Definição dos 3 temas
│   └── themeStyles.css     # CSS global com variáveis
├── context/
│   └── ThemeContext.tsx    # Provider do contexto
├── hooks/
│   └── useThemeStyles.ts   # Hook para usar cores
└── components/
    └── ThemeSwitcher.tsx   # Componente de seleção
```

## ✨ Exemplo Completo

Veja `src/components/ExampleThemedComponent.tsx` para um exemplo completo de como usar o sistema de temas.
