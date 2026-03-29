// ─── IA Atendimento — Static data & helpers ──────────────────────────────────

import {
  AgentProfile, IAConfig, Intent, PromptPreset,
  TestResult, Sentiment, LeadScore,
} from './types';

// ─── Profile metadata ─────────────────────────────────────────────────────────

export const PROFILE_META: Record<AgentProfile, { label: string; description: string; color: string }> = {
  seller:         { label: 'Vendedor',            description: 'Foco em conversão e fechamento',       color: 'text-emerald-400 bg-emerald-500/10' },
  support:        { label: 'Suporte Técnico',      description: 'Resolve dúvidas e problemas',          color: 'text-blue-400 bg-blue-500/10' },
  receptionist:   { label: 'Recepcionista',        description: 'Triagem e direcionamento inicial',     color: 'text-violet-400 bg-violet-500/10' },
  lead_qualifier: { label: 'Qualificador de Lead', description: 'Coleta dados e classifica interesse',  color: 'text-orange-400 bg-orange-500/10' },
  post_sale:      { label: 'Pós-Venda',            description: 'Retenção, satisfação e upsell',        color: 'text-cyan-400 bg-cyan-500/10' },
  collection:     { label: 'Cobrança Leve',        description: 'Lembrete de pagamento sem pressão',    color: 'text-yellow-400 bg-yellow-500/10' },
};

// ─── Intent metadata ──────────────────────────────────────────────────────────

export const INTENT_META: Record<Intent, { label: string; color: string }> = {
  want_to_buy:    { label: 'Quer Comprar',        color: 'text-emerald-400 bg-emerald-500/10' },
  want_price:     { label: 'Quer Preço',          color: 'text-green-400 bg-green-500/10' },
  need_support:   { label: 'Precisa de Suporte',  color: 'text-blue-400 bg-blue-500/10' },
  want_human:     { label: 'Quer Atendente',      color: 'text-red-400 bg-red-500/10' },
  plan_question:  { label: 'Dúvida sobre Plano',  color: 'text-sky-400 bg-sky-500/10' },
  payment_issue:  { label: 'Problema Pagamento',  color: 'text-orange-400 bg-orange-500/10' },
  want_info:      { label: 'Quer Informações',    color: 'text-violet-400 bg-violet-500/10' },
  not_interested: { label: 'Sem Interesse',       color: 'text-neutral-400 bg-neutral-500/10' },
  spam:           { label: 'Spam',                color: 'text-red-500 bg-red-500/10' },
  unknown:        { label: 'Desconhecido',        color: 'text-neutral-500 bg-neutral-500/10' },
};

export const SENTIMENT_META: Record<Sentiment, { label: string; color: string; icon: string }> = {
  positive:   { label: 'Positivo',   color: 'text-emerald-400', icon: '😊' },
  neutral:    { label: 'Neutro',     color: 'text-neutral-400', icon: '😐' },
  negative:   { label: 'Negativo',   color: 'text-red-400',     icon: '😞' },
  frustrated: { label: 'Frustrado',  color: 'text-orange-400',  icon: '😤' },
};

export const LEAD_SCORE_META: Record<LeadScore, { label: string; color: string; dot: string }> = {
  hot:  { label: 'Quente', color: 'text-red-400',     dot: 'bg-red-400' },
  warm: { label: 'Morno',  color: 'text-orange-400',  dot: 'bg-orange-400' },
  cold: { label: 'Frio',   color: 'text-blue-400',    dot: 'bg-blue-400' },
};

// ─── Default config ───────────────────────────────────────────────────────────

export const DEFAULT_IA_CONFIG: IAConfig = {
  enabled: false,
  mode: 'automatic',
  chatScope: 'all',
  profile: 'seller',
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: '',
  basePrompt: 'Você é um assistente de vendas profissional. Responda de forma clara, objetiva e amigável. Seu objetivo é qualificar o lead e avançar para o fechamento.',
  tone: 'friendly',
  language: 'pt-BR',
  workingHoursEnabled: false,
  workingHoursStart: '08:00',
  workingHoursEnd: '18:00',
  responseDelayMin: 2,
  responseDelayMax: 8,
  maxAutoMessages: 20,
  temperature: 0.7,
  maxContextMessages: 10,
  forbiddenWords: ['concorrente', 'grátis', 'pirata'],
  sensitiveWords: ['pagamento', 'reembolso', 'cancelar', 'processo'],
  fallbackMessage: 'Desculpe, não consegui entender. Um atendente irá te ajudar em breve.',
  transferRules: [
    { id: '1', trigger: 'want_human',    action: 'transfer', label: 'Cliente pediu atendente' },
    { id: '2', trigger: 'frustrated',    action: 'transfer', label: 'Cliente frustrado' },
    { id: '3', trigger: 'payment_issue', action: 'transfer', label: 'Problema de pagamento' },
  ],
  transferWebhook: '',
};

