// Code generation: checked AST -> two plain JavaScript programs.
//   server program: models, stores, clients, services, apis, tests
//   client program: models, pages, components, layouts, api spec
// Each program is a function body that receives the runtime object `R`,
// so the same output runs in Node, in the browser and in the playground.
import { routeParams, pathParams } from './checker.js';

const RESERVED = new Set(('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await arguments eval undefined s a p d T api params slot C R B models').split(' '));
const id = (n) => (RESERVED.has(n) ? `${n}_` : n);
const S = JSON.stringify;
const METHOD_MAP = { add: 'push', contains: 'includes', where: 'filter', upper: 'toUpperCase', lower: 'toLowerCase', startsWith: 'startsWith', endsWith: 'endsWith' };
const EVENT_MAP = { click: 'onclick', change: 'onchange', input: 'oninput', submit: 'onsubmit', blur: 'onblur', focus: 'onfocus', enter: 'onkeydown' };

export function genType(t) {
  if (!t) return 'null';
  return `{name:${S(t.name)}${t.of ? `,of:${genType(t.of)}` : ''}${t.optional ? ',optional:true' : ''}}`;
}

class Gen {
  constructor(decls) { this.decls = decls; }

  // ---------- expressions ----------
  expr(e, cx) {
    switch (e.kind) {
      case 'Num': return String(e.value);
      case 'Bool': return String(e.value);
      case 'Nothing': return 'null';
      case 'Str': {
        if (e.parts.every((p) => p.text !== undefined)) return S(e.parts.map((p) => p.text).join(''));
        return '`' + e.parts.map((p) => p.text !== undefined
          ? p.text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
          : '${__t(' + this.expr(p.expr, cx) + ')}').join('') + '`';
      }
      case 'List': return `[${e.items.map((x) => this.expr(x, cx)).join(', ')}]`;
      case 'Obj': return `({${e.entries.map((x) => `${S(x.key)}: ${this.expr(x.value, cx)}`).join(', ')}})`;
      case 'Name': return this.name(e, cx);
      case 'Member': {
        if (e.env) return `R.env[${S(e.prop)}]`;
        const o = this.expr(e.obj, cx);
        if (e.prop === 'count') return `__count(${o})`;
        if (e.prop === 'first') return `__first(${o})`;
        if (e.prop === 'last') return `__last(${o})`;
        return `${o}${cx.safe ? '?.' : '.'}${e.prop}`;
      }
      case 'Index': return `${this.expr(e.obj, cx)}${cx.safe ? '?.' : ''}[${this.expr(e.index, cx)}]`;
      case 'Binary': {
        const l = this.expr(e.left, cx), r = this.expr(e.right, cx);
        switch (e.op) {
          case 'is': return `__eq(${l}, ${r})`;
          case 'oneOf': return `__oneOf(${l}, ${r})`;
          case 'has': return `__has(${l}, ${r})`;
          case 'and': return `(${l} && ${r})`;
          case 'or': return `(${l} || ${r})`;
          default: return `(${l} ${e.op} ${r})`;
        }
      }
      case 'Unary': return e.op === 'not' ? `!(${this.expr(e.expr, cx)})` : `(-${this.expr(e.expr, cx)})`;
      case 'IsEmpty': return `__empty(${this.expr(e.expr, cx)})`;
      case 'Lambda': return `((${e.params.map(id).join(', ')}) => ${this.expr(e.body, cx)})`;
      case 'AskAi': {
        const o = [];
        if (e.as) o.push(`as: ${genType(e.as)}`);
        if (e.oneOf) o.push(`oneOf: ${this.expr(e.oneOf, cx)}`);
        if (e.using) o.push(`using: ${this.expr(e.using, cx)}`);
        if (e.system) o.push(`system: ${this.expr(e.system, cx)}`);
        return `(await R.ai.ask(${this.expr(e.prompt, cx)}, {${o.join(', ')}}))`;
      }
      case 'Request': return `(await T.request(${S(e.method)}, ${this.expr(e.path, cx)}, ${e.body ? this.expr(e.body, cx) : 'null'}))`;
      case 'Call': return this.call(e, cx);
    }
    throw new Error(`codegen: unknown expression ${e.kind}`);
  }

