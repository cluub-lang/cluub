// Checker: resolves every name, enforces the layer architecture and naming rules,
// and produces suggestions (SOLID lints). It annotates the AST for code generation:
//   Name.ref      -> what the name refers to
//   Call.resolved -> parameter order, so named arguments become positional
import { suggest } from './diagnostics.js';

export const BUILTIN_TYPES = ['text', 'number', 'bool', 'email', 'date', 'id', 'any', 'list', 'action', 'url'];
export const STORE_METHODS = {
  all: [], find: ['id'], get: ['id'], add: ['item'], update: ['id', 'changes'], remove: ['id'],
  where: ['test'], count: [], clear: [],
};
export const BUILTINS = {
  now: { fn: true }, today: { fn: true }, round: { fn: true }, text: { fn: true }, number: { fn: true },
  uuid: { fn: true }, json: { fn: true }, random: { fn: true }, sleep: { fn: true }, hasAiKey: { fn: true },
  env: { backend: true }, screen: { test: true }, app: {},
};
// Which layer may depend on which (Dependency Inversion: the arrows point inward).
export const LAYERS = {
  Service: ['Store', 'Client', 'Service'],
  Api: ['Service'],
  Page: ['Api'],
  Component: [], Layout: [],
};
const LAYER_WORD = { Store: 'data', Client: 'network', Service: 'service', Api: 'backend', Page: 'UI', Component: 'UI', Layout: 'UI', Model: 'model' };
const an = (w) => (/^[aeiou]/i.test(w) && !/^(ui|u[bcdfgklmnprstv][aeiou])/i.test(w) ? `an ${w}` : `a ${w}`); // "a UI page", "an api"
export const APP_SETTINGS = ['about', 'port', 'ai', 'aiModel', 'aiKeys', 'lang'];
export const FOLDERS = {
  App: '', Model: 'models', Store: 'data', Client: 'network', Service: 'services', Api: 'api',
  Page: 'ui/pages', Component: 'ui/components', Layout: 'ui/layouts', Test: 'tests',
};
const UI = ['Page', 'Component', 'Layout'];
const SECRET = /(sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}|xox[bp]-[A-Za-z0-9-]{10,})/;
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const CAMEL = /^[a-z][A-Za-z0-9]*$/;

export function pathParams(text) { return [...(text || '').matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]); }

// Full parameter list of a route: path params first, then `with` params.
export function routeParams(route, base = '') {
  const names = pathParams(base + route.pathText);
  const out = names.map((n) => route.params.find((p) => p.name === n) || { name: n, type: { name: 'text' }, from: 'path' });
  out.forEach((p) => { p.from = 'path'; });
  for (const p of route.params) if (!names.includes(p.name)) { p.from = ['GET', 'DELETE'].includes(route.method) ? 'query' : 'body'; out.push(p); }
  return out;
}

export function check(programs, rep, opts = {}) {
  const decls = new Map();
  const all = programs.flatMap((p) => p.decls);
  for (const d of all) {
    if (d.kind === 'Test') continue;
    if (d.kind === 'App') { if (!PASCAL.test(d.name)) rep.error({ code: 'E102', message: `"${d.name}" should be PascalCase (start with a capital letter, no underscores).`, hint: `Rename it to "${pascal(d.name)}".`, file: d.file, line: d.line, col: d.col }); continue; }
    if (decls.has(d.name)) {
      const prev = decls.get(d.name);
      rep.error({ code: 'E101', message: `"${d.name}" is declared twice (first as a ${prev.kind.toLowerCase()} in ${prev.file}:${prev.line}).`,
        hint: 'Give each declaration a unique name.', file: d.file, line: d.line, col: d.col, length: d.name.length });
    } else decls.set(d.name, d);
    if (!PASCAL.test(d.name)) rep.error({ code: 'E102', message: `"${d.name}" should be PascalCase (start with a capital letter, no underscores).`,
      hint: `Rename it to "${pascal(d.name)}".`, file: d.file, line: d.line, col: d.col });
  }
  if (opts.enforceFolders) for (const d of all) {
    const want = FOLDERS[d.kind];
    const ok = d.kind === 'App' ? !d.file.includes('/') : d.file.startsWith(want + '/');
    if (!ok) rep.error({ code: 'E301', message: `${an(d.kind.toLowerCase())[0].toUpperCase()}${an(d.kind.toLowerCase()).slice(1)} belongs in the "${want || 'project root (app.clb)'}" folder, but "${d.name ?? d.title}" is in ${d.file}.`,
      hint: `Move it to ${want ? want + '/' : ''}${d.kind === 'App' ? 'app.clb' : kebab(d.name || d.title || 'my') + (d.kind === 'Test' ? '.test' : '') + '.clb'}. Every Cluub project has the same layout so anyone can find anything.`,
      file: d.file, line: d.line, col: d.col });
  }

  const C = new Checker(decls, rep, opts);
  for (const d of all) C.decl(d);
  C.cycles();
  return { decls };
}

