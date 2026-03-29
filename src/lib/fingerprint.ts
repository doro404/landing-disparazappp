/**
 * fingerprint.ts
 * Fingerprint em duas camadas para maior estabilidade:
 *
 * STABLE (âncora principal — raramente muda):
 *   hardwareConcurrency, deviceMemory, platform, timezone,
 *   screen resolution + colorDepth, language, touch support
 *
 * VOLATILE (complemento — pode mudar com drivers/updates):
 *   canvas 2D, WebGL renderer, AudioContext, fonts
 *
 * O servidor aceita match em qualquer uma das camadas,
 * e atualiza o volatile silenciosamente quando muda.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sha256(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Sinais voláteis ──────────────────────────────────────────────────────────

function canvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('SuperRobô🔑', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('SuperRobô🔑', 4, 17);
    return canvas.toDataURL().slice(-64);
  } catch { return 'canvas-error'; }
}

function webglFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (!gl) return 'no-webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    return `${vendor}::${renderer}`;
  } catch { return 'webgl-error'; }
}

async function audioFingerprint(): Promise<string> {
  try {
    const AudioCtx = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return 'no-audio';
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const analyser = ctx.createAnalyser();
    const gain = ctx.createGain();
    const scriptProcessor = ctx.createScriptProcessor(4096, 1, 1);
    gain.gain.value = 0;
    oscillator.type = 'triangle';
    oscillator.frequency.value = 10000;
    oscillator.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(gain);
    gain.connect(ctx.destination);

    return await new Promise<string>((resolve) => {
      let settled = false;
      const cleanup = () => {
        if (settled) return; settled = true;
        try { oscillator.disconnect(); } catch { /* ignore */ }
        try { scriptProcessor.disconnect(); } catch { /* ignore */ }
        if (ctx.state !== 'closed') ctx.close().catch(() => {});
      };
      scriptProcessor.onaudioprocess = (e) => {
        if (settled) return;
        const data = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += Math.abs(data[i]);
        cleanup();
        resolve(sum.toFixed(10));
      };
      oscillator.start(0);
      setTimeout(() => { if (!settled) { cleanup(); resolve('audio-timeout'); } }, 500);
    });
  } catch { return 'audio-error'; }
}

function detectFonts(): string {
  const testFonts = [
    'Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Courier New',
    'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
    'Trebuchet MS', 'Impact', 'Tahoma', 'Segoe UI', 'Calibri',
  ];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'no-fonts';
  const baseline = measureFont(ctx, 'monospace');
  return testFonts.filter(f => measureFont(ctx, `"${f}", monospace`) !== baseline).join(',');
}

function measureFont(ctx: CanvasRenderingContext2D, font: string): number {
  ctx.font = `72px ${font}`;
  return ctx.measureText('mmmmmmmmmmlli').width;
}

// ─── Resultado ────────────────────────────────────────────────────────────────

export interface FingerprintResult {
  /** Hash dos sinais estáveis — âncora principal de identidade da máquina */
  stable: string;
  /** Hash dos sinais voláteis — complemento, pode mudar com drivers */
  volatile: string;
  /** Hash combinado (stable + volatile) — compatibilidade com código legado */
  combined: string;
}

const CACHE_KEY = 'srb_fp_v3';

export async function getFingerprint(): Promise<string> {
  const result = await getFingerprintFull();
  return result.combined;
}

export async function getFingerprintFull(): Promise<FingerprintResult> {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached) as FingerprintResult; } catch { /* recalcula */ }
  }

  const audioFp = await audioFingerprint();

  // Sinais estáveis — hardware fixo
  const stableSignals = [
    String(navigator.hardwareConcurrency ?? 0),
    String((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 0),
    navigator.platform ?? 'unknown',
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(window.devicePixelRatio ?? 1),
    navigator.language,
    String('ontouchstart' in window),
  ].join('|||');

  // Sinais voláteis — rendering, pode mudar com updates
  const volatileSignals = [
    canvasFingerprint(),
    webglFingerprint(),
    audioFp,
    detectFonts(),
    navigator.userAgent,
    (navigator.languages ?? []).join(','),
  ].join('|||');

  const [stable, volatile_] = await Promise.all([
    sha256(stableSignals),
    sha256(volatileSignals),
  ]);

  const combined = await sha256(stable + '|||' + volatile_);

  const result: FingerprintResult = { stable, volatile: volatile_, combined };
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
  return result;
}

export function shortFingerprint(fp: string): string {
  return fp.slice(0, 4).toUpperCase() + '-' + fp.slice(4, 8).toUpperCase();
}