  name(e, cx) {
    const r = e.ref || {};
    switch (r.kind) {
      case 'local': return id(e.name);
      case 'state': return `s.${e.name}`;
      case 'prop': return `p.${e.name}`;
      case 'param': return `params.${e.name}`;
      case 'action': return cx.mode === 'service' ? `this.${e.name}` : `a.${e.name}`;
      case 'model': return `models.${e.name}`;
      case 'dep':
        if (cx.mode === 'service') return `this.$d.${e.name}`;
        if (cx.mode === 'api') return `d.${e.name}`;
        if (cx.mode === 'page') return `api.${e.name}`;
        if (cx.mode === 'test') return `T.dep(${S(e.name)})`;
        return e.name;
      case 'builtin': return e.name === 'env' ? 'R.env' : e.name === 'screen' ? 'T.screen()' : `B.${e.name}`;
      default: return id(e.name);
    }
  }

  call(e, cx) {
    if (e.isModel) {
      const fields = e.args.map((a) => `${S(a.name || a.field)}: ${this.expr(a.value, cx)}`);
      return `new models.${e.callee.name}({${fields.join(', ')}})`;
    }
    if (e.resolved) {
      const vals = e.resolved.filled.map((a) => (a ? this.expr(a.value, cx) : 'undefined'));
      while (vals.length && vals[vals.length - 1] === 'undefined') vals.pop();
      const callee = e.callee.kind === 'Member' ? `${this.expr(e.callee.obj, cx)}.${e.callee.prop}` : this.expr(e.callee, cx);
      return `(await ${callee}(${vals.join(', ')}))`;
    }
    const args = e.args.map((a) => this.expr(a.value, cx)).join(', ');
    const c = e.callee;
    if (c.kind === 'Member' && METHOD_MAP[c.prop] && !(c.obj.ref?.kind === 'dep')) {
      return `${this.expr(c.obj, cx)}${cx.safe ? '?.' : '.'}${METHOD_MAP[c.prop]}(${args})`;
    }
    if (c.kind === 'Member' && ['count', 'first', 'last'].includes(c.prop) && !e.args.length) return `__${c.prop}(${this.expr(c.obj, cx)})`;
    if (c.kind === 'Member' && c.prop === 'sortBy') return `__sortBy(${this.expr(c.obj, cx)}, ${args})`;
    if (c.kind === 'Member' && ['take', 'skip', 'reversed'].includes(c.prop) && !(c.obj.ref?.kind === 'dep')) return `__${c.prop}(${this.expr(c.obj, cx)}${args ? ', ' + args : ''})`;
    const callee = this.expr(c, cx);
    const isAsync = c.kind === 'Name' && (c.ref?.kind === 'prop' || (c.ref?.kind === 'builtin' && c.name === 'sleep'));
    return isAsync ? `(await ${callee}(${args}))` : `${callee}(${args})`;
  }

  // ---------- statements ----------
  block(stmts, cx, ind) { return stmts.map((s) => this.stmt(s, cx, ind)).join(''); }

