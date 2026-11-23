#!/usr/bin/env node
// The Cluub command line. Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, formatAll, generateTests, explain, CODES } from '../compiler/index.js';
import { createProject } from './new.js';

const HOME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(fs.readFileSync(path.join(HOME, 'package.json'), 'utf8')).version;
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c(1, s), dim = (s) => c(2, s), green = (s) => c(32, s), red = (s) => c(31, s), yellow = (s) => c(33, s), cyan = (s) => c(36, s);

const [cmd = 'help', ...rest] = process.argv.slice(2);
const flags = {}; const args = [];
for (let i = 0; i < rest.length; i++) {
  const BOOLEAN = ['no-generate', 'help'];
  if (rest[i].startsWith('--')) { const k = rest[i].slice(2); flags[k] = !BOOLEAN.includes(k) && rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; }
  else args.push(rest[i]);
}

const commands = {
  help, version: () => console.log(`cluub ${VERSION}`), new: newProject, build, dev, start, test, check, explain: explainCmd, make, errors: errorsCmd, ai: aiCmd,
};
const run = commands[cmd] || (() => { console.error(red(`Unknown command "${cmd}".`) + ` Run ${cyan('cluub help')} to see all commands.`); process.exit(1); });
Promise.resolve().then(run).catch((e) => { console.error(red(`✗ ${e.message}`)); if (process.env.CLUUB_DEBUG) console.error(e.stack); process.exit(1); });

function help() {
  console.log(`
${bold('Cluub')} ${dim(VERSION)}: one language for frontend, backend and AI.

${bold('Start')}
  cluub new <name> [--template app|ai-chat|blank]   Create a project
  cluub dev [--port 3000]                           Run with live reload
  cluub make "<what you want>"                      Let AI write or change code for you

${bold('Quality')}
  cluub check                                       Find errors and get suggestions
  cluub test [filter] [--no-generate]               Generate and run tests (frontend + backend)
  cluub explain [--for po|ba|qa|dev] [--out file]   Explain the project in plain English

${bold('AI keys')} ${dim('(bring your own key; Cluub never ships or proxies one)')}
  cluub ai                                          Show which provider keys are set
  cluub ai set <claude|openai|gemini>               Save a key in .env (asked for privately)
  cluub ai use <provider[:model]>                   Choose the default provider and model
  cluub ai test [provider]                          Check that a key works (one tiny request)
  cluub ai remove <provider>                        Delete a key from .env

${bold('Ship')}
  cluub build                                       Compile to dist/
  cluub start [--port 3000]                         Run the built app
  cluub errors [CODE]                               Look up an error code
`);
}

// ---------- project helpers ----------
function findRoot() {
  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, 'app.clb'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) throw new Error('No Cluub project here (no app.clb found). Create one with `cluub new my-app`.');
    dir = up;
  }
}

function readSources(root, { withGenerated = false, withTests = true } = {}) {
  const files = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || ['dist', 'node_modules'].includes(e.name)) continue;
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (e.isDirectory()) {
        if (rel === 'tests/generated' && !withGenerated) continue;
        if (rel === 'tests' && !withTests) continue;
        walk(full);
      } else if (e.name.endsWith('.clb')) files[rel] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(root);
  return files;
}

function report(result, { quiet = false } = {}) {
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  const shown = quiet ? errors : result.diagnostics;
  if (shown.length) console.log(formatAll(shown, result.sources, color));
  const warnings = result.diagnostics.filter((d) => d.severity === 'warning').length;
  const hints = result.diagnostics.filter((d) => d.severity === 'hint').length;
  if (errors.length) console.log(red(bold(`✗ ${errors.length} error${errors.length > 1 ? 's' : ''}`)) + dim(` · ${warnings} warnings · ${hints} suggestions`));
  return errors.length === 0;
}

function compileProject(root, opts = {}) {
  const sources = readSources(root, opts);
  return compile(sources, { enforceFolders: true });
}

