// Cluub AI: one `ask ai` for every provider. Zero dependencies (uses fetch).
//   ask ai "Summarize {text}"
//   ask ai "Extract the contact" as Contact
//   ask ai "Is this a bug or a feature?" as one of ["bug", "feature"]
//   ask ai "Translate {t}" using "openai"        (or "ollama:llama3.2", "claude:claude-sonnet-5-5")
import { AIError, AIKeyRequired } from './errors.js';

export const PROVIDERS = {
  claude: { key: 'ANTHROPIC_API_KEY', model: 'claude-opus-5-5' },
  openai: { key: 'OPENAI_API_KEY', model: 'gpt-4.1-mini' },
  gemini: { key: 'GEMINI_API_KEY', model: 'gemini-2.5-flash' },
  ollama: { key: null, model: 'llama3.2' },
};

export const USER_KEY_PROVIDERS = ['claude', 'openai', 'gemini'];

// settings.aiKeys decides whose key pays for AI calls:
//   "server" (default): the developer's key from .env / the environment
//   "user":   each end user's own key, sent with their request; required
//   "either": the end user's key when they gave one, otherwise the server key
// userKey() returns { provider, key } for the current request, or null.
export function createAI({ env = {}, settings = {}, fake = false, fetchImpl, userKey = () => null } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;

  function pick(using) {
    const mode = settings.aiKeys || 'server';
    const own = mode === 'server' ? null : userKey();
    if (mode === 'user' && !own) throw new AIKeyRequired('This feature uses your own AI key. Add your key in the app, then try again.');
    if (own) {
      const provider = normalize(own.provider);
      if (!USER_KEY_PROVIDERS.includes(provider)) throw new AIKeyRequired(`Unsupported AI provider "${own.provider}" for your key. Use one of: ${USER_KEY_PROVIDERS.join(', ')}.`);
      const [uProvider, uModel] = splitSpec(using || '');
      const model = (uProvider === provider && uModel) || env[`CLUUB_${provider.toUpperCase()}_MODEL`] || PROVIDERS[provider].model;
      return { provider, model, key: own.key };
    }
    let spec = using || env.CLUUB_AI || settings.ai;
    if (!spec) spec = Object.keys(PROVIDERS).find((p) => PROVIDERS[p].key && env[PROVIDERS[p].key]) || 'ollama';
    const colon = String(spec).indexOf(':');
    let provider = colon < 0 ? String(spec) : String(spec).slice(0, colon);
    let model = colon < 0 ? '' : String(spec).slice(colon + 1);
    provider = provider.toLowerCase();
    if (provider === 'anthropic') provider = 'claude';
    if (provider === 'google') provider = 'gemini';
    if (!PROVIDERS[provider]) throw new AIError(`Unknown AI provider "${provider}". Use one of: ${Object.keys(PROVIDERS).join(', ')}.`);
    model = model || (provider === (settings.ai || '').split(':')[0] && settings.aiModel) || env[`CLUUB_${provider.toUpperCase()}_MODEL`] || PROVIDERS[provider].model;
    const keyName = PROVIDERS[provider].key;
    const key = keyName ? env[keyName] : null;
    if (keyName && !key) throw new AIError(`No API key for ${provider}. Run "cluub ai set ${provider}" (or add ${keyName}=... to .env). Never put keys in code.`);
    return { provider, model, key };
  }

  function normalize(p) { p = String(p || '').toLowerCase(); return p === 'anthropic' ? 'claude' : p === 'google' ? 'gemini' : p; }
  function splitSpec(spec) { const i = String(spec).indexOf(':'); return i < 0 ? [normalize(spec), ''] : [normalize(String(spec).slice(0, i)), String(spec).slice(i + 1)]; }

  async function post(url, headers, body, provider) {
    let res;
    try {
      res = await doFetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout?.(120000) });
    } catch (e) {
      throw new AIError(provider === 'ollama'
        ? `Could not reach Ollama at ${env.OLLAMA_HOST || 'http://localhost:11434'}. Start it with \`ollama serve\`, or set CLUUB_AI=claude in .env.`
        : `Could not reach ${provider}: ${e.message}`);
    }
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = null; }
    if (!res.ok) {
      const detail = json?.error?.message || json?.error || text.slice(0, 200);
      const hint = res.status === 401 ? ' Check that your API key is correct.' : res.status === 429 ? ' You hit a rate limit; wait a moment and try again.' : '';
      throw new AIError(`${provider} returned ${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}.${hint}`);
    }
    return json;
  }

  async function complete(prompt, system, using) {
    const { provider, model, key } = pick(using);
    if (provider === 'claude') {
      const j = await post('https://api.anthropic.com/v1/messages',
        { 'x-api-key': key, 'anthropic-version': '2026-10-21' },
        { model, max_tokens: 16000, ...(system ? { system } : {}), messages: [{ role: 'user', content: prompt }] }, provider);
      if (j.stop_reason === 'refusal') throw new AIError(`Claude declined this request${j.stop_details?.explanation ? `: ${j.stop_details.explanation}` : '.'}`);
      return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    }
    if (provider === 'openai') {
      const j = await post('https://api.openai.com/v1/chat/completions', { authorization: `Bearer ${key}` },
        { model, messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }] }, provider);
      return j.choices?.[0]?.message?.content ?? '';
    }
    if (provider === 'gemini') {
      const j = await post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { 'x-goog-api-key': key },
        { ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents: [{ role: 'user', parts: [{ text: prompt }] }] }, provider);
      return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    }
    const base = env.OLLAMA_HOST || 'http://localhost:11434';
    const j = await post(`${base}/api/chat`, {}, { model, stream: false, messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }] }, provider);
    return j.message?.content ?? '';
  }

  return {
    fake,
    async ask(prompt, opts = {}, models = {}) {
      prompt = String(prompt ?? '');
      if (opts.oneOf) return askOneOf(prompt, opts, complete, fake);
      if (opts.as) return askStructured(prompt, opts, models, complete, fake);
      if (fake) return `AI reply to: ${prompt.slice(0, 60)}`;
      return complete(prompt, opts.system, opts.using);
    },
  };
}