  stmt(s, cx, ind) {
    const pad = '  '.repeat(ind);
    const E = (x) => this.expr(x, cx);
    switch (s.kind) {
      case 'About': return '';
      case 'Let': return `${pad}let ${id(s.name)} = ${E(s.value)};\n`;
      case 'Assign': return `${pad}${this.expr(s.target, { ...cx, safe: false })} = ${E(s.value)};\n`;
      case 'Return': return `${pad}return${s.value ? ' ' + E(s.value) : ''};\n`;
      case 'Require': return `${pad}if (!(${E(s.cond)})) throw new R.ValidationError(${E(s.message)});\n`;
      case 'Fail': return `${pad}throw new R.Fail(${E(s.message)}, ${s.status ? E(s.status) : 400});\n`;
      case 'If': {
        let out = `${pad}if (${E(s.cond)}) {\n${this.block(s.then, cx, ind + 1)}${pad}}`;
        if (s.else) out += ` else {\n${this.block(s.else, cx, ind + 1)}${pad}}`;
        return out + '\n';
      }
      case 'For': return `${pad}for (const ${id(s.var)} of __list(${E(s.iter)})) {\n${this.block(s.body, cx, ind + 1)}${pad}}\n`;
      case 'While': return `${pad}while (${E(s.cond)}) {\n${this.block(s.body, cx, ind + 1)}${pad}}\n`;
      case 'Try': return `${pad}try {\n${this.block(s.body, cx, ind + 1)}${pad}} catch ($e) {\n${pad}  if ($e?.name === 'TestFailure') throw $e;\n${pad}  const ${id(s.errName)} = R.toError($e);\n${this.block(s.handler, cx, ind + 1)}${pad}}\n`;
      case 'Log': return `${pad}R.log(${E(s.value)});\n`;
      case 'ExprStmt': return `${pad}${E(s.expr)};\n`;
      case 'Expect': {
        const at = S(`${s.file}:${s.line}`);
        const x = s.expr;
        if (x.kind === 'Binary' && ['is', '<', '>', '<=', '>=', 'has', 'oneOf'].includes(x.op))
          return `${pad}T.expectOp(${S(x.op)}, ${E(x.left)}, ${E(x.right)}, ${S(s.src)}, ${at});\n`;
        if (x.kind === 'Unary' && x.op === 'not' && x.expr.kind === 'Binary' && x.expr.op === 'is')
          return `${pad}T.expectOp("is not", ${E(x.expr.left)}, ${E(x.expr.right)}, ${S(s.src)}, ${at});\n`;
        return `${pad}T.expect(${E(x)}, ${S(s.src)}, ${at});\n`;
      }
      case 'ExpectFails': return `${pad}await T.expectFails(async () => { ${E(s.expr)}; }, ${s.message ? E(s.message) : 'null'}, ${S(`${s.file}:${s.line}`)});\n`;
      case 'Render': return `${pad}await T.render(${S(s.page)});\n`;
      case 'Click': return `${pad}await T.click(${E(s.label)}, ${S(`${s.file}:${s.line}`)});\n`;
      case 'TypeInto': return `${pad}await T.type(${E(s.value)}, ${E(s.target)}, ${S(`${s.file}:${s.line}`)});\n`;
      case 'GoTo': return cx.mode === 'test' ? `${pad}await T.go(${E(s.path)});\n` : `${pad}$.go(${E(s.path)});\n`;
    }
    throw new Error(`codegen: unknown statement ${s.kind}`);
  }

  // ---------- declarations shared by both sides ----------
  model(d) {
    const fields = d.fields.map((f) => {
      const parts = [`name:${S(f.name)}`, `type:${genType(f.type)}`];
      for (const c of f.constraints) {
        if (c.name === 'required') parts.push('required:true');
        else parts.push(`${c.name}:${this.expr(c.value, { mode: 'model' })}`);
        if (c.message) parts.push(`${c.name}Message:${this.expr(c.message, { mode: 'model' })}`);
      }
      if (f.default) parts.push(`default:() => ${this.expr(f.default, { mode: 'model' })}`);
      return `{${parts.join(', ')}}`;
    });
    return `models.${d.name} = class extends R.Model {};\nmodels.${d.name}.def = {name:${S(d.name)}, models, fields:[\n  ${fields.join(',\n  ')}\n]};\n`;
  }

  params(list, cx) {
    return `[${list.map((p) => `{name:${S(p.name)}, type:${genType(p.type || { name: 'any' })}, from:${S(p.from || 'body')}${p.default ? `, default:() => ${this.expr(p.default, cx)}` : ''}${p.type?.optional || p.default ? ', optional:true' : ''}}`).join(', ')}]`;
  }

  // ---------- server ----------
  server(decls, app) {
    let out = header();
    out += 'const models = {};\nconst stores = {};\nconst clients = {};\nconst services = {};\nconst apis = [];\nconst tests = [];\n\n';
    for (const d of decls.filter((x) => x.kind === 'Model')) out += this.model(d);
    for (const d of decls) {
      if (d.kind === 'Store') out += `stores.${d.name} = {model: ${S(d.holds)}, file: ${d.savedIn ? this.expr(d.savedIn, { mode: 'store' }) : 'null'}};\n`;
      if (d.kind === 'Client') out += this.client(d);
      if (d.kind === 'Service') out += this.service(d);
      if (d.kind === 'Api') out += this.api(d);
      if (d.kind === 'Test') out += this.test(d);
    }
    out += `\nreturn { models, stores, clients, services, apis, tests, app: ${this.app(app)} };\n`;
    return out;
  }