function writeDist(root, result, { dev = false } = {}) {
  const dist = path.join(root, 'dist');
  const pub = path.join(dist, 'public');
  fs.rmSync(dist, { recursive: true, force: true });
  for (const d of [path.join(pub, '_cluub', 'runtime'), path.join(pub, '_cluub', 'compiler'), path.join(dist, 'runtime'), path.join(dist, 'compiler')]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(dist, 'server.js'), result.server);
  fs.writeFileSync(path.join(pub, '_cluub', 'app.client.js'), `export default function (R) {\n${result.client}}\n`);
  // Browser runtime
  for (const f of ['client.js', 'core.js', 'errors.js', 'messages.js', 'ai.js']) fs.copyFileSync(path.join(HOME, 'runtime', f), path.join(pub, '_cluub', 'runtime', f));
  fs.copyFileSync(path.join(HOME, 'compiler', 'diagnostics.js'), path.join(pub, '_cluub', 'compiler', 'diagnostics.js'));
  fs.copyFileSync(path.join(HOME, 'runtime', 'theme.css'), path.join(pub, '_cluub', 'theme.css'));
  // Server runtime, so `node dist/start.mjs` runs without Cluub installed
  for (const f of ['node.js', 'core.js', 'errors.js', 'messages.js', 'ai.js']) fs.copyFileSync(path.join(HOME, 'runtime', f), path.join(dist, 'runtime', f));
  fs.copyFileSync(path.join(HOME, 'compiler', 'diagnostics.js'), path.join(dist, 'compiler', 'diagnostics.js'));
  fs.writeFileSync(path.join(dist, 'start.mjs'), `// Runs the built app with plain Node: node dist/start.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './runtime/node.js';
const dist = path.dirname(fileURLToPath(import.meta.url));
const srv = await startServer({ root: path.resolve(dist, '..'), dist, port: Number(process.env.PORT || 0) });
console.log(\`Running at http://localhost:\${srv.port}\`);
`);
  fs.writeFileSync(path.join(pub, '_cluub', 'boot.js'), `import { bootClient } from '/_cluub/runtime/client.js';
import program from '/_cluub/app.client.js';
const request = async (method, url, body, extra = {}) => {
  const res = await fetch(url, { method, headers: { ...extra, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
bootClient(program, { root: document.getElementById('app'), request }).start();
${dev ? `// Live reload: reload when the dev server reports a new build.
let build = null;
new EventSource('/_cluub/reload').onmessage = (e) => { if (build === null) build = e.data; else if (e.data !== build) location.reload(); };` : ''}
`);
  const userCss = path.join(root, 'theme.css');
  const assets = path.join(root, 'assets');
  if (fs.existsSync(assets)) fs.cpSync(assets, path.join(pub, 'assets'), { recursive: true });
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const title = result.app?.name || 'Cluub app';
  const langExpr = result.app?.settings?.lang;
  const lang = langExpr?.kind === 'Str' ? langExpr.parts.map((x) => x.text ?? '').join('') : 'en';
  fs.writeFileSync(path.join(pub, 'index.html'), `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/_cluub/theme.css">${fs.existsSync(userCss) ? '\n<link rel="stylesheet" href="/assets/theme.css">' : ''}
</head>
<body>
<div id="app"></div>
<script type="module" src="/_cluub/boot.js"></script>
</body>
</html>
`);
  if (fs.existsSync(userCss)) { fs.mkdirSync(path.join(pub, 'assets'), { recursive: true }); fs.copyFileSync(userCss, path.join(pub, 'assets', 'theme.css')); }
  return dist;
}

function summary(result) {
  const n = (k) => result.decls.filter((d) => d.kind === k).length;
  return `${n('Page')} pages · ${n('Api')} apis · ${n('Service')} services · ${n('Model')} models`;
}

// ---------- commands ----------
function newProject() {
  const { dest } = createProject(args[0], { template: flags.template || 'app' });
  const name = path.basename(dest);
  const template = flags.template || 'app';
  console.log(`\n${green('✓')} Created ${bold(name)} from the ${cyan(template)} template.\n\n  cd ${name}\n  cluub dev\n\nThen open http://localhost:3000. Edit any .clb file and the page reloads.\n${template !== 'blank' ? `For AI features, run ${cyan('cluub ai set claude')} (or openai / gemini) to add your own key.\n` : ''}`);
}

