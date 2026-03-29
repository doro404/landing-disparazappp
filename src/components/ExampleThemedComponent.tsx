/**
 * Exemplo de como usar o tema em componentes
 * Copie este padrão para seus componentes
 */

import { useThemeStyles } from '@/hooks/useThemeStyles';

export function ExampleThemedComponent() {
  const styles = useThemeStyles();

  return (
    <div
      style={{
        backgroundColor: styles.bg.primary,
        color: styles.text.primary,
        padding: '16px',
        borderRadius: '8px',
        border: `1px solid ${styles.border}`,
      }}
    >
      <h2>Componente com Tema</h2>

      {/* Usando cores do tema */}
      <p style={{ color: styles.text.secondary }}>
        Texto secundário com cor do tema
      </p>

      {/* Botão primário */}
      <button
        style={{
          backgroundColor: styles.components.buttonPrimaryBg,
          color: styles.components.buttonPrimaryText,
          padding: '8px 16px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Botão Primário
      </button>

      {/* Botão secundário */}
      <button
        style={{
          backgroundColor: styles.components.buttonSecondaryBg,
          color: styles.components.buttonSecondaryText,
          padding: '8px 16px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginLeft: '8px',
        }}
      >
        Botão Secundário
      </button>

      {/* Usando gradientes */}
      <div
        style={{
          background: styles.gradients.deviceConnected,
          padding: '12px',
          borderRadius: '4px',
          marginTop: '12px',
          color: 'white',
        }}
      >
        Gradiente do tema
      </div>

      {/* Acentos */}
      <div style={{ marginTop: '12px' }}>
        <span style={{ color: styles.accent.success }}>✓ Sucesso</span>
        {' | '}
        <span style={{ color: styles.accent.warning }}>⚠ Aviso</span>
        {' | '}
        <span style={{ color: styles.accent.error }}>✕ Erro</span>
      </div>
    </div>
  );
}