  app(app) {
    if (!app) return '{name:"CluubApp", settings:{}}';
    const cx = { mode: 'app' };
    return `{name:${S(app.name)}, settings:{${Object.entries(app.settings).map(([k, v]) => `${S(k)}: ${this.expr(v, cx)}`).join(', ')}}}`;
  }

  client(d) {
    const cx = { mode: 'client' };
    const routes = d.routes.map((r) => `${S(r.name)}: {method:${S(r.method)}, path:${S(r.pathText)}, params:${this.params(r.allParams || routeParams(r, ''), cx)}}`);
    return `clients.${d.name} = {name:${S(d.name)}, base:${this.expr(d.base, cx)}, headers:() => ({${d.headers.map((h) => `[${this.expr(h.name, cx)}]: ${this.expr(h.value, cx)}`).join(', ')}}), routes:{${routes.join(', ')}}};\n`;
  }

  service(d) {
    const cx = { mode: 'service' };
    let out = `services.${d.name} = class {\n  constructor(d) { this.$d = d; }\n`;
    for (const a of d.actions) {
      out += `  async ${a.name}(${a.params.map((p) => id(p.name) + (p.default ? ` = ${this.expr(p.default, cx)}` : '')).join(', ')}) {\n${this.block(a.body, cx, 2)}  }\n`;
    }
    out += `};\nservices.${d.name}.uses = ${S(d.uses.map((u) => u.name))};\nservices.${d.name}.actions = ${S(Object.fromEntries(d.actions.map((a) => [a.name, a.params.map((p) => p.name)])))};\n`;
    return out;
  }

  api(d) {
    const cx = { mode: 'api' };
    const routes = d.routes.map((r) => {
      const ps = r.allParams || routeParams(r, d.baseText);
      return `  {method:${S(r.method)}, name:${S(r.name)}, path:${S(joinPath(d.baseText, r.pathText))}, params:${this.params(ps, cx)},\n   handler: async (d, {${ps.map((p) => p.name === id(p.name) ? p.name : `${p.name}: ${id(p.name)}`).join(', ')}}) => {\n${this.block(r.body, cx, 3)}   }}`;
    });
    return `apis.push({name:${S(d.name)}, base:${S(d.baseText)}, uses:${S(d.uses.map((u) => u.name))}, routes:[\n${routes.join(',\n')}\n]});\n`;
  }

  test(d) {
    const cx = { mode: 'test' };
    return `tests.push({name:${this.expr(d.name, cx)}, file:${S(d.file)}, line:${d.line}, generated:${d.file.includes('generated')}, run: async (T) => {\n${this.block(d.body, cx, 1)}}});\n`;
  }

  // ---------- client ----------
  clientProgram(decls, app) {
    let out = header();
    out += 'const models = {};\nconst components = {};\nconst layouts = {};\nconst pages = [];\nconst apiSpec = {};\n\n';
    for (const d of decls.filter((x) => x.kind === 'Model')) out += this.model(d);
    for (const d of decls) {
      if (d.kind === 'Api') {
        const routes = d.routes.map((r) => `${S(r.name)}: {method:${S(r.method)}, path:${S(joinPath(d.baseText, r.pathText))}, params:${S((r.allParams || routeParams(r, d.baseText)).map((p) => ({ name: p.name, from: p.from })))}}`);
        out += `apiSpec.${d.name} = {${routes.join(', ')}};\n`;
      }
      if (d.kind === 'Component') out += this.component(d);
      if (d.kind === 'Layout') out += `layouts.${d.name} = (slot, $) => {\n  const C = $.C;\n  return ${this.view(d.view || [], { mode: 'layout', safe: true }, 2)};\n};\n`;
      if (d.kind === 'Page') out += this.page(d);
    }
    out += `\nreturn { models, components, layouts, pages, apiSpec, app: ${this.app(app)} };\n`;
    return out;
  }

  component(d) {
    const cx = { mode: 'component', safe: true };
    const defaults = d.takes.filter((t) => t.default).map((t) => `if (p.${t.name} === undefined) p = {...p, ${t.name}: ${this.expr(t.default, cx)}};`).join(' ');
    return `components.${d.name} = (p, $) => {\n  const C = $.C; ${defaults}\n  return ${this.view(d.view || [], cx, 2)};\n};\n`;
  }