function kebab(s) { return String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase(); }
function pascal(s) { return s.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase()).replace(/_/g, ''); }
function camel(s) { const p = pascal(s); return p[0].toLowerCase() + p.slice(1); }

class Checker {
  constructor(decls, rep, opts) { this.decls = decls; this.rep = rep; this.opts = opts; }

  err(code, message, hint, at, length) { this.rep.error({ code, message, hint, file: at.file || this.file, line: at.line, col: at.col, length }); }
  warn(code, message, hint, at, length) { this.rep.warn({ code, message, hint, file: at.file || this.file, line: at.line, col: at.col, length }); }
  info(code, message, hint, at) { this.rep.hint({ code, message, hint, file: at.file || this.file, line: at.line, col: at.col }); }

  camelName(name, what, at) {
    if (!CAMEL.test(name)) this.err('E103', `The ${what} "${name}" should be camelCase (start lowercase, no underscores).`, `Rename it to "${camel(name)}".`, at, name.length);
  }

  checkType(ty) {
    if (!ty) return;
    if (!BUILTIN_TYPES.includes(ty.name) && !(this.decls.get(ty.name)?.kind === 'Model')) {
      const s = suggest(ty.name, [...BUILTIN_TYPES, ...[...this.decls.values()].filter((d) => d.kind === 'Model').map((d) => d.name)]);
      this.err('E105', `Unknown type "${ty.name}".`, s ? `Did you mean "${s}"?` : `Types are: ${BUILTIN_TYPES.join(', ')} or a model name.`, ty, ty.name.length);
    }
    if (ty.of) this.checkType(ty.of);
  }

  decl(d) {
    this.file = d.file;
    const fn = this[`d${d.kind}`];
    if (fn) fn.call(this, d);
    if (['Service', 'Api', 'Page'].includes(d.kind) && !d.about)
      this.info('W104', `Add an \`about\` line describing what ${d.name} does.`, 'It powers `cluub explain` for product owners, BAs and QAs.', d);
  }

  usesCheck(d) {
    const allowed = LAYERS[d.kind];
    const seen = new Set();
    for (const u of d.uses) {
      if (seen.has(u.name)) this.warn('W101', `"${u.name}" is listed twice in \`uses\`.`, 'Remove the duplicate.', u);
      seen.add(u.name);
      const target = this.decls.get(u.name);
      if (!target) {
        const s = suggest(u.name, [...this.decls.keys()]);
        this.err('E104', `Unknown dependency "${u.name}".`, s ? `Did you mean "${s}"?` : 'Declare it first, or check the spelling.', u, u.name.length);
      } else if (!allowed.includes(target.kind)) {
        this.err('E201', layerMessage(d, target), layerHint(d, target), u, u.name.length);
      }
    }
  }

  dModel(d) {
    const names = new Set();
    for (const f of d.fields) {
      this.camelName(f.name, 'field', f);
      if (names.has(f.name)) this.err('E115', `Field "${f.name}" appears twice.`, undefined, f);
      names.add(f.name);
      this.checkType(f.type);
      if (f.default) this.expr(f.default, this.ctx(d, 'Model'));
    }
  }

  dStore(d) {
    const m = this.decls.get(d.holds);
    if (!m || m.kind !== 'Model') this.err('E105', `Store ${d.name} holds "${d.holds}", which is not a model.`,
      suggest(d.holds, [...this.decls.values()].filter((x) => x.kind === 'Model').map((x) => x.name)) ? `Did you mean "${suggest(d.holds, [...this.decls.values()].filter((x) => x.kind === 'Model').map((x) => x.name))}"?` : 'Declare the model first: `model Name`.', d.holdsAt);
  }

