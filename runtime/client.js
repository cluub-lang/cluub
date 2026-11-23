// Cluub UI runtime: a ~250 line virtual DOM, router, typed api client and
// global error handling. Runs in the browser, or headless for tests.
import { makeR, instantiate, pathRegex, ApiError, CluubRuntimeError, aiKeyStore } from './core.js';

// ---------- the end user's own AI key ----------
// Kept only in this browser: sessionStorage by default (gone when the tab closes),
// localStorage when the user ticks "Remember on this device". Sent only to this
// app's own server, in request headers, never in URLs.
const KEY_NAME = 'cluub.aiKey';
const PROVIDER_NAMES = { claude: 'Claude (Anthropic)', openai: 'OpenAI', gemini: 'Google Gemini' };
function installKeyStore(headless) {
  let memory = null;
  const stores = () => (headless ? [] : [globalThis.sessionStorage, globalThis.localStorage].filter(Boolean));
  aiKeyStore.get = () => {
    if (memory) return memory;
    for (const st of stores()) { try { const v = JSON.parse(st.getItem(KEY_NAME) || 'null'); if (v?.key) return v; } catch { /* storage blocked */ } }
    return null;
  };
  aiKeyStore.set = (value, remember = false) => {
    aiKeyStore.clear();
    if (headless) { memory = value; return; }
    try { (remember ? globalThis.localStorage : globalThis.sessionStorage).setItem(KEY_NAME, JSON.stringify(value)); } catch { memory = value; }
  };
  aiKeyStore.clear = () => { memory = null; for (const st of stores()) { try { st.removeItem(KEY_NAME); } catch { /* ignore */ } } };
}
export function aiKeyHeaders() {
  const k = aiKeyStore.get();
  return k ? { 'x-cluub-ai-provider': k.provider, 'x-cluub-ai-key': k.key } : {};
}

// ---------- virtual DOM ----------
function norm(children, out = []) {
  for (const c of children || []) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) norm(c, out);
    else if (typeof c === 'object') out.push(c);
    else out.push({ text: String(c) });
  }
  return out;
}
export const h = (tag, props, children) => ({ tag, props: props || {}, children: norm(children) });

const SAFE_URL = (v) => (/^\s*javascript:/i.test(String(v)) ? '#' : v);

function setProps(el, old, neu) {
  for (const k of Object.keys(old)) if (!(k in neu)) {
    if (k.startsWith('on')) el[k] = null; else if (k === 'class') el.className = ''; else el.removeAttribute(k);
  }
  for (const [k, v] of Object.entries(neu)) {
    if (k.startsWith('on')) el[k] = v;
    else if (k === 'value') { if (el.value !== v) el.value = v ?? ''; }
    else if (k === 'checked' || k === 'disabled') el[k] = !!v;
    else if (k === 'class') { if (el.className !== v) el.className = v || ''; }
    else if (old[k] !== v) el.setAttribute(k, k === 'href' || k === 'src' ? SAFE_URL(v) : v);
  }
}
function create(doc, v) {
  if (v.text !== undefined) return doc.createTextNode(v.text);
  const el = doc.createElement(v.tag);
  setProps(el, {}, v.props);
  for (const c of v.children) el.appendChild(create(doc, c));
  return el;
}
function patchChildren(doc, el, oldK, newK) {
  const n = Math.max(oldK.length, newK.length);
  for (let i = 0; i < n; i++) {
    const o = oldK[i], v = newK[i];
    if (!o) el.appendChild(create(doc, v));
    else if (v) patchNode(doc, el, el.childNodes[i], o, v);
  }
  for (let i = oldK.length - 1; i >= newK.length; i--) el.removeChild(el.childNodes[i]);
}
function patchNode(doc, parent, dom, o, v) {
  if (o.text !== undefined && v.text !== undefined) { if (o.text !== v.text) dom.nodeValue = v.text; return; }
  if (o.text !== undefined || v.text !== undefined || o.tag !== v.tag) { parent.replaceChild(create(doc, v), dom); return; }
  setProps(dom, o.props, v.props);
  patchChildren(doc, dom, o.children, v.children);
}

