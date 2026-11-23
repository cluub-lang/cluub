// Cluub test runner. Every test gets a fresh backend (empty in-memory stores,
// fake AI, no network) and, when it renders a page, a headless frontend wired
// straight to that backend. So UI tests are real full-stack tests.
import { createBackendR, instantiate, createBackend, CluubRuntimeError, ctxFromHeaders, __eq, __has, __oneOf, __t } from './core.js';
import { createFrontend, h, textOf, findNode } from './client.js';
import { makeR } from './core.js';

export class TestFailure extends Error {
  constructor(message, at) { super(message); this.at = at; this.name = 'TestFailure'; }
}

const show = (v) => (typeof v === 'string' ? JSON.stringify(v) : v === null || v === undefined ? 'nothing' : typeof v === 'object' ? JSON.stringify(v) : String(v));

// Nearest ancestor with the given tag (used for submit buttons inside forms).
function findParent(nodes, target, tag, stack = []) {
  for (const n of [nodes].flat(Infinity)) {
    if (!n || n.text !== undefined) continue;
    if (n === target) return [...stack].reverse().find((p) => p.tag === tag) || null;
    const found = findParent(n.children, target, tag, [...stack, n]);
    if (found !== undefined) return found;
  }
  return undefined;
}

export async function runTests({ serverCode, clientCode, env = {}, filter = null, onResult } = {}) {
  const settings = {};
  const R = createBackendR({ env, settings, fakeAI: true });
  const prog = instantiate(serverCode, R);
  Object.assign(settings, prog.app.settings);
  const clientProg = clientCode ? instantiate(clientCode, makeR({ h })) : null;
  const results = [];
  const started = Date.now();

  for (const t of prog.tests) {
    if (filter && !t.name.toLowerCase().includes(filter.toLowerCase())) continue;
    const backend = createBackend(prog, R, { dev: true });
    let fe = null;
    const ui = () => {
      if (!clientProg) throw new TestFailure('This project has no pages to render.');
      if (!fe) fe = createFrontend(clientProg, { request: (m, u, b, hd) => backend.dispatch(m, u, b, ctxFromHeaders(hd)), headless: true, strict: true, onNavigate: () => {} });
      return fe;
    };
    const settle = async (at) => {
      await fe.settle();
      if (fe.crash) throw new TestFailure(`The page crashed: ${fe.crash.message}`, at);
    };
    const T = {
      dep: (name) => backend.get(name),
      expect(v, src, at) { if (!v) throw new TestFailure(`Expected ${src}, but it was not true.`, at); },
      expectOp(op, l, r, src, at) {
        const ok = { is: () => __eq(l, r), 'is not': () => !__eq(l, r), '<': () => l < r, '>': () => l > r, '<=': () => l <= r, '>=': () => l >= r, has: () => __has(l, r), oneOf: () => __oneOf(l, r) }[op]();
        if (!ok) throw new TestFailure(`Expected ${src}\n      got:      ${show(l)}\n      expected: ${op === 'is' ? '' : op + ' '}${show(r)}`, at);
      },
      async expectFails(fn, message, at) {
        try { await fn(); } catch (e) {
          if (e instanceof TestFailure) throw e;
          if (!(e instanceof CluubRuntimeError)) throw new TestFailure(`It failed, but with an unexpected program error instead of a Cluub error: ${e.message}`, at);
          if (message && !e.message.toLowerCase().includes(String(message).toLowerCase()))
            throw new TestFailure(`It failed as expected, but with the message:\n      "${e.message}"\n    instead of one containing:\n      "${message}"`, at);
          return;
        }
        throw new TestFailure(`Expected this to fail${message ? ` with "${message}"` : ''}, but it succeeded.`, at);
      },
      request: (method, path, body) => backend.dispatch(method, path, body),
      async render(name) {
        const f = ui();
        const p = clientProg.pages.find((x) => x.name === name);
        f.go(p.path.replace(/\{(\w+)\}/g, '1'));
        await settle(`${t.file}:${t.line}`);
      },
      async go(path) { ui().go(path); await settle(); },
      screen: () => textOf(ui().tree),
      async click(label, at) {
        const f = ui();
        const want = String(label).toLowerCase();
        const node = findNode(f.tree, (n) => (n.tag === 'button' || n.tag === 'a') && textOf(n.children).toLowerCase().includes(want));
        if (!node) {
          const all = [];
          findNode(f.tree, (n) => { if (n.tag === 'button' || n.tag === 'a') all.push(`"${textOf(n.children)}"`); return false; });
          throw new TestFailure(`There is no button or link labelled "${label}" on screen.${all.length ? ` Found: ${all.join(', ')}.` : ''}`, at);
        }
        if (node.props.disabled) throw new TestFailure(`The "${label}" button is disabled.`, at);
        const ev = { preventDefault() {}, target: {} };
        if (node.props.onclick) node.props.onclick(ev);
        else if (node.props.type === 'submit') {
          const form = findParent(f.tree, node, 'form');
          if (form?.props.onsubmit) form.props.onsubmit(ev);
        }
        await settle(at);
      },
      async type(value, target, at) {
        const f = ui();
        const want = String(target).toLowerCase();
        const node = findNode(f.tree, (n) => ['input', 'textarea'].includes(n.tag) && String(n.props.placeholder || '').toLowerCase().includes(want));
        if (!node) throw new TestFailure(`There is no input with the placeholder "${target}" on screen.`, at);
        node.props.oninput?.({ target: { value: String(value) } });
        await settle(at);
      },
    };
    const t0 = Date.now();
    let error = null;
    try { await t.run(T); } catch (e) { error = e; }
    const r = { name: t.name, file: t.file, line: t.line, generated: t.generated, ok: !error, ms: Date.now() - t0,
      error: error ? { message: error instanceof TestFailure ? error.message : `Unexpected error: ${error.message}`, at: error.at || `${t.file}:${t.line}` } : null };
    results.push(r);
    onResult?.(r);
  }
  return { results, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, ms: Date.now() - started };
}

export { __t };
