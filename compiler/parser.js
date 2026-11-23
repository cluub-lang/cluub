// Parser: tokens -> AST. Hand-written recursive descent for speed and for
// precise, friendly error messages.
import { lex } from './lexer.js';
import { CluubError, suggest } from './diagnostics.js';

export const DECL_KEYWORDS = ['app', 'model', 'store', 'client', 'service', 'api', 'page', 'component', 'layout', 'test'];
export const CONTENT_TAGS = ['heading', 'subheading', 'text', 'button', 'input', 'checkbox', 'link', 'image', 'label', 'badge', 'item', 'select'];
export const CONTAINER_TAGS = ['row', 'column', 'card', 'box', 'header', 'footer', 'nav', 'section', 'grid', 'list', 'form'];
export const VOID_TAGS = ['divider', 'spinner', 'aikey'];
export const ALL_TAGS = [...CONTENT_TAGS, ...CONTAINER_TAGS, ...VOID_TAGS];
export const PROP_KEYS = ['on', 'to', 'placeholder', 'type', 'disabled', 'class', 'alt', 'style', 'multiline', 'options', 'label'];
export const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export function parse(src, file = 'main.clb') {
  return new Parser(lex(src, file), file).program();
}

// Skips the rest of the current line and any block nested under it.
function skipLine(p) {
  while (!p.is('newline') && !p.is('eof') && !p.is('dedent')) p.next();
  if (p.is('newline')) p.next();
  if (p.is('indent')) {
    let depth = 0;
    do {
      if (p.is('indent')) depth++;
      else if (p.is('dedent')) depth--;
      p.next();
    } while (depth > 0 && !p.is('eof'));
  }
}

class Parser {
  constructor(tokens, file) { this.t = tokens; this.p = 0; this.file = file; this.errors = []; this.failed = []; }

  // ---- token helpers ----
  peek(k = 0) { return this.t[Math.min(this.p + k, this.t.length - 1)]; }
  next() { return this.t[this.p++]; }
  isName(v, k = 0) { const t = this.peek(k); return t.type === 'name' && (v === undefined || t.value === v); }
  isOp(v, k = 0) { const t = this.peek(k); return t.type === 'op' && t.value === v; }
  is(type, k = 0) { return this.peek(k).type === type; }
  describe(t) {
    if (t.type === 'newline') return 'the end of the line';
    if (t.type === 'eof') return 'the end of the file';
    if (t.type === 'indent') return 'an indented block';
    if (t.type === 'dedent') return 'the end of the block';
    if (t.type === 'string') { const v = t.value.map((x) => x.text ?? '{…}').join(''); return `the text "${v.length > 20 ? v.slice(0, 20) + '…' : v}"`; }
    return `\`${t.value}\``;
  }
  fail(message, hint, t = this.peek(), code = 'E010') {
    throw new CluubError({ code, message, hint, file: this.file, line: t.line, col: t.col, length: t.len || 1 });
  }
  name(what = 'a name') {
    const t = this.peek();
    if (t.type !== 'name') this.fail(`Expected ${what} but found ${this.describe(t)}.`);
    return this.next().value;
  }
  word(v, hint) {
    if (!this.isName(v)) this.fail(`Expected \`${v}\` but found ${this.describe(this.peek())}.`, hint);
    return this.next();
  }
  op(v, hint) {
    if (!this.isOp(v)) this.fail(`Expected \`${v}\` but found ${this.describe(this.peek())}.`, hint);
    return this.next();
  }
  eat(v) { if (this.isOp(v) || this.isName(v)) { return this.next(); } return null; }
  skipNewlines() { while (this.is('newline')) this.next(); }
  endLine() {
    if (this.is('newline')) { this.next(); return; }
    if (this.is('dedent') || this.is('eof')) return;
    this.fail(`Unexpected ${this.describe(this.peek())} at the end of this line.`,
      'Each statement goes on its own line. Remove the extra code or move it to a new line.');
  }
  // Paths keep {param} literally: "/todos/{id}"
  rawPath(e, t) {
    const ok = e.kind === 'Str' && e.parts.every((p) => p.text !== undefined || p.expr.kind === 'Name');
    if (!ok) this.fail('A path must be plain text like "/todos/{id}".', 'Use {name} only for path parameters.', t);
    return e.parts.map((p) => (p.text !== undefined ? p.text : `{${p.expr.name}}`)).join('');
  }
  node(kind, t, props) { return { kind, line: t.line, col: t.col, file: this.file, ...props }; }