export function textOf(nodes) {
  return norm([nodes]).map((n) => (n.text !== undefined ? n.text : [n.props.value, n.props.placeholder, textOf(n.children)].filter(Boolean).join(' '))).join(' ').replace(/\s+/g, ' ').trim();
}
export function findNode(nodes, pred) {
  for (const n of norm([nodes])) {
    if (n.text !== undefined) continue;
    if (pred(n)) return n;
    const f = findNode(n.children, pred);
    if (f) return f;
  }
  return null;
}

// ---------- the app ----------
export function createFrontend(prog, { request, root = null, doc = globalThis.document, headless = false, strict = false, onNavigate } = {}) {
  installKeyStore(headless);
  const keyForm = { provider: 'claude', key: '', remember: false };
  let page = null, tree = [], path = '/', renderQueued = false, toast = null, pending = 0, crash = null;

  const api = {};
  for (const [name, routes] of Object.entries(prog.apiSpec)) {
    api[name] = {};
    for (const [rname, r] of Object.entries(routes)) {
      api[name][rname] = async (...args) => {
        let url = r.path; const q = new URLSearchParams(); let body = null;
        r.params.forEach((p, i) => {
          const v = args[i];
          if (v === undefined) return;
          if (p.from === 'path') url = url.replace(`{${p.name}}`, encodeURIComponent(v));
          else if (p.from === 'query') { if (v !== null) q.set(p.name, typeof v === 'object' ? JSON.stringify(v) : v); }
          else (body ||= {})[p.name] = v;
        });
        if (q.toString()) url += `?${q}`;
        const res = await request(r.method, url, body, aiKeyHeaders());
        if (res.status >= 400) throw new ApiError(res.body?.error?.message || `Request failed (${res.status})`, res.status, res.body);
        return res.body;
      };
    }
  }

  const matchers = prog.pages.map((p) => ({ p, re: pathRegex(p.path.replace(/\/$/, '') || '/') }));
  function match(to) {
    const clean = to.split('?')[0].replace(/\/+$/, '') || '/';
    for (const { p, re } of matchers) { const m = clean.match(re); if (m) return { p, params: { ...(m.groups || {}) } }; }
    return null;
  }

  function schedule() {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(() => { renderQueued = false; render(); });
  }

  function showError(e) {
    const known = e instanceof CluubRuntimeError;
    if (!known) {
      console.error(e);
      if (strict) crash = crash || e;
    }
    toast = { message: known ? e.message : `Something went wrong: ${e.message}`, at: Date.now() };
    if (!headless) setTimeout(() => { if (toast && Date.now() - toast.at >= 4900) { toast = null; schedule(); } }, 5000);
  }

  async function run(fn, e) {
    pending++;
    try { await fn(e); } catch (err) { showError(err); } finally {
      pending--; schedule();

    }
  }

  function makeDollar(params) {
    return {
      api, params, C: prog.components,
      state(init) {
        return new Proxy(init, { set(t, k, v) { t[k] = v; schedule(); return true; } });
      },
      on: (fn) => (e) => run(fn, e),
      // The built-in `aikey` element: lets the end user add or forget their own AI key.
      aiKeyForm() {
        const saved = aiKeyStore.get();
        if (saved) {
          return [h('div', { class: 'card cluub-aikey' }, [
            h('p', {}, [`Using your own ${PROVIDER_NAMES[saved.provider] || saved.provider} key (ending ${saved.key.slice(-4)}).`]),
            h('button', { type: 'button', class: 'ghost', onclick: () => { aiKeyStore.clear(); schedule(); } }, ['Forget my key']),
          ])];
        }
        return [h('div', { class: 'card cluub-aikey' }, [
          h('p', {}, ['Use your own AI key. It stays in this browser and is sent only with your requests to this app.']),
          h('div', { class: 'row' }, [
            h('select', { 'aria-label': 'AI provider', value: keyForm.provider, onchange: (e) => { keyForm.provider = e.target.value; schedule(); } },
              Object.entries(PROVIDER_NAMES).map(([v, label]) => h('option', { value: v }, [label]))),
            h('input', { type: 'password', placeholder: 'Paste your API key', 'aria-label': 'Your API key', autocomplete: 'off', value: keyForm.key, oninput: (e) => { keyForm.key = e.target.value; schedule(); } }),
          ]),
          h('label', {}, [h('input', { type: 'checkbox', checked: keyForm.remember, onchange: (e) => { keyForm.remember = e.target.checked; schedule(); } }), ' Remember on this device']),
          h('button', { type: 'button', class: 'primary', disabled: !keyForm.key.trim(), onclick: () => {
            aiKeyStore.set({ provider: keyForm.provider, key: keyForm.key.trim() }, keyForm.remember);
            keyForm.key = ''; schedule();
          } }, ['Save key']),
        ])];
      },
      touch: schedule,
      key: (k, handler) => (e) => { if (e.key === k) { e.preventDefault?.(); handler(e); } },
      submit: (handler) => (e) => { e.preventDefault?.(); if (handler) handler(e); },
      link: (href) => (e) => { if (e.metaKey || e.ctrlKey || /^https?:/.test(href)) return; e.preventDefault?.(); go(href); },
      go,
    };
  }

  function go(to, replace = false) {
    path = to;
    const m = match(to);
    if (!headless && globalThis.history && !onNavigate) { if (replace) history.replaceState({}, '', to); else history.pushState({}, '', to); }
    onNavigate?.(to);
    toast = null;
    if (!m) { page = { notFound: true }; render(); return; }
    const $ = makeDollar(m.params);
    page = { def: m.p, $, inst: m.p.create($) };
    render();
    if (!replace && !headless) queueMicrotask(() => { const main = root?.querySelector('main'); if (main) { main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: false }); } });
    run(() => page.inst.load());
  }

  function view() {
    if (!page) return [];
    if (page.notFound) return [h('main', { class: 'cluub-page' }, [h('h1', {}, ['Page not found']), h('p', {}, [`Nothing lives at ${path}.`]), h('a', { href: '/', onclick: makeDollar({}).link('/') }, ['Go home'])])];
    let out;
    try {
      const body = page.inst.view();
      const L = page.def.layout && prog.layouts[page.def.layout];
      out = L ? L([h('main', { class: 'cluub-page' }, [body])], page.$) : [h('main', { class: 'cluub-page' }, [body])];
    } catch (e) {
      if (strict) crash = crash || e;
      console.error(e);
      out = [h('main', { class: 'cluub-page' }, [h('div', { class: 'cluub-crash', role: 'alert' }, [`This page hit an error while drawing: ${e.message}`])])];
    }
    if (toast) out = [...norm([out]), h('div', { class: 'cluub-toast', role: 'alert', onclick: () => { toast = null; schedule(); } }, [toast.message])];
    return norm([out]);
  }

  function render() {
    const next = view();
    if (!headless && root) {
      patchChildren(doc, root, tree, next);
      try { const t = page?.inst?.title?.(); if (t) doc.title = `${t}`; } catch { /* title errors are non-fatal */ }
    }
    tree = next;
  }

  const app = {
    api, go,
    get tree() { return tree; },
    get toast() { return toast; },
    get crash() { return crash; },
    async settle() {
      for (let i = 0; i < 500; i++) {
        await new Promise((r) => setTimeout(r, 0));
        if (!pending && !renderQueued) return;
      }
    },
    start(initial) {
      if (!headless && globalThis.addEventListener && !onNavigate) addEventListener('popstate', () => go(location.pathname + location.search, true));
      go(initial ?? (globalThis.location ? location.pathname + location.search : '/'), true);
      return app;
    },
  };
  return app;
}

// Accepts the generated program as a function (browser module) or as source text (playground).
export function bootClient(program, opts) {
  const R = makeR({ h });
  const prog = typeof program === 'function' ? program(R) : instantiate(program, R);
  R.models = prog.models;
  return createFrontend(prog, opts);
}

export { makeR, instantiate };