  page(d) {
    const cx = { mode: 'page' };
    const vcx = { mode: 'page', safe: true };
    let out = `pages.push({name:${S(d.name)}, path:${S(d.pathText)}, params:${S(pathParams(d.pathText))}, layout:${d.layout ? S(d.layout.name) : 'null'},\n create($) {\n`;
    out += `  const api = $.api, params = $.params, C = $.C;\n  const s = $.state({});\n${d.states.map((st) => `  s.${st.name} = ${this.expr(st.init, cx)};\n`).join('')}  const a = {};\n`;
    for (const ac of d.actions) out += `  a.${ac.name} = async (${ac.params.map((p) => id(p.name) + (p.default ? ` = ${this.expr(p.default, cx)}` : '')).join(', ')}) => {\n${this.block(ac.body, cx, 2)}  };\n`;
    out += `  return { s, a,\n    title: () => ${d.title ? this.expr(d.title, vcx) : S(d.name)},\n    load: async () => {\n${this.block(d.onLoad || [], cx, 3)}    },\n    view: () => ${this.view(d.view || [], vcx, 3)} };\n }});\n`;
    return out;
  }

  // ---------- views ----------
  view(nodes, cx, ind) {
    const pad = '  '.repeat(ind);
    const items = nodes.filter((n) => n.kind !== 'On').map((n) => this.vnode(n, cx, ind + 1));
    return items.length ? `[\n${items.map((i) => pad + '  ' + i).join(',\n')}\n${pad}]` : '[]';
  }

  handler(h, cx) {
    if (h.kind === 'Name') return `$.on(async () => { await ${this.name(h, cx)}(); })`;
    return `$.on(async () => { ${this.expr(h, { ...cx, safe: false })}; })`;
  }

  vnode(n, cx, ind) {
    switch (n.kind) {
      case 'Slot': return 'slot';
      case 'VFor': return `__list(${this.expr(n.iter, cx)}).map((${id(n.var)}) => ${this.view(n.children, cx, ind)})`;
      case 'VIf': return `((${this.expr(n.cond, cx)}) ? ${this.view(n.then, cx, ind)} : ${n.else ? this.view(n.else, cx, ind) : '[]'})`;
      case 'Comp': {
        const args = n.args.map((a) => {
          const p = n.decl?.takes.find((t) => t.name === a.name);
          if (p?.type?.name === 'action') {
            if (a.value.kind === 'Name') return `${S(a.name)}: (...x) => ${this.name(a.value, cx)}(...x)`;
            return `${S(a.name)}: async () => { ${this.expr(a.value, { ...cx, safe: false })}; }`;
          }
          return `${S(a.name)}: ${this.expr(a.value, cx)}`;
        });
        return `C.${n.name}({${args.join(', ')}}, $)`;
      }
      case 'El': return this.element(n, cx, ind);
    }
    throw new Error(`codegen: unknown view node ${n.kind}`);
  }