  // Parses an indented block, calling `line` for each entry.
  block(line, what = 'an indented block') {
    if (!this.is('newline')) this.fail(`Expected the end of the line before ${what}.`);
    this.next();
    if (!this.is('indent')) return [];
    this.next();
    const items = [];
    while (!this.is('dedent') && !this.is('eof')) {
      const item = line();
      if (item) items.push(item);
      this.skipNewlines();
    }
    if (this.is('dedent')) this.next();
    return items;
  }
  hasBlock() { return this.is('newline') && this.is('indent', 1); }

  // ---- program & declarations ----
  program() {
    const decls = [];
    this.skipNewlines();
    while (!this.is('eof')) {
      const start = this.p;
      try { decls.push(this.decl()); }
      catch (e) {
        if (!(e instanceof CluubError)) throw e;
        this.errors.push(e.diag);
        const nameTok = this.t[start + 1];
        if (nameTok?.type === 'name') this.failed.push(nameTok.value);
        // Recover: jump to the next top-level declaration and keep checking.
        this.p = Math.max(this.p, start + 1);
        while (!this.is('eof') && !(this.peek().col === 1 && this.is('name') && DECL_KEYWORDS.includes(this.peek().value) && ['newline', 'dedent'].includes(this.t[this.p - 1]?.type))) this.next();
      }
      this.skipNewlines();
    }
    return { kind: 'Program', file: this.file, decls, errors: this.errors, failed: this.failed };
  }

  decl() {
    const t = this.peek();
    if (t.type === 'indent') this.fail('This line is indented but is not inside a declaration.', 'Remove the leading spaces.', t, 'E003');
    if (t.type !== 'name' || !DECL_KEYWORDS.includes(t.value)) {
      const s = t.type === 'name' ? suggest(t.value, DECL_KEYWORDS) : null;
      this.fail(`Expected a declaration (${DECL_KEYWORDS.join(', ')}) but found ${this.describe(t)}.`,
        s ? `Did you mean \`${s}\`?` : 'Every file is made of declarations such as `model Todo` or `page Home at "/"`.', t, 'E011');
    }
    this.next();
    return this[`decl_${t.value}`](t);
  }

  members(kind, handlers) {
    return this.block(() => {
      const t = this.peek();
      if (t.type === 'name' && handlers[t.value]) return handlers[t.value](this.next());
      if (handlers.$default) return handlers.$default(t);
      const keys = Object.keys(handlers).filter((k) => k[0] !== '$');
      const s = t.type === 'name' ? suggest(t.value, keys) : null;
      this.fail(`\`${t.value ?? this.describe(t)}\` is not allowed inside ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}.`,
        s ? `Did you mean \`${s}\`?` : `${/^[aeiou]/.test(kind) ? 'An' : 'A'} ${kind} can contain: ${keys.join(', ')}.`, t, 'E012');
    }, `the body of the ${kind}`);
  }

  aboutLine() { const v = this.expr(); this.endLine(); return v; }
  usesLine(t) {
    const list = [];
    do { const n = this.peek(); list.push({ name: this.name('a dependency name'), line: n.line, col: n.col }); } while (this.eat(','));
    this.endLine();
    return list;
  }

