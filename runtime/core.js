// Cluub core runtime: helpers, models, stores, dependency container and the
// api dispatcher. Browser-safe: no Node imports, so the playground uses it too.
import { msg, describe } from './messages.js';
import { ValidationError, Fail, NotFound, NetworkError, CluubRuntimeError, toError } from './errors.js';
import { createAI, USER_KEY_PROVIDERS } from './ai.js';
import { suggest } from '../compiler/diagnostics.js';

export * from './errors.js';

// ---------- helpers used by generated code ----------
export const __t = (x) => {
  if (x === null || x === undefined) return '';
  if (typeof x === 'number') return Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100);
  if (Array.isArray(x)) return x.map(__t).join(', ');
  if (typeof x === 'object') return JSON.stringify(x);
  return String(x);
};
const plain = (x) => (x && typeof x === 'object' ? JSON.stringify(x) : x);
export const __eq = (a, b) => (a ?? null) === (b ?? null) || (typeof a === 'object' && typeof b === 'object' && a && b && plain(a) === plain(b));
export const __has = (a, b) => {
  if (a == null) return false;
  if (typeof a === 'string') return a.toLowerCase().includes(String(b).toLowerCase());
  if (Array.isArray(a)) return a.some((x) => __eq(x, b));
  return Object.prototype.hasOwnProperty.call(a, b);
};
export const __oneOf = (a, list) => (list || []).some((x) => __eq(a, x));
export const __empty = (x) => x == null || (typeof x === 'string' && x.trim() === '') || (Array.isArray(x) && !x.length) || (typeof x === 'object' && !Array.isArray(x) && !(x instanceof Model) && !Object.keys(x).length);
export const __count = (x) => (x == null ? 0 : typeof x === 'string' || Array.isArray(x) ? x.length : typeof x === 'object' ? Object.keys(x).length : 0);
export const __first = (x) => (x == null ? null : x[0] ?? null);
export const __last = (x) => (x == null || !x.length ? null : x[x.length - 1]);
export const __list = (x) => (x == null ? [] : Array.isArray(x) ? x : typeof x === 'string' ? [...x] : [x]);
export const __take = (list, n) => __list(list).slice(0, Math.max(0, n));
export const __skip = (list, n) => __list(list).slice(Math.max(0, n));
export const __reversed = (list) => [...__list(list)].reverse();
export const __sortBy = (list, fn) => [...__list(list)].sort((a, b) => { const x = fn(a), y = fn(b); return x < y ? -1 : x > y ? 1 : 0; });

// Per-request context (for example the end user's own AI key). Node replaces this
// with AsyncLocalStorage so concurrent requests never see each other's data.
let currentCtx = null;
let ctxProvider = {
  run: (ctx, fn) => { const prev = currentCtx; currentCtx = ctx; return Promise.resolve().then(fn).finally(() => { currentCtx = prev; }); },
  get: () => currentCtx,
};
export function setRequestContext(provider) { ctxProvider = provider; }
export const requestContext = () => ctxProvider.get();

// Reads the end user's own AI key from request headers. Keys are never logged or stored.
export function ctxFromHeaders(headers = {}) {
  const key = headers['x-cluub-ai-key'];
  const provider = String(headers['x-cluub-ai-provider'] || '').toLowerCase();
  if (!key || typeof key !== 'string' || key.length > 400 || !USER_KEY_PROVIDERS.includes(provider)) return { aiKey: null };
  return { aiKey: { provider, key: key.trim() } };
}

// Where the browser keeps the end user's own AI key. client.js installs the real one.
export const aiKeyStore = { get: () => null, set() {}, clear() {} };