  dClient(d) {
    const ctx = this.ctx(d, 'Client');
    this.expr(d.base, ctx);
    for (const h of d.headers) { this.expr(h.name, ctx); this.expr(h.value, ctx); }
    this.routes(d, d.routes, '');
  }

  routes(d, routes, base) {
    const names = new Set();
    for (const r of routes) {
      this.camelName(r.name, 'route', r);
      if (names.has(r.name)) this.err('E115', `Route "${r.name}" is defined twice in ${d.name}.`, 'Each route needs its own name.', r);
      names.add(r.name);
      const sig = `${r.method} ${(base + r.pathText).replace(/\{\w+\}/g, '{}').replace(/\/$/, '')}`;
      (this.sigs ||= new Map());
      if (d.kind !== 'Api') { /* client routes call other servers */ }
      else if (this.sigs.has(sig)) this.err('E115', `${d.name}.${r.name} has the same method and path as ${this.sigs.get(sig)} (${sig}).`, 'Only one route can answer a request; change the path or the method.', r);
      else this.sigs.set(sig, `${d.name}.${r.name}`);
      r.allParams = routeParams(r, base);
      for (const p of r.params) this.checkType(p.type);
    }
  }

  dService(d) {
    this.usesCheck(d);
    const ctx = this.ctx(d, 'Service');
    this.actions(d, d.actions, ctx);
    if (d.actions.length > 8) this.warn('W103', `${d.name} has ${d.actions.length} actions. Large services are hard to test and change.`,
      'Split it into smaller services with one responsibility each (Single Responsibility Principle).', d);
    this.unused(d, ctx);
  }

  actions(d, actions, ctx) {
    const names = new Set();
    for (const a of actions) {
      this.camelName(a.name, 'action', a);
      if (names.has(a.name)) this.err('E115', `Action "${a.name}" is defined twice in ${d.name}.`, undefined, a);
      names.add(a.name);
      for (const p of a.params) { this.camelName(p.name, 'parameter', p); this.checkType(p.type); }
      this.checkType(a.returns);
      const scope = new Map(a.params.map((p) => [p.name, { kind: 'local' }]));
      this.block(a.body, ctx, scope);
      const size = countStatements(a.body);
      if (size > 25) this.warn('W102', `Action "${a.name}" has ${size} statements.`,
        'Split it into smaller actions that each do one thing (Single Responsibility Principle).', a);
    }
  }

  dApi(d) {
    this.usesCheck(d);
    const ctx = this.ctx(d, 'Api');
    this.routes(d, d.routes, d.baseText);
    for (const r of d.routes) {
      const scope = new Map(r.allParams.map((p) => [p.name, { kind: 'local' }]));
      this.block(r.body, ctx, scope);
    }
    this.unused(d, ctx);
  }

  dPage(d) {
    this.usesCheck(d);
    const ctx = this.ctx(d, 'Page');
    for (const s of d.states) { this.camelName(s.name, 'state', s); this.checkType(s.type); this.expr(s.init, ctx); }
    if (d.layout) {
      const l = this.decls.get(d.layout.name);
      if (!l || l.kind !== 'Layout') this.err('E116', `Unknown layout "${d.layout.name}".`,
        suggest(d.layout.name, [...this.decls.values()].filter((x) => x.kind === 'Layout').map((x) => x.name)) ? `Did you mean "${suggest(d.layout.name, [...this.decls.values()].filter((x) => x.kind === 'Layout').map((x) => x.name))}"?` : 'Declare it with `layout Main`.', d.layout);
    }
    if (d.title) this.viewExpr(d.title, ctx);
    this.actions(d, d.actions, ctx);
    if (d.onLoad) this.block(d.onLoad, ctx, new Map());
    if (d.view) this.view(d.view, ctx, new Map());
    else this.warn('W106', `Page ${d.name} has no \`view\`, so it will be blank.`, 'Add a `view` block.', d);
    for (const s of d.states) if (!ctx.usedStates.has(s.name))
      this.warn('W105', `State "${s.name}" is never used.`, 'Remove it, or show it in the view.', s);
    this.unused(d, ctx);
  }

  dComponent(d) {
    if (d.uses?.length) this.err('E203', 'Components cannot use dependencies.', 'Pass data in with `takes` (pages own data, components display it).', d);
    for (const p of d.takes) { this.camelName(p.name, 'property', p); this.checkType(p.type); }
    if (d.view) this.view(d.view, this.ctx(d, 'Component'), new Map());
  }