  decl_app(t) {
    const d = this.node('App', t, { name: this.name('the app name'), settings: {} });
    if (this.hasBlock()) this.block(() => {
      const k = this.peek();
      const key = this.name('a setting');
      d.settings[key] = this.expr();
      d.settings[key].key = k;
      this.endLine();
    }); else this.endLine();
    return d;
  }

  decl_model(t) {
    const d = this.node('Model', t, { name: this.name('the model name'), fields: [], about: null });
    this.members('model', {
      about: () => { d.about = this.aboutLine(); },
      $default: (ft) => {
        const f = this.node('Field', ft, { name: this.name('a field name'), constraints: [], default: null });
        this.op(':', 'Fields look like `title: text`.');
        f.type = this.type();
        if (this.eat('=')) f.default = this.expr();
        while (this.eat(',')) {
          const ct = this.peek();
          const c = this.node('Constraint', ct, { name: this.name('a rule such as required, min, max or one of') });
          if (c.name === 'min' || c.name === 'max') c.value = this.expr();
          else if (c.name === 'one') { this.word('of'); c.name = 'oneOf'; c.value = this.expr(); }
          else if (c.name !== 'required') this.fail(`Unknown field rule \`${c.name}\`.`, 'Rules are: required, min N, max N, one of [...].', ct, 'E012');
          if (this.is('string')) c.message = this.primary();
          f.constraints.push(c);
        }
        this.endLine();
        d.fields.push(f);
      },
    });
    return d;
  }

  type() {
    const t = this.peek();
    const ty = { kind: 'Type', name: this.name('a type such as text, number or bool'), line: t.line, col: t.col };
    if (ty.name === 'list') { this.word('of', 'Lists are written `list of Todo`.'); ty.of = this.type(); }
    if (this.eat('?')) ty.optional = true;
    return ty;
  }

  decl_store(t) {
    const d = this.node('Store', t, { name: this.name('the store name') });
    this.word('holds', 'Stores look like `store Todos holds Todo`.');
    const h = this.peek();
    d.holds = this.name('a model name'); d.holdsAt = h;
    if (this.eat('saved')) { this.word('in'); d.savedIn = this.expr(); }
    if (this.hasBlock()) this.members('store', { about: () => { d.about = this.aboutLine(); } });
    else this.endLine();
    return d;
  }

  routeHead(t, method) {
    const r = this.node('Route', t, { method: method.toUpperCase(), params: [], returns: null });
    r.name = this.name('a route name');
    this.word('at', `Routes look like \`${method} ${r.name} at "/path"\`.`);
    r.path = this.expr();
    r.pathText = this.rawPath(r.path, t);
    if (this.eat('with')) r.params = this.params(false);
    if (this.eat('->')) r.returns = this.type();
    return r;
  }

  decl_client(t) {
    const d = this.node('Client', t, { name: this.name('the client name'), routes: [], headers: [] });
    this.word('at', 'Clients look like `client Weather at "https://api.example.com"`.');
    d.base = this.expr();
    const handlers = { about: () => { d.about = this.aboutLine(); },
      header: () => { const n = this.expr(); const v = this.expr(); d.headers.push({ name: n, value: v }); this.endLine(); } };
    for (const m of METHODS) handlers[m] = (mt) => { d.routes.push(this.routeHead(mt, m)); this.endLine(); };
    this.members('client', handlers);
    return d;
  }

  decl_service(t) {
    const d = this.node('Service', t, { name: this.name('the service name'), uses: [], actions: [] });
    this.members('service', {
      about: () => { d.about = this.aboutLine(); },
      uses: (u) => { d.uses.push(...this.usesLine(u)); },
      action: (a) => { d.actions.push(this.action(a)); },
    });
    return d;
  }

  params(parens = true) {
    const list = [];
    if (parens) { this.op('('); if (this.eat(')')) return list; }
    do {
      const pt = this.peek();
      const p = this.node('Param', pt, { name: this.name('a parameter name'), type: null, default: null });
      if (this.eat(':')) p.type = this.type();
      if (this.eat('=')) p.default = this.expr();
      list.push(p);
    } while (this.eat(','));
    if (parens) this.op(')', 'Close the parameter list with `)`.');
    return list;
  }