let idCounter = 0;
export const B = {
  now: () => new Date().toISOString(),
  today: () => new Date().toISOString().slice(0, 10),
  round: (x, digits = 0) => { const f = 10 ** digits; return Math.round(Number(x) * f) / f; },
  text: (x) => __t(x),
  number: (x) => { const n = Number(x); if (!Number.isFinite(n)) throw new ValidationError(`Can't turn ${describe(x)} into a number`); return n; },
  uuid: () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${(idCounter++).toString(36)}`),
  json: (x) => JSON.stringify(x, null, 2),
  random: (min = 0, max = 1) => Math.floor(Math.random() * (max - min + 1)) + min,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  hasAiKey: () => !!aiKeyStore.get(),
};

// ---------- models ----------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateValue(label, f, v, models) {
  const type = f.type || { name: 'any' };
  const missing = v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (f.required && Array.isArray(v) && v.length === 0);
  if (missing) {
    if (f.required) throw new ValidationError(f.requiredMessage || msg.required(label), label);
    if (v === undefined || v === null) return null;
    return ['text', 'id', 'any'].includes(type.name) ? v : (type.name === 'list' ? v : null);
  }
  switch (type.name) {
    case 'text': case 'id':
      if (typeof v === 'number') v = String(v);
      if (typeof v !== 'string') throw new ValidationError(msg.type(label, 'text', v), label);
      break;
    case 'email':
      if (typeof v !== 'string' || !EMAIL.test(v)) throw new ValidationError(f.emailMessage || msg.email(label), label);
      break;
    case 'url':
      if (typeof v !== 'string' || !/^https?:\/\/\S+$/.test(v)) throw new ValidationError(msg.url(label), label);
      break;
    case 'date':
      if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) throw new ValidationError(msg.date(label), label);
      break;
    case 'number':
      if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) v = Number(v);
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new ValidationError(msg.type(label, 'number', v), label);
      break;
    case 'bool':
      if (v === 'true' || v === 'yes') v = true; else if (v === 'false' || v === 'no') v = false;
      if (typeof v !== 'boolean') throw new ValidationError(msg.type(label, 'bool', v), label);
      break;
    case 'list':
      if (!Array.isArray(v)) throw new ValidationError(msg.type(label, 'list', v), label);
      if (type.of) v = v.map((x, i) => validateValue(`${label}[${i + 1}]`, { type: type.of }, x, models));
      break;
    case 'any': case 'action': break;
    default: {
      const M = models?.[type.name];
      if (M && !(v instanceof M)) {
        if (typeof v !== 'object') throw new ValidationError(msg.type(label, type.name, v), label);
        v = new M(v);
      }
    }
  }
  const size = typeof v === 'string' || Array.isArray(v) ? v.length : v;
  const kind = Array.isArray(v) ? 'List' : typeof v === 'string' ? 'Text' : 'Number';
  if (f.min != null && size < f.min) throw new ValidationError(f.minMessage || msg[`min${kind}`](label, f.min), label);
  if (f.max != null && size > f.max) throw new ValidationError(f.maxMessage || msg[`max${kind}`](label, f.max), label);
  if (f.oneOf && !__oneOf(v, f.oneOf)) throw new ValidationError(f.oneOfMessage || msg.oneOf(label, f.oneOf), label);
  return v;
}

function emptyFor(type) {
  if (type.optional) return null;
  return { text: '', email: '', url: '', date: '', id: '', number: 0, bool: false, list: [] }[type.name] ?? null;
}

export class Model {
  constructor(data = {}) {
    const def = this.constructor.def;
    if (data instanceof Model) data = data.toJSON();
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new ValidationError(`${def.name} must be created from named values, like ${def.name}(${def.fields[0]?.name || 'name'}: ...)`);
    const names = def.fields.map((f) => f.name);
    for (const k of Object.keys(data)) if (k !== 'id' && !names.includes(k)) throw new ValidationError(msg.unknownField(def.name, k, suggest(k, names)), k);
    if (data.id !== undefined && data.id !== null) this.id = String(data.id);
    for (const f of def.fields) {
      let v = data[f.name];
      if (v === undefined) v = f.default ? f.default() : f.required ? undefined : emptyFor(f.type);
      this[f.name] = validateValue(f.name, f, v, def.models);
    }
  }
  toJSON() {
    const o = {};
    if (this.id !== undefined) o.id = this.id;
    for (const f of this.constructor.def.fields) o[f.name] = this[f.name] instanceof Model ? this[f.name].toJSON() : this[f.name];
    return o;
  }
  static sample() {
    const o = {};
    for (const f of this.def.fields) o[f.name] = sampleValue(f, this.def.models);
    return new this(o);
  }
}

export function sampleValue(f, models = {}) {
  if (f.oneOf) return f.oneOf[0];
  const t = f.type;
  switch (t.name) {
    case 'text': case 'id': { let s = `Sample ${f.name}`; if (f.min && s.length < f.min) s = s.padEnd(f.min, 'x'); if (f.max && s.length > f.max) s = s.slice(0, f.max); return s; }
    case 'email': return 'user@example.com';
    case 'url': return 'https://example.com';
    case 'date': return '2026-01-31';
    case 'number': return f.min ?? (f.max != null ? Math.min(1, f.max) : 1);
    case 'bool': return true;
    case 'list': return Array.from({ length: Math.max(f.min || 0, f.required ? 1 : 0) }, (_, i) => sampleValue({ name: `${f.name}${i + 1}`, type: t.of || { name: 'text' } }, models));
    case 'any': return null;
    default: return models[t.name] ? models[t.name].sample().toJSON() : null;
  }
}

// ---------- stores (data layer) ----------
export class MemoryStore {
  constructor(name, M) { this.name = name; this.M = M; this.items = new Map(); this.next = 1; }
  copy(item) { return new this.M(item.toJSON()); }
  label() { return this.M.def.name; }
  async all() { return [...this.items.values()].map((x) => this.copy(x)); }
  async find(id) { const x = this.items.get(String(id)); return x ? this.copy(x) : null; }
  async get(id) { const x = this.items.get(String(id)); if (!x) throw new NotFound(msg.notFound(this.label(), id)); return this.copy(x); }
  async add(item) {
    const m = item instanceof this.M ? new this.M(item.toJSON()) : new this.M(item);
    if (m.id === undefined || m.id === '') m.id = String(this.next);
    if (this.items.has(m.id)) throw new Fail(`${this.label()} "${m.id}" already exists`, 409);
    this.next = Math.max(this.next, (Number(m.id) || 0)) + 1;
    this.items.set(m.id, m);
    await this.persist();
    return this.copy(m);
  }
  async update(id, changes) {
    const current = await this.get(id);
    const patch = changes instanceof Model ? changes.toJSON() : (changes || {});
    const m = new this.M({ ...current.toJSON(), ...patch, id: current.id });
    this.items.set(m.id, m);
    await this.persist();
    return this.copy(m);
  }
  async remove(id) { await this.get(id); this.items.delete(String(id)); await this.persist(); return true; }
  async where(fn) { return (await this.all()).filter(fn); }
  async count() { return this.items.size; }
  async clear() { this.items.clear(); this.next = 1; await this.persist(); }
  load(list) { for (const x of list || []) { const m = new this.M(x); this.items.set(m.id, m); this.next = Math.max(this.next, (Number(m.id) || 0) + 1); } }
  async persist() {}
}

// ---------- network layer ----------
export function createClient(spec, env, fetchImpl) {
  const out = {};
  for (const [name, r] of Object.entries(spec.routes)) {
    out[name] = async (...args) => {
      let path = r.path;
      const query = new URLSearchParams();
      let body = null;
      r.params.forEach((p, i) => {
        let v = args[i] === undefined && p.default ? p.default() : args[i];
        if (v === undefined || v === null) { if (!p.optional) throw new ValidationError(msg.missingParam(p.name), p.name); return; }
        v = validateValue(p.name, { type: p.type }, v, {});
        if (p.from === 'path' || path.includes(`{${p.name}}`)) path = path.replace(`{${p.name}}`, encodeURIComponent(v));
        else if (p.from === 'query') query.set(p.name, v);
        else (body ||= {})[p.name] = v;
      });
      if (!fetchImpl) return null; // tests: arguments are checked, but there is no real network
      const qs = query.toString();
      const url = spec.base.replace(/\/$/, '') + path + (qs ? (path.includes('?') ? '&' : '?') + qs : '');
      let res;
      try {
        res = await fetchImpl(url, { method: r.method, headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...spec.headers() }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout?.(15000) });
      } catch (e) {
        throw new NetworkError(`${spec.name}.${name} could not reach ${url}: ${e.name === 'TimeoutError' ? 'timed out after 15s' : e.message}`);
      }
      const text = await res.text();
      if (!res.ok) throw new NetworkError(`${spec.name}.${name} failed: ${r.method} ${url} returned ${res.status} ${res.statusText}${text ? ` (${text.slice(0, 120)})` : ''}`);
      try { return JSON.parse(text); } catch { return text; }
    };
  }
  return out;
}

// ---------- the R object passed to generated programs ----------
export function makeR(extra = {}) {
  const R = {
    h: (tag, props, children) => ({ tag, props: props || {}, children }),
    B, __t, __eq, __has, __oneOf, __empty, __count, __first, __last, __list, __sortBy, __take, __skip, __reversed,
    Model, ValidationError, Fail, toError, env: {}, models: {},
    log: (...a) => console.log('[log]', ...a.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x))),
    ...extra,
  };
  return R;
}

export function instantiate(code, R) {
  // eslint-disable-next-line no-new-func
  const prog = new Function('R', code)(R);
  R.models = prog.models;
  return prog;
}

// ---------- backend: container + api dispatcher ----------
export function createBackend(prog, R, { storeFactory, fetchImpl = null, dev = true, onError } = {}) {
  const deps = {};
  const get = (name) => {
    if (deps[name]) return deps[name];
    if (prog.stores[name]) {
      const s = prog.stores[name];
      return (deps[name] = storeFactory ? storeFactory(name, prog.models[s.model], s.file) : new MemoryStore(name, prog.models[s.model]));
    }
    if (prog.clients[name]) return (deps[name] = createClient(prog.clients[name], R.env, fetchImpl));
    if (prog.services[name]) {
      const S = prog.services[name];
      const d = {};
      for (const u of S.uses) d[u] = get(u);
      return (deps[name] = new S(d));
    }
    const api = prog.apis.find((a) => a.name === name);
    if (api) {
      const facade = {};
      for (const r of api.routes) facade[r.name] = async (...values) => {
        const args = {};
        r.params.forEach((p, i) => {
          const raw = values[i];
          if (raw === undefined || raw === null || raw === '') {
            if (!p.optional) throw new ValidationError(msg.missingParam(p.name), p.name);
            args[p.name] = p.default ? p.default() : null;
          } else args[p.name] = validateValue(p.name, { type: p.type }, raw, prog.models);
        });
        const d = {};
        for (const u of api.uses) d[u] = get(u);
        const result = await r.handler(d, args);
        return result === undefined ? null : JSON.parse(JSON.stringify(result ?? null));
      };
      return (deps[name] = facade);
    }
    throw new Error(`Unknown dependency ${name}`);
  };
  // Static path segments win over {params}: /todos/stats is matched before /todos/{id}.
  const score = (p) => p.split('/').map((seg) => (seg.startsWith('{') ? '1' : '0')).join('');
  const routes = prog.apis.flatMap((api) => api.routes.map((r) => ({ ...r, api, re: pathRegex(r.path) })))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length || score(a.path).localeCompare(score(b.path)));

  async function dispatch(method, rawUrl, body, ctx = null) {
    const url = new URL(rawUrl, 'http://cluub.local');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const allowed = new Set();
    for (const r of routes) {
      const m = path.match(r.re);
      if (!m) continue;
      if (r.method !== method) { allowed.add(r.method); continue; }
      try {
        const args = {};
        for (const p of r.params) {
          let raw = p.from === 'path' ? decodeURIComponent(m.groups[p.name]) : p.from === 'query' ? url.searchParams.get(p.name) : body?.[p.name];
          if (raw === undefined || raw === null || raw === '') {
            if (p.optional) { args[p.name] = p.default ? p.default() : null; continue; }
            throw new ValidationError(msg.missingParam(p.name), p.name);
          }
          args[p.name] = validateValue(p.name, { type: p.type }, raw, prog.models);
        }
        const d = {};
        for (const u of r.api.uses) d[u] = get(u);
        const result = await ctxProvider.run(ctx, () => r.handler(d, args));
        return { status: result === undefined ? 204 : 200, body: result === undefined ? null : JSON.parse(JSON.stringify(result ?? null)) };
      } catch (e) {
        return errorResponse(e, `${r.api.name}.${r.name}`, dev, onError);
      }
    }
    if (allowed.size) return { status: 405, body: { error: { code: 'method', message: `${method} is not allowed on ${path}. Use ${[...allowed].join(' or ')}.` } } };
    return { status: 404, body: { error: { code: 'not_found', message: `No api route matches ${method} ${path}` } } };
  }

  return { get, dispatch, routes };
}

export function errorResponse(e, where, dev, onError) {
  if (e instanceof CluubRuntimeError && e.status < 500) return { status: e.status, body: { error: e.toJSON() } };
  if (e instanceof CluubRuntimeError) {
    onError?.(e, where);
    // Messages you wrote with `fail` are meant for users and always shown.
    // Automatic AI/network errors may contain upstream details, so production hides them.
    if (dev || e.code === 'failed' || e.code === 'not_found' || e.code === 'forbidden') return { status: e.status, body: { error: e.toJSON() } };
    const safe = { ai: 'The AI service is not available right now. Please try again.', network: 'An outside service is not available right now. Please try again.' }[e.code] || 'Something went wrong on the server.';
    return { status: e.status, body: { error: { code: e.code, message: safe } } };
  }
  onError?.(e, where);
  return { status: 500, body: { error: { code: 'internal', message: dev ? `Unexpected error in ${where}: ${e.message}` : 'Something went wrong on the server.' } } };
}

export function pathRegex(path) {
  const src = path.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{([A-Za-z_]\w*)\\?\}/g, '(?<$1>[^/]+)');
  return new RegExp(`^${src}$`);
}

export function createBackendR({ env = {}, settings = {}, fakeAI = false, fetchImpl } = {}) {
  const R = makeR({ env });
  const ai = createAI({ env, settings, fake: fakeAI, fetchImpl, userKey: () => requestContext()?.aiKey || null });
  R.ai = { ask: (p, o) => ai.ask(p, o, R.models) };
  return R;
}