  dLayout(d) {
    if (d.view) this.view(d.view, this.ctx(d, 'Layout'), new Map());
    const slots = JSON.stringify(d.view || [], (k, v) => (k === 'ref' || k === 'decl' ? undefined : v)).split('"kind":"Slot"').length - 1;
    if (slots === 0) this.warn('W107', `Layout ${d.name} has no \`slot\`, so pages that use it will not appear.`, 'Add a `slot` line where the page content should go.', d);
    if (slots > 1) this.warn('W107', `Layout ${d.name} has ${slots} slots, so pages that use it will appear ${slots} times.`, 'Keep exactly one `slot`.', d);
  }

  dTest(d) { this.block(d.body, this.ctx(d, 'Test'), new Map()); }

  dApp(d) {
    for (const [k, v] of Object.entries(d.settings)) {
      this.expr(v, this.ctx(d, 'App'));
      if (k === 'aiKeys' && !(v.kind === 'Str' && ['server', 'user', 'either'].includes(v.parts.map((p) => p.text ?? '').join('')))) {
        this.warn('W108', 'aiKeys must be "server", "user" or "either".', '"server" uses your key from .env, "user" requires each end user\'s own key, "either" prefers the user\'s key.', v.key || d);
      }
      if (!APP_SETTINGS.includes(k)) {
        const s = suggest(k, APP_SETTINGS);
        this.warn('W108', `Unknown app setting "${k}"; it will be ignored.`, s ? `Did you mean "${s}"?` : `Settings: ${APP_SETTINGS.join(', ')}.`, v.key || d);
      }
    }
  }

  ctx(d, kind) {
    return {
      owner: d, kind,
      deps: new Set((d.uses || []).map((u) => u.name)),
      used: new Set(), usedStates: new Set(),
      actions: new Map((d.actions || []).map((a) => [a.name, a])),
      states: new Map((d.states || []).map((s) => [s.name, s])),
      props: new Map((d.takes || []).map((p) => [p.name, p])),
      params: new Set(kind === 'Page' ? pathParams(d.pathText) : []),
    };
  }

  unused(d, ctx) {
    for (const u of d.uses) if (this.decls.has(u.name) && !ctx.used.has(u.name))
      this.warn('W101', `"${u.name}" is listed in \`uses\` but never used.`, 'Remove it to keep dependencies honest.', u, u.name.length);
  }

  cycles() {
    const state = new Map();
    const visit = (name, stack) => {
      const d = this.decls.get(name);
      if (!d || d.kind !== 'Service') return;
      if (state.get(name) === 1) {
        this.err('E202', `Services depend on each other in a circle: ${[...stack, name].join(' → ')}.`,
          'Move the shared logic into a third service that both can use.', d);
        return;
      }
      if (state.get(name) === 2) return;
      state.set(name, 1);
      for (const u of d.uses) visit(u.name, [...stack, name]);
      state.set(name, 2);
    };
    for (const d of this.decls.values()) visit(d.name, []);
  }

  // ---- statements ----
  block(stmts, ctx, scope) {
    const scopes = [scope];
    for (const s of stmts) this.stmt(s, ctx, scopes);
  }

  lookupLocal(name, scopes) { for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return scopes[i].get(name); return null; }