  action(t) {
    const a = this.node('Action', t, { name: this.name('the action name') });
    a.params = this.isOp('(') ? this.params() : [];
    a.returns = this.eat('->') ? this.type() : null;
    a.body = this.statements();
    if (a.body[0]?.kind === 'About') a.about = a.body.shift().value;
    return a;
  }

  decl_api(t) {
    const d = this.node('Api', t, { name: this.name('the api name'), uses: [], routes: [] });
    this.word('at', 'APIs look like `api TodoApi at "/api/todos"`.');
    d.base = this.expr();
    d.baseText = this.rawPath(d.base, t);
    const handlers = { about: () => { d.about = this.aboutLine(); }, uses: (u) => { d.uses.push(...this.usesLine(u)); } };
    for (const m of METHODS) handlers[m] = (mt) => { const r = this.routeHead(mt, m); r.body = this.statements(); d.routes.push(r); };
    this.members('api', handlers);
    return d;
  }

  decl_page(t) {
    const d = this.node('Page', t, { name: this.name('the page name'), uses: [], states: [], actions: [], onLoad: null, view: null, layout: null, title: null });
    this.word('at', 'Pages look like `page Home at "/"`.');
    d.path = this.expr();
    d.pathText = this.rawPath(d.path, t);
    this.members('page', {
      about: () => { d.about = this.aboutLine(); },
      uses: (u) => { d.uses.push(...this.usesLine(u)); },
      layout: () => { const lt = this.peek(); d.layout = { name: this.name('a layout name'), line: lt.line, col: lt.col }; this.endLine(); },
      title: () => { d.title = this.expr(); this.endLine(); },
      state: (st) => {
        const s = this.node('State', this.peek(), { name: this.name('a state name'), type: null });
        if (this.eat(':')) s.type = this.type();
        this.op('=', 'State needs a starting value, e.g. `state count = 0`.');
        s.init = this.expr();
        this.endLine();
        d.states.push(s);
      },
      when: () => { this.word('loaded', 'Use `when loaded` to run code when the page opens.'); d.onLoad = this.statements(); },
      action: (a) => { d.actions.push(this.action(a)); },
      view: () => { d.view = this.view(); },
    });
    return d;
  }

  decl_component(t) {
    const d = this.node('Component', t, { name: this.name('the component name'), takes: [], view: null });
    this.members('component', {
      about: () => { d.about = this.aboutLine(); },
      takes: () => { d.takes.push(...this.params(false)); this.endLine(); },
      uses: (u) => { (d.uses ||= []).push(...this.usesLine(u)); }, // reported as E203 by the checker
      view: () => { d.view = this.view(); },
    });
    return d;
  }

  decl_layout(t) {
    const d = this.node('Layout', t, { name: this.name('the layout name'), view: null });
    this.members('layout', { about: () => { d.about = this.aboutLine(); }, view: () => { d.view = this.view(); } });
    return d;
  }

  decl_test(t) {
    const d = this.node('Test', t, {});
    if (!this.is('string')) this.fail('Tests need a name in quotes, e.g. `test "adding a todo"`.');
    d.name = this.primary();
    d.title = d.name.parts.map((p) => p.text ?? '').join('');
    d.body = this.statements();
    return d;
  }

  // ---- statements ----
  statements() { return this.block(() => this.statement(), 'the statements'); }

