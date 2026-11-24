// Repository self-test: templates compile and pass their tests, playground
// examples compile, and every ```cluub block in the docs compiles.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, formatAll, generateTests, CODES } from '../compiler/index.js';
import { DECL_KEYWORDS, ALL_TAGS, PROP_KEYS } from '../compiler/parser.js';
import { BUILTINS, STORE_METHODS, BUILTIN_TYPES } from '../compiler/checker.js';
import { runTests } from '../runtime/testing.js';
import { runRegressions } from './regressions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m, detail) => { failures++; console.log(`  \x1b[31m✗\x1b[0m ${m}${detail ? '\n' + detail.replace(/^/gm, '      ') : ''}`); };

function read(dir, base = dir, out = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) read(full, base, out);
    else if (e.name.endsWith('.clb')) out[path.relative(base, full).split(path.sep).join('/')] = fs.readFileSync(full, 'utf8').replaceAll('{{AppName}}', 'Demo');
  }
  return out;
}

console.log('\nTemplates');
for (const t of fs.readdirSync(path.join(ROOT, 'templates'))) {
  const files = read(path.join(ROOT, 'templates', t));
  let r = compile(files, { enforceFolders: true });
  if (!r.ok) { bad(`${t}: compiles`, formatAll(r.diagnostics.filter((d) => d.severity === 'error'), r.sources)); continue; }
  ok(`${t}: compiles in ${r.ms}ms (${r.diagnostics.length} suggestions)`);
  r = compile({ ...files, ...generateTests(r.decls) }, { enforceFolders: true });
  if (!r.ok) { bad(`${t}: generated tests compile`, formatAll(r.diagnostics.filter((d) => d.severity === 'error'), r.sources)); continue; }
  const res = await runTests({ serverCode: r.server, clientCode: r.client });
  if (res.failed) bad(`${t}: tests`, res.results.filter((x) => !x.ok).map((x) => `${x.name}: ${x.error.message}`).join('\n'));
  else ok(`${t}: ${res.passed} tests pass in ${res.ms}ms`);
}

console.log('\nPlayground examples');
const { examples } = await import('../docs/.vitepress/theme/examples.js');
for (const [name, src] of Object.entries(examples)) {
  const r = compile({ 'main.clb': src });
  const expectErrors = name === 'See an error';
  const codes = r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.code).sort().join(',');
  if (expectErrors && codes !== 'E013,E105,E201') bad(`${name}: should report exactly E013, E105, E201`, `got: ${codes}`);
  else if (r.ok === !expectErrors) ok(`${name}: ${expectErrors ? `reports its 3 deliberate errors (${codes})` : 'compiles'}`);
  else bad(`${name}`, formatAll(r.diagnostics.filter((d) => d.severity === 'error'), r.sources));
  if (r.ok) {
    const g = compile({ 'main.clb': src, ...generateTests(r.decls) });
    const res = await runTests({ serverCode: g.server, clientCode: g.client });
    if (res.failed) bad(`${name}: tests`, res.results.filter((x) => !x.ok).map((x) => `${x.name}: ${x.error.message}`).join('\n'));
    else ok(`${name}: ${res.passed} tests pass`);
  }
}

// Docs: each page's cluub blocks are compiled together. Blocks may reference
// things a page doesn't show (e.g. `uses Orders`), so only syntax and
// structural errors count; unknown-name errors are allowed in snippets.
console.log('\nDocs code samples');
const SNIPPET_OK = new Set(['E104', 'E105', 'E106', 'E107', 'E108', 'E109', 'E116', 'E101']);
const mdFiles = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name.startsWith('.')) continue; const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.name.endsWith('.md')) mdFiles.push(f); } };
walk(path.join(ROOT, 'docs'));
mdFiles.push(path.join(ROOT, 'LANGUAGE.md'));
for (const f of mdFiles) {
  const md = fs.readFileSync(f, 'utf8');
  const blocks = [...md.matchAll(/```cluub\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (!blocks.length) continue;
  const rel = path.relative(ROOT, f);
  const errs = [];
  blocks.forEach((b, i) => {
    // A block that starts indented is a fragment of a declaration: wrap it.
    let src = b;
    if (/^\s/.test(src)) src = `service Wrapper\n  action wrapped()\n${src.split('\n').map((l) => '  ' + l).join('\n')}`;
    else if (/^action\b/.test(src)) src = `service Wrapper\n${src.split('\n').map((l) => '  ' + l).join('\n')}`;
    else if (/^(button|row|card|heading|text|input)\b/.test(src)) src = `page Wrapper at "/"\n  state draft = ""\n  state results = []\n  view\n${src.split('\n').map((l) => '    ' + l).join('\n')}`;
    else if (/^(let|if|return|expect|try|require)\b/.test(src)) src = `service Wrapper\n  action wrapped()\n${src.split('\n').map((l) => '    ' + l).join('\n')}`;
    const r = compile({ [`${rel}#${i + 1}`]: src });
    errs.push(...r.diagnostics.filter((d) => d.severity === 'error' && !SNIPPET_OK.has(d.code)).map((d) => ({ d, sources: r.sources })));
  });
  if (errs.length) bad(`${rel} (${blocks.length} blocks)`, errs.map(({ d, sources }) => formatAll([d], sources)).join('\n'));
  else ok(`${rel} (${blocks.length} blocks)`);
}