  stmt(s, ctx, scopes) {
    const sub = (body, extra = new Map()) => { const sc = [...scopes, extra]; for (const x of body) this.stmt(x, ctx, sc); };
    const testOnly = () => { if (ctx.kind !== 'Test') this.err('E120', `\`${s.kind === 'ExpectFails' || s.kind === 'Expect' ? 'expect' : s.kind.toLowerCase()}\` can only be used inside a \`test\`.`, 'Move this into a test block in the tests/ folder.', s); };
    switch (s.kind) {
      case 'Let': {
        const top = scopes[scopes.length - 1];
        this.camelName(s.name, 'value', s.nameAt);
        if (top.has(s.name)) this.err('E111', `"${s.name}" was already created in this block.`, `Use \`${s.name} = ...\` to change it.`, s.nameAt, s.name.length);
        this.expr(s.value, ctx, scopes);
        top.set(s.name, { kind: 'local' });
        break;
      }
      case 'Assign': {
        this.expr(s.value, ctx, scopes);
        let root = s.target;
        while (root.kind === 'Member' || root.kind === 'Index') root = root.obj;
        if (s.target.kind === 'Name') {
          const local = this.lookupLocal(s.target.name, scopes);
          if (local) { s.target.ref = local; break; }
          if (ctx.states.has(s.target.name)) { s.target.ref = { kind: 'state' }; ctx.usedStates.add(s.target.name); break; }
          this.err('E110', `"${s.target.name}" doesn't exist yet.`, `Create it first with \`let ${s.target.name} = ...\`${ctx.kind === 'Page' ? ', or declare `state ' + s.target.name + ' = ...` on the page' : ''}.`, s.target, s.target.name.length);
          break;
        }
        this.expr(s.target, ctx, scopes);
        break;
      }
      case 'Return': if (s.value) this.expr(s.value, ctx, scopes); break;
      case 'Require': this.expr(s.cond, ctx, scopes); this.expr(s.message, ctx, scopes); break;
      case 'Fail': this.expr(s.message, ctx, scopes); if (s.status) this.expr(s.status, ctx, scopes); break;
      case 'If': this.expr(s.cond, ctx, scopes); sub(s.then); if (s.else) sub(s.else); break;
      case 'For': this.expr(s.iter, ctx, scopes); sub(s.body, new Map([[s.var, { kind: 'local' }]])); break;
      case 'While': this.expr(s.cond, ctx, scopes); sub(s.body); break;
      case 'Try': sub(s.body); sub(s.handler, new Map([[s.errName, { kind: 'local' }]])); break;
      case 'Log': this.expr(s.value, ctx, scopes); break;
      case 'ExprStmt': this.expr(s.expr, ctx, scopes); break;
      case 'About': break;
      case 'Expect': testOnly(); this.expr(s.expr, ctx, scopes); break;
      case 'ExpectFails': testOnly(); this.expr(s.expr, ctx, scopes); if (s.message) this.expr(s.message, ctx, scopes); break;
      case 'Render': {
        testOnly();
        const p = this.decls.get(s.page);
        if (!p || p.kind !== 'Page') this.err('E105', `"${s.page}" is not a page.`, suggest(s.page, [...this.decls.values()].filter((x) => x.kind === 'Page').map((x) => x.name)) ? `Did you mean "${suggest(s.page, [...this.decls.values()].filter((x) => x.kind === 'Page').map((x) => x.name))}"?` : undefined, s);
        break;
      }
      case 'Click': testOnly(); this.expr(s.label, ctx, scopes); break;
      case 'TypeInto': testOnly(); this.expr(s.value, ctx, scopes); this.expr(s.target, ctx, scopes); break;
      case 'GoTo':
        if (!['Page', 'Test'].includes(ctx.kind)) this.err('E201', '`go to` navigates between pages, so it only works in pages and tests.', 'Return a value instead and let the page decide where to go.', s);
        this.expr(s.path, ctx, scopes); break;
    }
  }

  // ---- expressions ----
  expr(e, ctx, scopes = [new Map()]) {
    if (!e) return;
    switch (e.kind) {
      case 'Num': case 'Bool': case 'Nothing': return;
      case 'Str':
        for (const p of e.parts) {
          if (p.expr) this.expr(p.expr, ctx, scopes);
          else if (SECRET.test(p.text)) this.err('E401', 'This looks like a secret key written directly in the code.',
            'Put it in the .env file and read it with `env.MY_KEY` (backend only). Never commit keys.', e);
        }
        return;
      case 'List': e.items.forEach((x) => this.expr(x, ctx, scopes)); return;
      case 'Obj': e.entries.forEach((x) => this.expr(x.value, ctx, scopes)); return;
      case 'Binary': this.expr(e.left, ctx, scopes); this.expr(e.right, ctx, scopes); return;
      case 'Unary': this.expr(e.expr, ctx, scopes); return;
      case 'IsEmpty': this.expr(e.expr, ctx, scopes); return;
      case 'Index': this.expr(e.obj, ctx, scopes); this.expr(e.index, ctx, scopes); return;
      case 'Lambda': {
        const sc = new Map(e.params.map((p) => [p, { kind: 'local' }]));
        ctx.inLambda = (ctx.inLambda || 0) + 1;
        this.expr(e.body, ctx, [...scopes, sc]);
        ctx.inLambda--;
        return;
      }
      case 'AskAi':
        if (UI.includes(ctx.kind)) this.err('E204', 'AI can only be called from a service, not from the UI.',
          'Move this into a service action and call it through an api. This keeps your AI keys secret and your UI simple.', e);
        this.expr(e.prompt, ctx, scopes);
        if (e.as) this.checkType(e.as);
        if (e.oneOf) this.expr(e.oneOf, ctx, scopes);
        if (e.using) this.expr(e.using, ctx, scopes);
        if (e.system) this.expr(e.system, ctx, scopes);
        return;
      case 'Request':
        if (ctx.kind !== 'Test') this.err('E120', '`request` can only be used inside a `test`.', 'Pages call apis by name, e.g. `TodoApi.list()`.', e);
        this.expr(e.path, ctx, scopes); if (e.body) this.expr(e.body, ctx, scopes); return;
      case 'Name': return this.name(e, ctx, scopes);
      case 'Member': {
        this.expr(e.obj, ctx, scopes);
        if (e.obj.kind === 'Name' && e.obj.ref?.kind === 'builtin' && e.obj.name === 'env') e.env = true;
        return;
      }
      case 'Call': return this.call(e, ctx, scopes);
    }
  }