  statement() {
    const t = this.peek();
    const kw = t.type === 'name' && !this.isOp('=', 1) && !this.isOp('.', 1) ? t.value : null;
    switch (kw) {
      case 'about': this.next(); return this.node('About', t, { value: this.aboutLine() });
      case 'let': {
        this.next();
        const nt = this.peek();
        const s = this.node('Let', t, { name: this.name('a name for the new value'), nameAt: nt });
        this.op('=', 'Write `let name = value`.');
        s.value = this.expr(); this.endLine(); return s;
      }
      case 'return': {
        this.next();
        const s = this.node('Return', t, { value: this.is('newline') || this.is('dedent') ? null : this.expr() });
        this.endLine(); return s;
      }
      case 'require': {
        this.next();
        const s = this.node('Require', t, { cond: this.expr() });
        this.op(',', 'Write `require condition, "message shown when it is false"`.');
        s.message = this.expr(); this.endLine(); return s;
      }
      case 'fail': {
        this.next();
        const s = this.node('Fail', t, { message: this.expr(), status: null });
        if (this.eat('status')) s.status = this.expr();
        this.endLine(); return s;
      }
      case 'if': return this.ifStmt();
      case 'for': {
        this.next();
        const s = this.node('For', t, { var: this.name('a loop variable') });
        this.word('in', 'Loops look like `for todo in todos`.');
        s.iter = this.expr(); s.body = this.statements(); return s;
      }
      case 'while': { this.next(); const s = this.node('While', t, { cond: this.expr() }); s.body = this.statements(); return s; }
      case 'try': {
        this.next();
        const s = this.node('Try', t, { body: this.statements(), errName: 'error', handler: [] });
        if (this.isName('catch')) { this.next(); if (this.is('name')) s.errName = this.next().value; s.handler = this.statements(); }
        else this.fail('A `try` block needs a `catch` block after it.', 'Add `catch error` and say what to do when something goes wrong.');
        return s;
      }
      case 'log': { this.next(); const s = this.node('Log', t, { value: this.expr() }); this.endLine(); return s; }
      case 'expect': {
        this.next();
        const startTok = this.p;
        const e = this.expr();
        const src = this.t.slice(startTok, this.p).map((x) => x.type === 'string' ? JSON.stringify(x.value.map((q) => q.text ?? `{${q.expr}}`).join('')) : x.value).join(' ');
        if (this.eat('fails')) {
          const s = this.node('ExpectFails', t, { expr: e, message: null });
          if (this.eat('with')) s.message = this.expr();
          this.endLine(); return s;
        }
        this.endLine(); return this.node('Expect', t, { expr: e, src });
      }
      case 'render': { this.next(); const s = this.node('Render', t, { page: this.name('a page name') }); this.endLine(); return s; }
      case 'click': { this.next(); const s = this.node('Click', t, { label: this.expr() }); this.endLine(); return s; }
      case 'type': {
        this.next();
        const s = this.node('TypeInto', t, { value: this.expr() });
        this.word('into', 'Write `type "Milk" into "Placeholder of the field"`.');
        s.target = this.expr(); this.endLine(); return s;
      }
      case 'go': { this.next(); this.word('to'); const s = this.node('GoTo', t, { path: this.expr() }); this.endLine(); return s; }
    }
    const e = this.expr();
    if (this.isOp('=')) {
      const eq = this.next();
      if (!['Name', 'Member', 'Index'].includes(e.kind)) this.fail('You can only assign to a name, a field or a list item.', undefined, eq);
      const s = this.node('Assign', t, { target: e, value: this.expr() });
      this.endLine(); return s;
    }
    this.endLine();
    return this.node('ExprStmt', t, { expr: e });
  }

  ifStmt() {
    const t = this.next();
    const s = this.node('If', t, { cond: this.expr(), else: null });
    s.then = this.statements();
    if (this.isName('else')) {
      this.next();
      if (this.isName('if')) s.else = [this.ifStmt()];
      else s.else = this.statements();
    }
    return s;
  }

  // ---- view ----
  view() { return this.block(() => this.viewLine(), 'the view'); }