// ─── Prompt presets ───────────────────────────────────────────────────────────

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'seller_aggressive',
    label: 'Vendedor Agressivo',
    description: 'Foco total em conversão rápida',
    tone: 'direct',
    profile: 'seller',
    prompt: 'Você é um vendedor de alta performance. Seu único objetivo é fechar a venda. Seja direto, crie urgência, destaque benefícios e elimine objeções rapidamente. Nunca deixe o cliente sem uma proposta clara.',
  },
  {
    id: 'seller_friendly',
    label: 'Vendedor Educado',
    description: 'Consultivo, sem pressão',
    tone: 'friendly',
    profile: 'seller',
    prompt: 'Você é um consultor de vendas amigável. Ouça o cliente, entenda suas necessidades e apresente a solução ideal de forma natural. Construa confiança antes de propor qualquer coisa.',
  },
  {
    id: 'support_objective',
    label: 'Suporte Objetivo',
    description: 'Respostas diretas e técnicas',
    tone: 'direct',
    profile: 'support',
    prompt: 'Você é um agente de suporte técnico. Responda de forma clara e objetiva. Identifique o problema, ofereça a solução mais eficiente e confirme se o cliente ficou satisfeito.',
  },
  {
    id: 'support_friendly',
    label: 'Suporte Amigável',
    description: 'Empático e paciente',
    tone: 'empathetic',
    profile: 'support',
    prompt: 'Você é um agente de suporte empático. Valide o sentimento do cliente, peça desculpas quando necessário e resolva o problema com paciência e clareza. Faça o cliente se sentir ouvido.',
  },
  {
    id: 'lead_qualifier',
    label: 'Qualificador de Lead',
    description: 'Coleta dados e classifica',
    tone: 'friendly',
    profile: 'lead_qualifier',
    prompt: 'Você é um qualificador de leads. Faça perguntas estratégicas para entender: nome, empresa, necessidade, orçamento e urgência. Classifique o lead e passe para o vendedor com um resumo.',
  },
  {
    id: 'receptionist',
    label: 'Recepção Automática',
    description: 'Triagem e boas-vindas',
    tone: 'formal',
    profile: 'receptionist',
    prompt: 'Você é a recepcionista virtual. Dê boas-vindas, identifique o motivo do contato e direcione para o setor correto. Seja cordial, profissional e eficiente.',
  },
];

// ─── Simulate IA test ─────────────────────────────────────────────────────────

export function simulateIATest(input: string, config: IAConfig): TestResult {
  const lower = input.toLowerCase();

  let intent: Intent = 'unknown';
  let sentiment: Sentiment = 'neutral';
  let confidence = 0.75;
  let wouldTransfer = false;
  let transferReason: string | undefined;
  const tags: string[] = [];
  const extractedData: Record<string, string> = {};

  // Intent detection
  if (/comprar|quero|adquirir|contratar/.test(lower)) { intent = 'want_to_buy'; confidence = 0.92; tags.push('lead-quente'); }
  else if (/preço|valor|quanto|custa|plano/.test(lower)) { intent = 'want_price'; confidence = 0.89; }
  else if (/suporte|problema|erro|não funciona|bug/.test(lower)) { intent = 'need_support'; confidence = 0.88; }
  else if (/atendente|humano|pessoa|falar com/.test(lower)) { intent = 'want_human'; confidence = 0.97; wouldTransfer = true; transferReason = 'Cliente pediu atendente humano'; }
  else if (/pagamento|boleto|pix|cartão|cobrança/.test(lower)) { intent = 'payment_issue'; confidence = 0.85; wouldTransfer = true; transferReason = 'Assunto financeiro sensível'; }
  else if (/não quero|não tenho interesse|remover/.test(lower)) { intent = 'not_interested'; confidence = 0.91; }
  else if (/spam|promoção|oferta/.test(lower)) { intent = 'spam'; confidence = 0.78; }
  else if (/informação|saber mais|como funciona/.test(lower)) { intent = 'want_info'; confidence = 0.82; }

  // Sentiment
  if (/ótimo|excelente|perfeito|adorei|obrigado/.test(lower)) sentiment = 'positive';
  else if (/raiva|absurdo|ridículo|péssimo|horrível/.test(lower)) { sentiment = 'frustrated'; wouldTransfer = true; transferReason = transferReason ?? 'Cliente frustrado detectado'; }
  else if (/ruim|problema|errado|não gostei/.test(lower)) sentiment = 'negative';

  // Extract data
  const nameMatch = lower.match(/me chamo ([a-záéíóúâêîôûãõç]+)/i);
  if (nameMatch) extractedData['nome'] = nameMatch[1];
  const cityMatch = lower.match(/(?:de|em|sou de) ([a-záéíóúâêîôûãõç\s]+?)(?:\.|,|$)/i);
  if (cityMatch) extractedData['cidade'] = cityMatch[1].trim();

  // Check forbidden words
  const hasForbidden = config.forbiddenWords.some(w => lower.includes(w.toLowerCase()));
  if (hasForbidden) tags.push('palavra-proibida');

  // Check transfer rules
  if (!wouldTransfer) {
    const rule = config.transferRules.find(r => r.trigger === intent || r.trigger === sentiment);
    if (rule) { wouldTransfer = true; transferReason = rule.label; }
  }

  // Generate response
  const responses: Record<Intent, string> = {
    want_to_buy: 'Que ótimo! Temos a solução perfeita para você. Posso te apresentar nossos planos agora?',
    want_price: 'Claro! Nosso plano Starter começa em R$47/mês e o PRO em R$97/mês. Qual se encaixa melhor no seu perfil?',
    need_support: 'Entendo! Me conta mais sobre o problema para eu te ajudar da melhor forma.',
    want_human: 'Claro! Vou te conectar com um atendente agora mesmo. Aguarde um instante.',
    plan_question: 'Posso te explicar tudo sobre nossos planos! O que você gostaria de saber?',
    payment_issue: 'Lamento o inconveniente! Vou transferir para nosso setor financeiro resolver isso.',
    want_info: 'Com prazer! O que você gostaria de saber sobre nosso produto?',
    not_interested: 'Tudo bem! Se mudar de ideia, estaremos aqui. Posso te enviar algum material?',
    spam: 'Olá! Como posso te ajudar hoje?',
    unknown: config.fallbackMessage,
  };

  return {
    input,
    response: wouldTransfer && intent === 'want_human'
      ? responses.want_human
      : responses[intent] ?? config.fallbackMessage,
    intent,
    sentiment,
    confidence,
    wouldTransfer,
    transferReason,
    tags,
    extractedData,
  };
}