  name(e, ctx, scopes) {
    const n = e.name;
    const local = this.lookupLocal(n, scopes);
    if (local) { e.ref = local; return; }
    if (ctx.states.has(n)) { e.ref = { kind: 'state' }; ctx.usedStates.add(n); return; }
    if (ctx.props.has(n)) { e.ref = { kind: 'prop' }; return; }
    if (ctx.params.has(n)) { e.ref = { kind: 'param' }; return; }
    if (ctx.actions.has(n)) { e.ref = { kind: 'action', action: ctx.actions.get(n) }; return; }
    const d = this.decls.get(n);
    if (d) {
      if (d.kind === 'Model') { e.ref = { kind: 'model', decl: d }; return; }
      if (ctx.kind === 'Test' && d.kind !== 'Page' && d.kind !== 'Component' && d.kind !== 'Layout') { e.ref = { kind: 'dep', decl: d }; return; }
      if (ctx.deps.has(n)) { e.ref = { kind: 'dep', decl: d }; ctx.used.add(n); if (ctx.inLambda) this.err('E108', `Calls to ${n} can't go inside a quick \`x => ...\` function.`, 'Use a `for` loop instead.', e); return; }
      const allowed = LAYERS[ctx.owner.kind] || [];
      if (allowed.includes(d.kind)) {
        this.err('E106', `${ctx.owner.name} uses ${n} but doesn't declare it.`, `Add \`uses ${n}\` at the top of ${ctx.owner.name}. Declaring dependencies keeps every part testable (Dependency Inversion).`, e, n.length);
      } else this.err('E201', layerMessage(ctx.owner, d), layerHint(ctx.owner, d), e, n.length);
      e.ref = { kind: 'dep', decl: d };
      return;
    }
    const b = BUILTINS[n];
    if (b) {
      if (b.backend && UI.includes(ctx.kind)) this.err('E205', '`env` holds server secrets and cannot be read in the UI.', 'Read it in a service and send only what the page needs through an api.', e);
      if (b.test && ctx.kind !== 'Test') this.err('E120', '`screen` is only available in tests.', undefined, e);
      e.ref = { kind: 'builtin' };
      return;
    }
    const candidates = [...scopes.flatMap((s) => [...s.keys()]), ...ctx.states.keys(), ...ctx.props.keys(), ...ctx.actions.keys(), ...ctx.params, ...this.decls.keys(), ...Object.keys(BUILTINS)];
    const s = suggest(n, candidates);
    this.err('E105', `I don't know what "${n}" is.`, s ? `Did you mean "${s}"?` : `Create it with \`let ${n} = ...\` or check the spelling.`, e, n.length);
    e.ref = { kind: 'unknown' };
  }

  call(e, ctx, scopes) {
    this.callInner(e, ctx, scopes);
    const awaited = e.resolved || (e.callee.kind === 'Name' && (e.callee.ref?.kind === 'prop' || (e.callee.ref?.kind === 'builtin' && e.callee.name === 'sleep')));
    if (ctx.inView && awaited) this.err('E117', 'A view can\'t call an api or an action while it is being drawn.',
      'Load the data into `state` in `when loaded` or in an action, then show the state in the view.', e);
  }

  viewExpr(e, ctx, scopes) { ctx.inView = (ctx.inView || 0) + 1; this.expr(e, ctx, scopes); ctx.inView--; }