// Tutorial: every top-level declaration shown in the chapters, in order, with
// later versions replacing earlier ones, must build into one working project.
const tdir = path.join(ROOT, 'docs/tutorial');
if (fs.existsSync(tdir)) {
  console.log('\nTutorial (built as one project)');
  const DECL = /^(app|model|store|client|service|api|page|component|layout|test)\s+("[^"]*"|\w+)/;
  const latest = new Map();
  for (const f of fs.readdirSync(tdir).filter((x) => x.endsWith('.md')).sort()) {
    const md = fs.readFileSync(path.join(tdir, f), 'utf8');
    for (const m of md.matchAll(/```cluub\n([\s\S]*?)```/g)) {
      let cur = null;
      for (const line of m[1].split('\n')) {
        const h = line.match(DECL);
        if (h) { cur = { key: `${h[1]} ${h[2]}`, lines: [line] }; latest.set(cur.key, cur); }
        else if (cur) cur.lines.push(line);
      }
    }
  }
  const files = {};
  [...latest.values()].forEach((d, i) => { files[`tutorial-${String(i).padStart(2, '0')}-${d.key.replace(/\W+/g, '-')}.clb`] = d.lines.join('\n') + '\n'; });
  const r = compile(files);
  if (!latest.size) bad('tutorial has no declarations');
  else if (!r.ok) bad(`tutorial project compiles (${latest.size} declarations)`, formatAll(r.diagnostics.filter((d) => d.severity === 'error'), r.sources));
  else {
    const g = compile({ ...files, ...generateTests(r.decls) });
    const res = g.ok ? await runTests({ serverCode: g.server, clientCode: g.client }) : null;
    if (!res) bad('tutorial generated tests compile', formatAll(g.diagnostics.filter((d) => d.severity === 'error'), g.sources));
    else if (res.failed) bad(`tutorial tests`, res.results.filter((x) => !x.ok).map((x) => `${x.name}: ${x.error.message}`).join('\n'));
    else ok(`tutorial builds as one project (${latest.size} declarations) and ${res.passed} tests pass`);
  }
}

// Reference coverage: every keyword the compiler knows is documented.
console.log('\nReference coverage');
{
  const ref = (f) => { const p = path.join(ROOT, 'docs/reference', f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
  const checks = [
    ['declarations have their own page', DECL_KEYWORDS.filter((k) => !ref(`${k}.md`))],
    ['view elements in view-elements.md', ALL_TAGS.concat(['slot']).filter((t) => !(ref('view-elements.md') || '').includes('`' + t))],
    ['properties in properties-events.md', PROP_KEYS.filter((t) => !(ref('properties-events.md') || '').includes('`' + t))],
    ['events in properties-events.md', ['click', 'change', 'input', 'enter', 'submit', 'blur', 'focus'].filter((t) => !(ref('properties-events.md') || '').includes(t))],
    ['built-ins in builtins.md', Object.keys(BUILTINS).filter((t) => t !== 'app' && !(ref('builtins.md') || '').includes('`' + t))],
    ['store methods in store.md', Object.keys(STORE_METHODS).filter((t) => !(ref('store.md') || '').includes(t + '('))],
    ['types in types.md', BUILTIN_TYPES.filter((t) => !(ref('types.md') || '').includes('`' + t))],
    ['error codes in errors.md', Object.keys(CODES).filter((c) => !(ref('errors.md') || '').includes(c))],
  ];
  for (const [label, missing] of checks) missing.length ? bad(label, `missing: ${missing.join(', ')}`) : ok(label);
}

// Claude skills: valid frontmatter, and shipped into every new project.
console.log('\nClaude skills');
{
  const os = await import('node:os');
  const check = (dir, label) => {
    const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, 'SKILL.md'))) : [];
    const invalid = names.filter((n) => { const t = fs.readFileSync(path.join(dir, n, 'SKILL.md'), 'utf8'); return !new RegExp(`^---\\nname: ${n}\\ndescription: .{40,}\\n---\\n`).test(t); });
    if (!names.length) invalid.push('(none found)');
    invalid.length ? bad(`${label} have valid frontmatter`, `invalid: ${invalid.join(', ')}`) : ok(`${label}: ${names.length} skills with valid frontmatter`);
    return names;
  };
  const appSkills = check(path.join(ROOT, 'skills'), 'app skills');
  check(path.join(ROOT, '.claude/skills'), 'repo skills');
  const { createProject } = await import('../cli/new.js');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cluub-skills-'));
  const { dest } = createProject('skilltest', { template: 'blank', cwd: tmp });
  const shipped = fs.readdirSync(path.join(dest, '.claude/skills'));
  (shipped.length === appSkills.length && fs.existsSync(path.join(dest, 'CLAUDE.md'))) ? ok(`new projects get ${shipped.length} skills and CLAUDE.md`) : bad('new projects get the skills and CLAUDE.md', `got ${shipped.length}`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('\nRegressions');
await runRegressions(ok, bad);

console.log('\nTheme');
{
  const css = fs.readFileSync(path.join(ROOT, 'runtime/theme.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'runtime/client.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'compiler/codegen.js'), 'utf8');
  const used = [...new Set([...js.matchAll(/class:\s*'([a-z-]+)'|"(row|col|card|grid|badge|spinner)"/g)].map((m) => m[1] || m[2]))];
  const missing = used.filter((c) => !new RegExp(`\\.${c}\\b`).test(css));
  if (missing.length) bad('theme defines every class the runtime uses', `missing: ${missing.join(', ')}`);
  else ok(`theme defines all ${used.length} runtime classes (${used.join(', ')})`);
}

console.log(failures ? `\n\x1b[31m${failures} failure(s)\x1b[0m` : '\n\x1b[32mAll good\x1b[0m');
process.exit(failures ? 1 : 0);
