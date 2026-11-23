// `cluub explain --for po|ba|qa|dev`: describes the project in plain English,
// straight from the code, so it can never drift out of date.
import { routeParams } from './checker.js';

const text = (e) => (e?.kind === 'Str' ? e.parts.map((p) => p.text ?? `{…}`).join('') : '');
function src(e) {
  if (!e) return '';
  switch (e.kind) {
    case 'Num': return String(e.value);
    case 'Str': return `"${text(e)}"`;
    case 'Bool': return String(e.value);
    case 'Nothing': return 'nothing';
    case 'Name': return e.name;
    case 'Member': return `${src(e.obj)}.${e.prop}`;
    case 'Call': return `${src(e.callee)}(…)`;
    case 'IsEmpty': return `${src(e.expr)} is empty`;
    case 'Unary': return e.op === 'not' ? (e.expr.kind === 'IsEmpty' ? `${src(e.expr.expr)} is not empty` : `not ${src(e.expr)}`) : `-${src(e.expr)}`;
    case 'Binary': return `${src(e.left)} ${{ is: 'is', '>': 'is greater than', '<': 'is less than', '>=': 'is at least', '<=': 'is at most', has: 'has', oneOf: 'is one of', and: 'and', or: 'or' }[e.op] || e.op} ${src(e.right)}`;
    case 'List': return `[${e.items.map(src).join(', ')}]`;
    default: return '…';
  }
}
const typeName = (t) => (!t ? 'any' : t.name === 'list' ? `list of ${typeName(t.of)}` : t.name) + (t?.optional ? ' (optional)' : '');
function rules(body, out = []) {
  for (const s of body || []) {
    if (s.kind === 'Require') out.push({ rule: src(s.cond), message: text(s.message) || src(s.message) });
    if (s.kind === 'Fail') out.push({ rule: 'fails', message: text(s.message) || src(s.message) });
    for (const k of ['then', 'else', 'body', 'handler']) if (Array.isArray(s[k])) rules(s[k], out);
  }
  return out;
}
function usesAI(body) { return JSON.stringify(body, (k, v) => (k === 'ref' || k === 'decl' || k === 'action' ? undefined : v)).includes('"kind":"AskAi"'); }

export function explain(decls, role = 'all', testFiles = {}) {
  const by = (k) => decls.filter((d) => d.kind === k);
  const app = by('App')[0];
  const out = [];
  const H = (s) => out.push(`\n## ${s}\n`);
  out.push(`# ${app?.name || 'Cluub app'}${app?.settings?.about ? ` — ${text(app.settings.about)}` : ''}`);
  const want = (r) => role === 'all' || role === r;

  if (want('po')) {
    H('For product owners: what users can do');
    for (const p of by('Page')) {
      out.push(`### ${p.name} screen (\`${p.pathText}\`)`);
      if (p.about) out.push(text(p.about));
      const acts = p.actions.map((a) => `- ${a.about ? text(a.about) : humanize(a.name)}`);
      if (acts.length) out.push('Users can:\n' + acts.join('\n'));
      out.push('');
    }
    const ai = [...by('Service')].flatMap((s) => s.actions.filter((a) => usesAI(a.body)).map((a) => `- ${s.name}: ${a.about ? text(a.about) : humanize(a.name)}`));
    if (ai.length) { H('AI-powered features'); out.push(ai.join('\n')); }
  }

  if (want('ba')) {
    H('For business analysts: data and business rules');
    for (const m of by('Model')) {
      out.push(`### ${m.name}${m.about ? ` — ${text(m.about)}` : ''}\n| Field | Type | Rules |\n|---|---|---|`);
      for (const f of m.fields) {
        const r = f.constraints.map((c) => (c.name === 'required' ? 'required' : c.name === 'oneOf' ? `one of ${src(c.value)}` : `${c.name} ${src(c.value)}`));
        if (f.default) r.push(`defaults to ${src(f.default)}`);
        out.push(`| ${f.name} | ${typeName(f.type)} | ${r.join(', ') || '—'} |`);
      }
      out.push('');
    }
    const br = by('Service').flatMap((s) => s.actions.flatMap((a) => rules(a.body).map((r) => `| ${s.name}.${a.name} | ${r.rule === 'fails' ? '(error case)' : r.rule} | ${r.message} |`)));
    if (br.length) { out.push('### Business rules\n| Where | Rule | Message shown |\n|---|---|---|'); out.push(...br); }
    const routes = by('Api').flatMap((a) => a.routes.map((r) => `| ${r.method} | \`${(a.baseText.replace(/\/$/, '') + '/' + r.pathText.replace(/^\//, '')).replace(/\/$/, '') || '/'}\` | ${(r.allParams || routeParams(r, a.baseText)).map((p) => `${p.name}: ${typeName(p.type)}`).join(', ') || '—'} |`));
    if (routes.length) { out.push('\n### API endpoints\n| Method | Path | Inputs |\n|---|---|---|'); out.push(...routes); }
  }

  if (want('qa')) {
    H('For QA: what is tested');
    const written = by('Test').filter((t) => !t.file.includes('generated'));
    const generated = by('Test').filter((t) => t.file.includes('generated'));
    out.push(`- ${written.length} hand-written test${written.length === 1 ? '' : 's'}, ${generated.length} generated test${generated.length === 1 ? '' : 's'} (run \`cluub test\`).`);
    if (written.length) out.push('\n### Hand-written tests\n' + written.map((t) => `- ${t.title} _(${t.file}:${t.line})_`).join('\n'));
    if (generated.length) out.push('\n### Generated tests\n' + generated.map((t) => `- ${t.title}`).join('\n'));
    const edge = by('Service').flatMap((s) => s.actions.flatMap((a) => rules(a.body).map((r) => `- ${s.name}.${a.name}: check "${r.message}" appears when ${r.rule === 'fails' ? 'the error case happens' : `NOT (${r.rule})`}`)));
    if (edge.length) out.push('\n### Edge cases to explore manually\n' + edge.join('\n'));
  }

  if (want('dev')) {
    H('For developers: architecture');
    out.push('Flow: **page → api → service → store (data) / client (network) / ai**\n');
    out.push('```');
    for (const k of ['Page', 'Api', 'Service']) for (const d of by(k)) out.push(`${k.toLowerCase().padEnd(8)} ${d.name.padEnd(20)} uses ${d.uses.map((u) => u.name).join(', ') || '—'}`);
    for (const d of by('Store')) out.push(`store    ${d.name.padEnd(20)} holds ${d.holds}${d.savedIn ? ` (saved in ${src(d.savedIn)})` : ' (in memory)'}`);
    for (const d of by('Client')) out.push(`client   ${d.name.padEnd(20)} at ${src(d.base)}`);
    out.push('```');
  }
  return out.join('\n') + '\n';
}

function humanize(name) { const s = name.replace(/([A-Z])/g, ' $1').toLowerCase(); return s[0].toUpperCase() + s.slice(1); }