  viewLine() {
    const t = this.peek();
    if (t.type !== 'name') this.fail(`Expected a view element but found ${this.describe(t)}.`, 'View lines start with an element such as `heading`, `text`, `button` or `row`.', t, 'E013');
    if (t.value === 'for') {
      this.next();
      const n = this.node('VFor', t, { var: this.name('a loop variable') });
      this.word('in'); n.iter = this.expr(); n.children = this.view(); return n;
    }
    if (t.value === 'if') return this.viewIf();
    if (t.value === 'slot') { this.next(); this.endLine(); return this.node('Slot', t, {}); }
    if (t.value === 'on') {
      this.next();
      const n = this.node('On', t, { event: this.name('an event such as click') });
      if (this.hasBlock()) n.body = this.statements();
      else { n.handler = this.expr(); this.endLine(); }
      return n;
    }
    if (/^[A-Z]/.test(t.value)) {
      this.next();
      const n = this.node('Comp', t, { name: t.value, args: [] });
      if (!this.is('newline')) {
        do {
          const at = this.peek();
          const name = this.name('a property name');
          this.op(':', `Pass properties as \`${name}: value\`.`);
          n.args.push({ name, value: this.expr(), line: at.line, col: at.col });
        } while (this.eat(','));
      }
      this.endLine();
      return n;
    }
    if (!ALL_TAGS.includes(t.value)) {
      const s = suggest(t.value, ALL_TAGS);
      this.errors.push({ severity: 'error', code: 'E013', message: `\`${t.value}\` is not a view element.`, hint: s ? `Did you mean \`${s}\`?` : `Elements: ${ALL_TAGS.join(', ')}. Components start with a capital letter.`, file: this.file, line: t.line, col: t.col, length: t.len });
      skipLine(this); // keep checking the rest of the view
      return null;
    }
    this.next();
    const el = this.node('El', t, { tag: t.value, arg: null, props: [], children: [] });
    const propWordIsValue = this.is('name') && PROP_KEYS.includes(this.peek().value) && this.peek().value !== 'multiline' && (this.isOp(',', 1) || this.is('newline', 1) || this.is('eof', 1) || this.is('indent', 1));
    if (CONTENT_TAGS.includes(t.value) && !this.is('newline') && !this.isOp(',') && (propWordIsValue || !(this.is('name') && PROP_KEYS.includes(this.peek().value) && !this.isOp('.', 1)))) {
      el.arg = this.expr();
    }
    for (;;) {
      const comma = this.eat(',');
      if (this.is('name') && PROP_KEYS.includes(this.peek().value)) el.props.push(this.prop());
      else if (comma) this.fail(`Expected a property (${PROP_KEYS.join(', ')}) after the comma.`);
      else break;
    }
    if (this.hasBlock()) el.children = this.view();
    else this.endLine();
    return el;
  }

  prop() {
    const t = this.next();
    const p = { name: t.value, line: t.line, col: t.col };
    if (t.value === 'on') { p.event = this.name('an event such as click, change or enter'); p.value = this.expr(); }
    else if (t.value === 'multiline') p.value = { kind: 'Bool', value: true };
    else if (t.value === 'style' && this.is('name')) { const w = this.next(); p.value = { kind: 'Str', parts: [{ text: w.value }], line: w.line, col: w.col }; }
    else p.value = this.expr();
    return p;
  }

  viewIf() {
    const t = this.next();
    const n = this.node('VIf', t, { cond: this.expr(), else: null });
    n.then = this.view();
    if (this.isName('else')) {
      this.next();
      n.else = this.isName('if') ? [this.viewIf()] : this.view();
    }
    return n;
  }