function build() {
  const root = findRoot();
  const r = compileProject(root);
  if (!report(r, { quiet: true })) process.exit(1);
  writeDist(root, r);
  console.log(`${green('✓')} Built in ${r.ms}ms → dist/ ${dim(`(${summary(r)})`)}`);
}

async function start() {
  const root = findRoot();
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'server.js'))) throw new Error('Nothing built yet. Run `cluub build` first (or `cluub dev`).');
  const { startServer } = await import('../runtime/node.js');
  const srv = await startServer({ root, dist, port: Number(flags.port || process.env.PORT || 0) });
  console.log(`${green('✓')} Running at ${cyan(`http://localhost:${srv.port}`)}`);
}

async function dev() {
  const root = findRoot();
  const { startServer } = await import('../runtime/node.js');
  let port = Number(flags.port || 0);
  let srv = null;
  const rebuild = async (first) => {
    const r = compileProject(root);
    console.clear?.();
    const ok = report(r);
    if (!ok) { console.log(dim('Waiting for you to fix the errors above…')); return; }
    if (!port) port = Number(process.env.PORT || 0);
    writeDist(root, r, { dev: true });
    if (srv) await srv.close();
    srv = await startServer({ root, dist: path.join(root, 'dist'), port, dev: true, buildId: String(Date.now()) });
    port = srv.port;
    console.log(`${green('✓')} ${first ? 'Started' : 'Rebuilt'} in ${r.ms}ms ${dim(`(${summary(r)})`)}\n  ${cyan(`http://localhost:${port}`)}  ${dim('· watching for changes · Ctrl+C to stop')}`);
  };
  await rebuild(true);
  let timer = null;
  fs.watch(root, { recursive: true }, (_, file) => {
    const f = String(file || '');
    if (!f || f.startsWith('dist') || f.startsWith('storage') || !(f.endsWith('.clb') || f.endsWith('.css') || f === '.env')) return;
    clearTimeout(timer);
    timer = setTimeout(() => rebuild(false).catch((e) => console.error(red(e.message))), 60);
  });
}

async function test() {
  const root = findRoot();
  let r = compileProject(root);
  if (!report(r, { quiet: true })) process.exit(1);
  const genDir = path.join(root, 'tests', 'generated');
  if (!flags['no-generate']) {
    fs.rmSync(genDir, { recursive: true, force: true });
    const gen = generateTests(r.decls);
    for (const [file, content] of Object.entries(gen)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), content); }
    { const n = Object.values(gen).join('').split('\ntest ').length - 1; console.log(dim(`Generated ${n} test${n === 1 ? '' : 's'} in tests/generated/`)); }
  }
  r = compileProject(root, { withGenerated: true });
  if (!report(r, { quiet: true })) process.exit(1);
  const { runTests } = await import('../runtime/testing.js');
  const { loadEnv } = await import('../runtime/node.js');
  let lastFile = null;
  const res = await runTests({
    serverCode: r.server, clientCode: r.client, env: loadEnv(root), filter: args[0],
    onResult: (t) => {
      if (t.file !== lastFile) { console.log(`\n${bold(t.file)}`); lastFile = t.file; }
      console.log(`  ${t.ok ? green('✓') : red('✗')} ${t.name} ${dim(`${t.ms}ms`)}`);
      if (!t.ok) console.log(red(`      ${t.error.message.split('\n').join('\n      ')}`) + dim(`\n      at ${t.error.at}`));
    },
  });
  console.log(`\n${res.failed ? red(bold(`✗ ${res.failed} failed`)) + ', ' : ''}${green(`${res.passed} passed`)} ${dim(`in ${res.ms}ms`)}`);
  if (res.failed) process.exit(1);
}

function check() {
  const root = findRoot();
  const r = compileProject(root);
  report(r);
  if (r.ok) console.log(`${green('✓')} No errors ${dim(`(${r.diagnostics.length} suggestions · checked in ${r.ms}ms)`)}`);
  else process.exit(1);
}

function explainCmd() {
  const root = findRoot();
  const r = compileProject(root, { withGenerated: true });
  if (!report(r, { quiet: true })) process.exit(1);
  const md = explain(r.decls, flags.for || 'all');
  if (flags.out) { fs.writeFileSync(path.resolve(flags.out), md); console.log(`${green('✓')} Wrote ${flags.out}`); }
  else console.log(md);
}