async function askOneOf(prompt, opts, complete, fake) {
  const options = opts.oneOf.map(String);
  if (fake) return options[0];
  const answer = (await complete(`${prompt}\n\nAnswer with exactly one of these options and nothing else: ${options.join(', ')}`, opts.system, opts.using)).trim();
  const exact = options.find((o) => o.toLowerCase() === answer.toLowerCase().replace(/[."']/g, ''));
  if (exact) return exact;
  const loose = options.find((o) => answer.toLowerCase().includes(o.toLowerCase()));
  if (loose) return loose;
  throw new AIError(`The AI answered "${answer.slice(0, 80)}", which is not one of: ${options.join(', ')}.`);
}

export function describeType(type, models) {
  if (type.name === 'list') return `a JSON array of ${describeType(type.of, models)}`;
  const M = models[type.name];
  if (M) return `a JSON object with fields { ${M.def.fields.map((f) => `"${f.name}": ${f.type.name === 'list' ? 'array' : f.type.name}${f.oneOf ? ` (one of ${f.oneOf.join('/')})` : ''}`).join(', ')} }`;
  return { number: 'a JSON number', bool: 'true or false', text: 'a JSON string' }[type.name] || 'JSON';
}

async function askStructured(prompt, opts, models, complete, fake) {
  const build = (data) => {
    const M = models[opts.as.name];
    if (opts.as.name === 'list') { const IM = models[opts.as.of?.name]; return (data || []).map((x) => (IM ? new IM(x) : x)); }
    return M ? new M(data) : data;
  };
  if (fake) {
    const M = models[opts.as.name];
    if (opts.as.name === 'list') { const IM = models[opts.as.of?.name]; return IM ? [IM.sample()] : []; }
    return M ? M.sample() : opts.as.name === 'number' ? 0 : '';
  }
  const instruction = `${prompt}\n\nReply with only ${describeType(opts.as, models)}. No explanation, no markdown.`;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await complete(attempt ? `${instruction}\n\nYour previous reply was invalid: ${lastErr}. Fix it.` : instruction, opts.system, opts.using);
    try {
      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
      return build(JSON.parse(cleaned));
    } catch (e) { lastErr = e.message; }
  }
  throw new AIError(`The AI did not return valid ${opts.as.name} data: ${lastErr}`);
}