  // ---- expressions ----
  expr() {
    // Lambdas: x => x.done   or   (a, b) => a + b
    if (this.is('name') && this.isOp('=>', 1)) {
      const t = this.next(); this.next();
      return this.node('Lambda', t, { params: [t.value], body: this.expr() });
    }
    if (this.isOp('(')) {
      let k = 1; const names = [];
      while (this.is('name', k) && (this.isOp(',', k + 1) || this.isOp(')', k + 1))) { names.push(this.peek(k).value); k += this.isOp(',', k + 1) ? 2 : 1; }
      if (this.isOp(')', k) && this.isOp('=>', k + 1)) {
        const t = this.peek(); this.p += k + 2;
        return this.node('Lambda', t, { params: names, body: this.expr() });
      }
    }
    return this.or();
  }
  or() { let l = this.and(); while (this.isName('or')) { const t = this.next(); l = this.node('Binary', t, { op: 'or', left: l, right: this.and() }); } return l; }
  and() { let l = this.not(); while (this.isName('and')) { const t = this.next(); l = this.node('Binary', t, { op: 'and', left: l, right: this.not() }); } return l; }
  not() {
    if (this.isName('not')) { const t = this.next(); return this.node('Unary', t, { op: 'not', expr: this.not() }); }
    return this.compare();
  }
  compare() {
    let l = this.add();
    for (;;) {
      const t = this.peek();
      if (t.type === 'op' && ['<', '>', '<=', '>='].includes(t.value)) { this.next(); l = this.node('Binary', t, { op: t.value, left: l, right: this.add() }); continue; }
      if (this.isName('equals')) { this.next(); l = this.node('Binary', t, { op: 'is', left: l, right: this.add() }); continue; }
      if (this.isName('has')) { this.next(); l = this.node('Binary', t, { op: 'has', left: l, right: this.add() }); continue; }
      if (this.isName('is')) {
        this.next();
        const neg = !!this.eat('not');
        let e;
        if (this.eat('empty')) e = this.node('IsEmpty', t, { expr: l });
        else if (this.isName('greater') || this.isName('less') || this.isName('more') || this.isName('fewer')) {
          const w = this.next().value; this.word('than');
          e = this.node('Binary', t, { op: w === 'greater' || w === 'more' ? '>' : '<', left: l, right: this.add() });
        } else if (this.isName('at') && (this.isName('least', 1) || this.isName('most', 1))) {
          this.next(); const w = this.next().value;
          e = this.node('Binary', t, { op: w === 'least' ? '>=' : '<=', left: l, right: this.add() });
        } else if (this.isName('one') && this.isName('of', 1)) {
          this.next(); this.next();
          e = this.node('Binary', t, { op: 'oneOf', left: l, right: this.add() });
        } else e = this.node('Binary', t, { op: 'is', left: l, right: this.add() });
        l = neg ? this.node('Unary', t, { op: 'not', expr: e }) : e;
        continue;
      }
      return l;
    }
  }
  add() {
    let l = this.mul();
    for (;;) {
      const t = this.peek();
      if (this.isOp('+') || this.isName('plus')) { this.next(); l = this.node('Binary', t, { op: '+', left: l, right: this.mul() }); }
      else if (this.isOp('-') || this.isName('minus')) { this.next(); l = this.node('Binary', t, { op: '-', left: l, right: this.mul() }); }
      else return l;
    }
  }
  mul() {
    let l = this.unary();
    for (;;) {
      const t = this.peek();
      if (this.isOp('*') || this.isName('times')) { this.next(); l = this.node('Binary', t, { op: '*', left: l, right: this.unary() }); }
      else if (this.isOp('/') || (this.isName('divided') && this.isName('by', 1))) { if (this.next().value === 'divided') this.next(); l = this.node('Binary', t, { op: '/', left: l, right: this.unary() }); }
      else if (this.isOp('%')) { this.next(); l = this.node('Binary', t, { op: '%', left: l, right: this.unary() }); }
      else return l;
    }
  }
  unary() {
    if (this.isOp('-')) { const t = this.next(); return this.node('Unary', t, { op: '-', expr: this.unary() }); }
    return this.postfix();
  }
  postfix() {
    let e = this.primary();
    for (;;) {
      const t = this.peek();
      if (this.isOp('.')) { this.next(); const nt = this.peek(); e = this.node('Member', nt, { obj: e, prop: this.name('a field or action name') }); }
      else if (this.isOp('(')) { this.next(); e = this.node('Call', t, { callee: e, args: this.args() }); }
      else if (this.isOp('[')) { this.next(); e = this.node('Index', t, { obj: e, index: this.expr() }); this.op(']'); }
      else return e;
    }
  }
  args() {
    const args = [];
    if (this.eat(')')) return args;
    do {
      if (this.isOp(')')) break;
      const t = this.peek();
      if (this.is('name') && this.isOp(':', 1)) { const name = this.next().value; this.next(); args.push({ name, value: this.expr(), line: t.line, col: t.col }); }
      else args.push({ name: null, value: this.expr(), line: t.line, col: t.col });
    } while (this.eat(','));
    this.op(')', 'Close the call with `)`.');
    return args;
  }
  primary() {
    const t = this.peek();
    if (t.type === 'number') { this.next(); return this.node('Num', t, { value: t.value }); }
    if (t.type === 'string') {
      this.next();
      return this.node('Str', t, { parts: t.value.map((p) => p.expr !== undefined ? { expr: subExpr(p, this.file) } : p) });
    }
    if (t.type === 'op' && t.value === '(') { this.next(); const e = this.expr(); this.op(')'); return e; }
    if (t.type === 'op' && t.value === '[') {
      this.next(); const items = [];
      if (!this.eat(']')) { do { if (this.isOp(']')) break; items.push(this.expr()); } while (this.eat(',')); this.op(']', 'Close the list with `]`.'); }
      return this.node('List', t, { items });
    }
    if (t.type === 'op' && t.value === '{') {
      this.next(); const entries = [];
      if (!this.eat('}')) {
        do {
          if (this.isOp('}')) break;
          const k = this.peek();
          const key = k.type === 'string' ? (this.next(), k.value.map((x) => x.text).join('')) : this.name('a key');
          this.op(':', 'Write objects as `{name: value}`.');
          entries.push({ key, value: this.expr() });
        } while (this.eat(','));
        this.op('}', 'Close the object with `}`.');
      }
      return this.node('Obj', t, { entries });
    }
    if (t.type === 'name') {
      switch (t.value) {
        case 'true': case 'yes': this.next(); return this.node('Bool', t, { value: true });
        case 'false': case 'no': this.next(); return this.node('Bool', t, { value: false });
        case 'nothing': this.next(); return this.node('Nothing', t, {});
        case 'ask':
          if (this.isName('ai', 1)) {
            this.next(); this.next();
            const n = this.node('AskAi', t, { prompt: this.add(), as: null, oneOf: null, using: null, system: null });
            for (;;) {
              if (this.isName('as') && this.isName('one', 1) && this.isName('of', 2)) { this.p += 3; n.oneOf = this.add(); }
              else if (this.eat('as')) n.as = this.type();
              else if (this.eat('using')) n.using = this.add();
              else if (this.isName('with') && this.isName('system', 1)) { this.p += 2; n.system = this.add(); }
              else break;
            }
            return n;
          }
          break;
        case 'request':
          if (this.is('name', 1) && METHODS.includes(this.peek(1).value)) {
            this.next();
            const n = this.node('Request', t, { method: this.next().value.toUpperCase(), path: this.add(), body: null });
            if (this.eat('with')) n.body = this.add();
            return n;
          }
          break;
      }
      this.next();
      return this.node('Name', t, { name: t.value });
    }
    this.fail(`Expected a value but found ${this.describe(t)}.`,
      t.type === 'newline' ? 'The line ended too early. Finish the expression.' : undefined);
  }
}

function subExpr(part, file) {
  const toks = lex(part.expr, file, { line: part.line, col: part.col, inline: true });
  const p = new Parser(toks, file);
  const e = p.expr();
  if (!p.is('eof')) p.fail(`Unexpected ${p.describe(p.peek())} inside \`{...}\`.`);
  return e;
}