function errorsCmd() {
  const code = args[0]?.toUpperCase();
  if (code) { console.log(CODES[code] ? `${bold(code)}: ${CODES[code]}\nMore: docs/reference/errors.md` : red(`Unknown code ${code}.`)); return; }
  for (const [k, v] of Object.entries(CODES)) console.log(`${k.startsWith('E') ? red(k) : yellow(k)}  ${v}`);
}

// `cluub make "add a page that lists customers"` - AI writes Cluub code, the compiler
// checks it, and errors are fed back to the AI until the project compiles.
async function make() {
  const want = args.join(' ').trim();
  if (!want) throw new Error('Say what you want, e.g. `cluub make "add a contact form that emails me"`.');
  const root = findRoot();
  const { loadEnv } = await import('../runtime/node.js');
  const { createAI } = await import('../runtime/ai.js');
  const env = loadEnv(root);
  const ai = createAI({ env, settings: flags.using ? { ai: flags.using } : {} });
  const guide = fs.readFileSync(path.join(HOME, 'LANGUAGE.md'), 'utf8');
  const current = readSources(root, { withTests: true });
  const system = `You write code in the Cluub programming language. Follow this reference exactly:\n\n${guide}\n\nReply ONLY with files in this exact format, one block per file you create or change, using full file contents:\n=== file: <relative/path.clb>\n<content>\n=== end`;
  let prompt = `Current project files:\n\n${Object.entries(current).map(([f, s]) => `=== file: ${f}\n${s}\n=== end`).join('\n')}\n\nRequest: ${want}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(dim(attempt === 1 ? 'Asking AI…' : `Fixing compile errors (attempt ${attempt})…`));
    const reply = await ai.ask(prompt, { system, using: flags.using });
    const changed = {};
    for (const m of reply.matchAll(/=== file: (.+?)\n([\s\S]*?)\n=== end/g)) {
      const f = m[1].trim();
      if (!f.endsWith('.clb') || f.includes('..') || path.isAbsolute(f)) continue;
      changed[f] = m[2] + '\n';
    }
    if (!Object.keys(changed).length) throw new Error('The AI reply did not contain any files. Try rephrasing your request.');
    const r = compile({ ...current, ...changed }, { enforceFolders: true });
    if (r.ok) {
      for (const [f, s] of Object.entries(changed)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), s); console.log(`  ${current[f] ? yellow('changed') : green('created')} ${f}`); }
      console.log(`${green('✓')} Done. The project compiles. Run ${cyan('cluub test')} to check it.`);
      return;
    }
    const errs = formatAll(r.diagnostics.filter((d) => d.severity === 'error'), { ...current, ...changed });
    prompt += `\n\nYour previous answer:\n${reply}\n\nIt has compile errors:\n${errs}\nReturn corrected files in the same format.`;
  }
  throw new Error('The AI could not produce code that compiles after 3 tries. Nothing was changed.');
}

// ---------- `cluub ai`: manage your own AI provider keys ----------
const KEY_VARS = { claude: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY' };
const mask = (k) => (k.length > 8 ? `${k.slice(0, 4)}…${k.slice(-4)}` : '••••');

function editEnv(root, changes) {
  const file = path.join(root, '.env');
  let lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : [];
  for (const [name, value] of Object.entries(changes)) {
    const re = new RegExp(`^\\s*(export\\s+)?${name}\\s*=`);
    lines = lines.filter((l) => !re.test(l));
    if (value !== null) lines.push(`${name}=${value}`);
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  fs.writeFileSync(file, lines.join('\n') + '\n', { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  // Make sure keys can never be committed by accident.
  const gi = path.join(root, '.gitignore');
  const ignore = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  if (!/^\.env$/m.test(ignore)) fs.writeFileSync(gi, ignore + (ignore && !ignore.endsWith('\n') ? '\n' : '') + '.env\n');
}

function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    if (!stdin.isTTY) { let data = ''; stdin.setEncoding('utf8'); stdin.on('data', (c) => { data += c; }); stdin.on('end', () => resolve(data.trim())); return; }
    let value = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); process.stdout.write('\n'); resolve(value.trim()); }
      else if (ch === '\u0003') { process.stdout.write('\n'); process.exit(1); }
      else if (ch === '\u007f') value = value.slice(0, -1);
      else value += ch;
    };
    stdin.on('data', onData);
  });
}

async function aiCmd() {
  const root = findRoot();
  const { loadEnv, parseEnv } = await import('../runtime/node.js');
  const [sub = 'status', providerArg, keyArg] = args;
  const provider = (providerArg || '').toLowerCase().replace(/^anthropic$/, 'claude').replace(/^google$/, 'gemini');
  const fileEnv = fs.existsSync(path.join(root, '.env')) ? parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8')) : {};
  const r = compileProject(root);
  const setting = (k) => { const e = r.app?.settings?.[k]; return e?.kind === 'Str' ? e.parts.map((p) => p.text ?? '').join('') : null; };

  if (sub === 'status') {
    console.log(`\n${bold('AI keys for this project')} ${dim('(stored in .env, which is git-ignored)')}`);
    for (const [p, v] of Object.entries(KEY_VARS)) {
      const k = process.env[v] || fileEnv[v];
      console.log(`  ${p.padEnd(7)} ${k ? green('✓ set') + dim(`  ${mask(k)}${process.env[v] ? ' (from your environment)' : ''}`) : dim('– not set')}`);
    }
    console.log(`  ${'ollama'.padEnd(7)} ${dim('no key needed (local models)')}`);
    console.log(`\n  Default provider: ${cyan(process.env.CLUUB_AI || fileEnv.CLUUB_AI || setting('ai') || 'first provider with a key')}`);
    console.log(`  Whose keys pay:   ${cyan(setting('aiKeys') || 'server')} ${dim('(app.clb `aiKeys`: server, user or either)')}\n`);
    return;
  }
  if (sub === 'set') {
    if (!KEY_VARS[provider]) throw new Error('Say which provider: `cluub ai set claude`, `cluub ai set openai` or `cluub ai set gemini`.');
    let key = keyArg;
    if (key) console.log(yellow('Tip: next time leave the key out and paste it when asked, so it is not saved in your shell history.'));
    else key = await askHidden(`Paste your ${provider} API key (input is hidden): `);
    if (!key || key.length < 10) throw new Error('That does not look like an API key. Nothing was saved.');
    editEnv(root, { [KEY_VARS[provider]]: key });
    console.log(`${green('✓')} Saved your ${provider} key (${mask(key)}) in .env. Check it with ${cyan(`cluub ai test ${provider}`)}.`);
    return;
  }
  if (sub === 'remove') {
    if (!KEY_VARS[provider]) throw new Error('Say which provider: `cluub ai remove claude`.');
    editEnv(root, { [KEY_VARS[provider]]: null });
    console.log(`${green('✓')} Removed the ${provider} key from .env.`);
    return;
  }
  if (sub === 'use') {
    if (!providerArg) throw new Error('Say which provider, e.g. `cluub ai use claude` or `cluub ai use ollama:llama3.2`.');
    editEnv(root, { CLUUB_AI: providerArg });
    console.log(`${green('✓')} Default AI provider is now ${cyan(providerArg)} (CLUUB_AI in .env).`);
    return;
  }
  if (sub === 'test') {
    const { createAI } = await import('../runtime/ai.js');
    const env = loadEnv(root);
    const settings = { ai: setting('ai') || undefined, aiModel: setting('aiModel') || undefined };
    const ai = createAI({ env, settings });
    const t0 = Date.now();
    process.stdout.write(dim(`Sending one tiny request${provider ? ` to ${provider}` : ''}… `));
    const reply = await ai.ask('Reply with exactly the word OK.', { using: provider || undefined });
    console.log(`\n${green('✓')} The key works. Reply: "${String(reply).trim().slice(0, 40)}" ${dim(`(${Date.now() - t0}ms)`)}`);
    return;
  }
  throw new Error(`Unknown \`cluub ai ${sub}\`. Use: status, set, use, test, remove.`);
}