  callInner(e, ctx, scopes) {
    e.args.forEach((a) => this.expr(a.value, ctx, scopes));
    const c = e.callee;
    if (c.kind === 'Member' && c.obj.kind === 'Name') {
      this.expr(c.obj, ctx, scopes);
      const ref = c.obj.ref;
      if (ref?.kind === 'dep') {
        const d = ref.decl;
        let params = null, what = null, names = [];
        if (d.kind === 'Service') { const a = d.actions.find((x) => x.name === c.prop); names = d.actions.map((x) => x.name); what = 'action'; if (a) params = a.params; }
        else if (d.kind === 'Store') { names = Object.keys(STORE_METHODS); what = 'store method'; if (STORE_METHODS[c.prop]) params = STORE_METHODS[c.prop].map((n) => ({ name: n })); }
        else if (d.kind === 'Api' || d.kind === 'Client') {
          names = d.routes.map((x) => x.name); what = 'route';
          const r = d.routes.find((x) => x.name === c.prop);
          if (r) params = r.allParams || routeParams(r, d.kind === 'Api' ? d.baseText : '');
        }
        if (what && !params) {
          const s = suggest(c.prop, names);
          this.err('E107', `${d.name} has no ${what} "${c.prop}".`, s ? `Did you mean "${s}"?` : `Available: ${names.join(', ') || 'none yet'}.`, c, c.prop.length);
          return;
        }
        if (params) { e.resolved = this.args(e, params, `${d.name}.${c.prop}`); e.target = d.kind; }
        return;
      }
      return;
    }
    if (c.kind === 'Name') {
      this.expr(c, ctx, scopes);
      const ref = c.ref;
      if (ref?.kind === 'model') {
        const m = ref.decl;
        const fields = [{ name: 'id' }, ...m.fields];
        e.isModel = true;
        let pos = 0;
        for (const a of e.args) {
          if (a.name && !fields.some((f) => f.name === a.name)) {
            const s = suggest(a.name, fields.map((f) => f.name));
            this.err('E109', `${m.name} has no field "${a.name}".`, s ? `Did you mean "${s}"?` : `Fields: ${m.fields.map((f) => f.name).join(', ')}.`, a, a.name.length);
          }
          if (!a.name) { a.field = m.fields[pos]?.name; if (!a.field) this.err('E108', `${m.name} only has ${m.fields.length} fields.`, 'Remove the extra value.', a); pos++; }
        }
        return;
      }
      if (ref?.kind === 'action') { e.resolved = this.args(e, ref.action.params, c.name); e.target = 'Self'; return; }
      return;
    }
    this.expr(c, ctx, scopes);
  }

  args(e, params, label) {
    const order = params.map((p) => p.name);
    const filled = new Array(params.length).fill(null);
    let pos = 0;
    for (const a of e.args) {
      if (a.name) {
        const i = order.indexOf(a.name);
        if (i < 0) {
          const s = suggest(a.name, order);
          this.err('E108', `${label} has no parameter "${a.name}".`, s ? `Did you mean "${s}"?` : `Parameters: ${order.join(', ') || 'none'}.`, a, a.name.length);
          continue;
        }
        filled[i] = a;
      } else {
        if (pos >= params.length) { this.err('E108', `${label} takes ${params.length} value${params.length === 1 ? '' : 's'} but got more.`, `Parameters: ${order.join(', ') || 'none'}.`, a); continue; }
        filled[pos++] = a;
      }
    }
    params.forEach((p, i) => {
      if (!filled[i] && !p.default && !p.type?.optional && p.type?.name !== 'action' && params !== STORE_METHODS)
        this.err('E108', `${label} is missing the value for "${p.name}".`, `Pass it like \`${label}(${p.name}: ...)\`.`, e);
    });
    return { order, filled };
  }

  // ---- view ----
  view(nodes, ctx, scope) {
    const scopes = [scope];
    for (const n of nodes) this.vnode(n, ctx, scopes);
  }

  handler(h, ctx, scopes) {
    const target = h.kind === 'Call' ? h.callee : h;
    this.expr(h, ctx, scopes);
    const ok = target.kind === 'Name' && (target.ref?.kind === 'action' || target.ref?.kind === 'prop' || target.ref?.kind === 'local');
    if (!ok) this.err('E113', 'An event must call an action, like `on click save` or `on click remove(todo.id)`.',
      'Define an `action` on the page and call it here.', h);
  }