  element(n, cx, ind) {
    if (n.tag === 'aikey') return '$.aiKeyForm()';
    const P = {};
    const prop = (name) => n.props.find((p) => p.name === name);
    const classes = [];
    const style = prop('style'); if (style) classes.push(this.expr(style.value, cx));
    const cls = prop('class'); if (cls) classes.push(this.expr(cls.value, cx));
    const events = n.props.filter((p) => p.name === 'on').map((p) => [p.event, this.handler(p.value, cx)]);
    for (const c of n.children.filter((c) => c.kind === 'On')) {
      events.push([c.event, c.body ? `$.on(async () => {\n${this.block(c.body, { ...cx, safe: false }, ind + 2)}${'  '.repeat(ind + 1)}})` : this.handler(c.handler, cx)]);
    }
    for (const k of ['placeholder', 'alt', 'type']) { const p = prop(k); if (p) P[k] = this.expr(p.value, cx); }
    const lbl = prop('label');
    if (lbl) P['"aria-label"'] = this.expr(lbl.value, cx);
    else if (['input', 'select'].includes(n.tag) && P.placeholder) P['"aria-label"'] = P.placeholder;
    if (n.tag === 'spinner') { P.role = '"status"'; P['"aria-label"'] = P['"aria-label"'] || '"Loading"'; }
    const dis = prop('disabled'); if (dis) P.disabled = `!!(${this.expr(dis.value, cx)})`;
    const arg = n.arg ? this.expr(n.arg, cx) : null;
    const kids = () => this.view(n.children, cx, ind);
    const withKids = (first) => {
      const k = kids();
      return first ? (k === '[]' ? `[${first}]` : `[${first}, ...${k}]`) : k;
    };
    let tag = n.tag;
    const simple = { heading: 'h1', subheading: 'h2', text: 'p', label: 'label', item: 'li', badge: 'span', row: 'div', column: 'div', card: 'div', box: 'div', grid: 'div', list: 'ul', divider: 'hr', spinner: 'div' };
    const autoClass = { badge: 'badge', row: 'row', column: 'col', card: 'card', grid: 'grid', spinner: 'spinner' };
    if (autoClass[tag]) classes.unshift(S(autoClass[tag]));
    let children = arg ? withKids(`__t(${arg})`) : kids();

    for (const [ev, code] of events) {
      if (ev === 'enter') P.onkeydown = `$.key("Enter", ${code})`;
      else if (ev === 'submit') P.onsubmit = `$.submit(${code})`;
      else P[EVENT_MAP[ev] || 'on' + ev] = code;
    }

    if (tag === 'button') { P.type = P.type || '"button"'; }
    if (tag === 'input' || tag === 'checkbox' || tag === 'select') {
      let root = n.arg; while (root && (root.kind === 'Member' || root.kind === 'Index')) root = root.obj;
      const bindable = root?.kind === 'Name' && (root.ref?.kind === 'state' || (root.ref?.kind === 'local' && cx.mode === 'page'));
      const target = n.arg && bindable ? this.expr(n.arg, { ...cx, safe: false }) : null;
      children = '[]';
      if (tag === 'checkbox') {
        P.type = '"checkbox"';
        P.checked = `!!(${arg})`;
        const user = P.onchange;
        P.onchange = target ? `$.on(async (e) => { ${target} = e.target.checked; $.touch();${user ? ` await (${user})(e);` : ''} })` : user;
        tag = 'input';
      } else if (tag === 'select') {
        const opts = prop('options');
        P.value = `__t(${arg})`;
        const user = P.onchange;
        P.onchange = `$.on(async (e) => { ${target ? `${target} = e.target.value;` : ''}${user ? ` await (${user})(e);` : ''} })`;
        children = `__list(${opts ? this.expr(opts.value, cx) : '[]'}).map((o) => h("option", {value: __t(o)}, [__t(o)]))`;
      } else {
        const isNum = P.type === '"number"';
        P.value = `__t(${arg})`;
        const user = P.oninput;
        if (target) P.oninput = `(e) => { ${target} = ${isNum ? 'Number(e.target.value)' : 'e.target.value'}; $.touch();${user ? ` (${user})(e);` : ''} }`;
        if (prop('multiline')) tag = 'textarea';
      }
    } else if (tag === 'link') {
      const to = prop('to');
      P.href = to ? this.expr(to.value, cx) : '"#"';
      P.onclick = `$.link(${P.href})`;
      tag = 'a';
    } else if (tag === 'image') {
      P.src = arg; children = '[]'; tag = 'img';
    } else if (tag === 'form') {
      if (!P.onsubmit) P.onsubmit = '$.submit(null)';
    } else tag = simple[tag] || tag;

    if (classes.length) P.class = classes.length === 1 ? classes[0] : `[${classes.join(', ')}].filter(Boolean).join(" ")`;
    const props = Object.entries(P).map(([k, v]) => `${k}: ${v}`).join(', ');
    return `h(${S(tag)}, {${props}}, ${children})`;
  }
}

function joinPath(base, path) {
  const j = (base.replace(/\/$/, '') + '/' + path.replace(/^\//, '')).replace(/\/$/, '');
  return j || '/';
}

function header() {
  return '"use strict";\nconst { h, B, __t, __eq, __has, __oneOf, __empty, __count, __first, __last, __list, __sortBy, __take, __skip, __reversed } = R;\n';
}

export function generate(decls, app) {
  const g = new Gen(decls);
  return { server: g.server(decls, app), client: g.clientProgram(decls, app) };
}
