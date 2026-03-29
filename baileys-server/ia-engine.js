'use strict';

// ─── IA Engine — contexto avançado ───────────────────────────────────────────
// Mantém resumo por conversa para não explodir o contexto

const conversationSummaries = {}; // `${sessionId}:${jid}` -> string
const clientProfiles = {};        // `${sessionId}:${jid}` -> { name, number, tags[] }

// Atualiza perfil do cliente com dados extraídos da mensagem
function updateClientProfile(key, name, number) {
  if (!clientProfiles[key]) clientProfiles[key] = { name: name || number, number, tags: [] };
  if (name && name !== number) clientProfiles[key].name = name;
}

// Monta o array de mensagens para a API (método avançado)
// 1. system: prompt base
// 2. system: dados do cliente
// 3. system: resumo da conversa (se existir)
// 4. últimas N mensagens do histórico
function buildMessages(systemPrompt, key, history, maxHistory = 10) {
  const profile = clientProfiles[key];
  const summary = conversationSummaries[key];

  const messages = [];

  // 1. Prompt base
  messages.push({ role: 'system', content: systemPrompt });

  // 2. Dados do cliente
  if (profile) {
    messages.push({
      role: 'system',
      content: `Cliente: ${profile.name}${profile.tags.length ? ` | Tags: ${profile.tags.join(', ')}` : ''}`,
    });
  }

  // 3. Resumo da conversa anterior
  if (summary) {
    messages.push({ role: 'system', content: `Resumo da conversa: ${summary}` });
  }

  // 4. Últimas N mensagens (user/assistant alternados)
  const recent = history.slice(-maxHistory);
  for (const m of recent) {
    messages.push({ role: m.fromMe ? 'assistant' : 'user', content: m.text });
  }

  return messages;
}

// Gera resumo da conversa via IA (chamado a cada 20 mensagens)
async function generateSummary(provider, apiKey, model, history) {
  const text = history.slice(-20).map(m => `${m.fromMe ? 'IA' : 'Cliente'}: ${m.text}`).join('\n');
  const summaryPrompt = [
    { role: 'system', content: 'Resuma em 2 frases o contexto desta conversa de atendimento. Seja objetivo.' },
    { role: 'user', content: text },
  ];
  try {
    return await callAIRaw(provider, apiKey, model, summaryPrompt);
  } catch {
    return null;
  }
}

// Chamada bruta à API (recebe messages[] já montado)
async function callAIRaw(provider, apiKey, model, messages) {
  const headers = { 'Content-Type': 'application/json' };
  let url, body;

  if (provider === 'openai' || provider === 'grok') {
    url = provider === 'grok' ? 'https://api.x.ai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${apiKey}`;
    body = JSON.stringify({ model: model || 'gpt-4o-mini', messages, max_tokens: 500, temperature: 0.7 });
  } else if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    const conv = messages.filter(m => m.role !== 'system');
    body = JSON.stringify({ model: model || 'claude-3-haiku-20240307', max_tokens: 500, system: sys, messages: conv });
  } else if (provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    headers['Authorization'] = `Bearer ${apiKey}`;
    body = JSON.stringify({ model: model || 'llama3-8b-8192', messages, max_tokens: 500 });
  } else if (provider === 'ollama') {
    url = 'http://localhost:11434/api/chat';
    body = JSON.stringify({ model: model || 'llama3', messages, stream: false });
  } else {
    throw new Error(`Provedor desconhecido: ${provider}`);
  }

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${provider} erro ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();

  if (provider === 'anthropic') return data.content?.[0]?.text?.trim() || '';
  if (provider === 'ollama') return data.message?.content?.trim() || '';
  return data.choices?.[0]?.message?.content?.trim() || '';
}

module.exports = {
  updateClientProfile,
  buildMessages,
  generateSummary,
  callAIRaw,
  conversationSummaries,
  clientProfiles,
};