  vnode(n, ctx, scopes) {
    switch (n.kind) {
      case 'El': {
        if (n.arg) this.viewExpr(n.arg, ctx, scopes);
        if ((n.tag === 'input' || n.tag === 'checkbox' || n.tag === 'select') && n.arg) {
          let root = n.arg;
          while (root.kind === 'Member') root = root.obj;
          const hasHandler = n.props.some((p) => p.name === 'on');
          if (!hasHandler && (root.kind !== 'Name' || !['state', 'local'].includes(root.ref?.kind) || ctx.kind !== 'Page'))
            this.err('E112', `\`${n.tag}\` must be bound to page state so it can store what the user types.`,
              'Declare `state draft = ""` on the page and write `input draft`.', n.arg);
        }
        for (const p of n.props) {
          if (p.name === 'on') this.handler(p.value, ctx, scopes);
          else this.viewExpr(p.value, ctx, scopes);
        }
        const sc = [...scopes, new Map()];
        for (const c of n.children) this.vnode(c, ctx, sc);
        return;
      }
      case 'On':
        if (n.body) this.block(n.body, ctx, new Map(scopes.flatMap((s) => [...s])));
        else this.handler(n.handler, ctx, scopes);
        return;
      case 'VFor': {
        this.viewExpr(n.iter, ctx, scopes);
        const sc = [...scopes, new Map([[n.var, { kind: 'local' }]])];
        for (const c of n.children) this.vnode(c, ctx, sc);
        return;
      }
      case 'VIf':
        this.viewExpr(n.cond, ctx, scopes);
        for (const c of n.then) this.vnode(c, ctx, scopes);
        if (n.else) for (const c of n.else) this.vnode(c, ctx, scopes);
        return;
      case 'Slot':
        if (ctx.kind !== 'Layout') this.err('E013', '`slot` only makes sense inside a layout (it marks where the page goes).', undefined, n);
        return;
      case 'Comp': {
        const d = this.decls.get(n.name);
        if (!d || d.kind !== 'Component') {
          const s = suggest(n.name, [...this.decls.values()].filter((x) => x.kind === 'Component').map((x) => x.name));
          this.err('E105', `"${n.name}" is not a component.`, s ? `Did you mean "${s}"?` : 'Declare it with `component Name`.', n, n.name.length);
          n.args.forEach((a) => this.expr(a.value, ctx, scopes));
          return;
        }
        n.decl = d;
        for (const a of n.args) {
          const p = d.takes.find((t) => t.name === a.name);
          if (!p) { const s = suggest(a.name, d.takes.map((t) => t.name)); this.err('E114', `${d.name} doesn't take "${a.name}".`, s ? `Did you mean "${s}"?` : `It takes: ${d.takes.map((t) => t.name).join(', ') || 'nothing'}.`, a); }
          if (p?.type?.name === 'action') this.handler(a.value, ctx, scopes); else this.viewExpr(a.value, ctx, scopes);
        }
        for (const p of d.takes) if (!p.default && !p.type?.optional && !n.args.some((a) => a.name === p.name))
          this.err('E114', `${d.name} needs "${p.name}".`, `Add \`${p.name}: ...\`.`, n);
        return;
      }
    }
  }
}

function countStatements(body) {
  let n = 0;
  for (const s of body || []) { n++; for (const k of ['then', 'else', 'body', 'handler']) if (Array.isArray(s[k])) n += countStatements(s[k]); }
  return n;
}

function layerMessage(from, to) {
  const who = `${LAYER_WORD[from.kind]} ${from.kind.toLowerCase()}`;
  return `${an(who)[0].toUpperCase()}${an(who).slice(1)} (${from.name}) can't use the ${LAYER_WORD[to.kind]} layer directly (${to.name} is ${an(to.kind.toLowerCase())}).`;
}
function layerHint(from, to) {
  const rules = {
    Page: 'Pages talk to the backend only through an `api`. Flow: page → api → service → store/client.',
    Api: 'Apis are thin: they call a `service`, which holds the business logic.',
    Service: 'Services may use stores (data), clients (network) and other services.',
    Component: 'Components only display what they are given with `takes`.',
    Layout: 'Layouts only arrange pages.',
  };
  return rules[from.kind] || `Allowed: ${(LAYERS[from.kind] || []).join(', ') || 'nothing'}.`;
}
