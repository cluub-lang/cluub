<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { compile, formatDiagnostic, generateTests, explain } from '../../../compiler/index.js';
import { createBackendR, instantiate, createBackend, makeR, ctxFromHeaders } from '../../../runtime/core.js';
import { createFrontend, h } from '../../../runtime/client.js';
import { runTests } from '../../../runtime/testing.js';
import themeCss from '../../../runtime/theme.css?raw';
import { examples } from './examples.js';

const names = Object.keys(examples);
const example = ref(names[1]);
const code = ref(examples[names[1]]);
const tab = ref('preview');
const role = ref('po');
const result = ref(null);
const tests = ref(null);
const testing = ref(false);
const frame = ref(null);
const editor = ref(null);
const path = ref('/');
let timer = null;

const errors = computed(() => (result.value?.diagnostics || []).filter((d) => d.severity === 'error'));
const others = computed(() => (result.value?.diagnostics || []).filter((d) => d.severity !== 'error'));
const explainText = computed(() => (result.value?.ok ? explain(result.value.decls, role.value) : ''));
const lineCount = computed(() => code.value.split('\n').length);

function mount(r) {
  const doc = frame.value?.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>${themeCss}</style></head><body><div id="app"></div></body></html>`);
  doc.close();
  if (!r.ok) return;
  const settings = {};
  const R = createBackendR({ settings, fakeAI: true });
  const prog = instantiate(r.server, R);
  Object.assign(settings, prog.app.settings);
  const backend = createBackend(prog, R, { dev: true, onError: (e) => console.warn(e) });
  const clientProg = instantiate(r.client, makeR({ h }));
  if (!clientProg.pages.length) {
    doc.getElementById('app').innerHTML = '<main class="cluub-page"><p class="muted">This program has no pages. Add a <code>page Home at "/"</code> to see a preview.</p></main>';
    return;
  }
  createFrontend(clientProg, { request: (m, u, b, hd) => backend.dispatch(m, u, b, ctxFromHeaders(hd)), root: doc.getElementById('app'), doc, onNavigate: (p) => { path.value = p; } }).start('/');
}

function run() {
  const r = compile({ 'main.clb': code.value });
  result.value = r;
  tests.value = null;
  if (!r.ok && tab.value === 'preview') tab.value = 'problems';
  nextTick(() => mount(r));
  try { history.replaceState(null, '', '#code=' + btoa(unescape(encodeURIComponent(code.value)))); } catch { /* ignore */ }
}

async function runAllTests() {
  if (!result.value?.ok) return;
  testing.value = true;
  try {
    const gen = generateTests(result.value.decls);
    const r = compile({ 'main.clb': code.value, ...gen });
    if (!r.ok) { tests.value = { error: r.diagnostics.filter((d) => d.severity === 'error').map((d) => formatDiagnostic(d, r.sources)).join('\n') }; return; }
    const res = await runTests({ serverCode: r.server, clientCode: r.client });
    tests.value = { ...res, generated: gen };
  } finally { testing.value = false; }
}

function jump(d) {
  const lines = code.value.split('\n');
  let pos = 0;
  for (let i = 0; i < d.line - 1; i++) pos += lines[i].length + 1;
  pos += (d.col || 1) - 1;
  editor.value.focus();
  editor.value.setSelectionRange(pos, pos + (d.length || 1));
}

function onKey(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const el = e.target, s = el.selectionStart;
    code.value = code.value.slice(0, s) + '  ' + code.value.slice(el.selectionEnd);
    nextTick(() => el.setSelectionRange(s + 2, s + 2));
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    const el = e.target, s = el.selectionStart;
    const lineStart = code.value.lastIndexOf('\n', s - 1) + 1;
    const line = code.value.slice(lineStart, s);
    let indent = line.match(/^ */)[0];
    if (/^\s*(model|service|api|page|component|layout|test|store|client|app|view|action|if|else|for|while|try|catch|when|row|column|card|box|header|footer|nav|section|grid|list|form)\b/.test(line) && !/,\s*$/.test(line)) indent += '  ';
    code.value = code.value.slice(0, s) + '\n' + indent + code.value.slice(el.selectionEnd);
    nextTick(() => el.setSelectionRange(s + 1 + indent.length, s + 1 + indent.length));
  }
}

function syncScroll(e) { const g = e.target.previousElementSibling; if (g) g.scrollTop = e.target.scrollTop; }

watch(example, (n) => { code.value = examples[n]; tab.value = 'preview'; });
watch(code, () => { clearTimeout(timer); timer = setTimeout(run, 300); });
watch(tab, (t) => { if (t === 'tests' && !tests.value) runAllTests(); if (t === 'preview') nextTick(() => mount(result.value)); });

onMounted(() => {
  const m = location.hash.match(/#code=(.+)/);
  if (m) { try { code.value = decodeURIComponent(escape(atob(m[1]))); } catch { /* ignore */ } }
  run();
});
</script>

<template>
  <div class="pg">
    <div class="pg-bar">
      <select v-model="example" aria-label="Example">
        <option v-for="n in names" :key="n" :value="n">{{ n }}</option>
      </select>
      <span class="pg-status" :class="{ bad: result && !result.ok }">
        <template v-if="result">
          {{ result.ok ? `✓ compiled in ${result.ms}ms` : `✗ ${errors.length} error${errors.length === 1 ? '' : 's'}` }}
          <span v-if="others.length" class="pg-dim"> · {{ others.length }} suggestion{{ others.length === 1 ? '' : 's' }}</span>
        </template>
      </span>
    </div>
    <div class="pg-main">
      <div class="pg-editor">
        <pre class="pg-gutter" aria-hidden="true"><span v-for="n in lineCount" :key="n" :class="{ err: errors.some((d) => d.line === n) }">{{ n }}</span></pre>
        <textarea ref="editor" v-model="code" spellcheck="false" autocapitalize="off" autocomplete="off" @keydown="onKey" @scroll="syncScroll" aria-label="Cluub code"></textarea>
      </div>
      <div class="pg-out">
        <div class="pg-tabs" role="tablist">
          <button v-for="t in [['preview', 'Preview'], ['problems', `Problems${result?.diagnostics.length ? ' (' + result.diagnostics.length + ')' : ''}`], ['tests', 'Tests'], ['explain', 'Explain'], ['js', 'JavaScript']]" :key="t[0]" :class="{ on: tab === t[0] }" role="tab" @click="tab = t[0]">{{ t[1] }}</button>
        </div>
        <div v-show="tab === 'preview'" class="pg-preview">
          <div class="pg-url">{{ path }}</div>
          <iframe ref="frame" title="App preview"></iframe>
        </div>
        <div v-if="tab === 'problems'" class="pg-panel">
          <p v-if="!result?.diagnostics.length" class="pg-ok">No problems. Nice.</p>
          <button v-for="(d, i) in result?.diagnostics" :key="i" class="pg-diag" :class="d.severity" @click="jump(d)">
            <div class="pg-diag-head"><b>{{ d.severity === 'hint' ? 'suggestion' : d.severity }} {{ d.code }}</b> <span>line {{ d.line }}</span></div>
            <div>{{ d.message }}</div>
            <div v-if="d.hint" class="pg-hint">💡 {{ d.hint }}</div>
          </button>
        </div>
        <div v-if="tab === 'tests'" class="pg-panel">
          <p v-if="!result?.ok">Fix the errors first.</p>
          <p v-else-if="testing">Running tests…</p>
          <pre v-else-if="tests?.error">{{ tests.error }}</pre>
          <template v-else-if="tests">
            <p :class="tests.failed ? 'pg-bad' : 'pg-ok'">{{ tests.failed ? `✗ ${tests.failed} failed, ` : '✓ ' }}{{ tests.passed }} passed in {{ tests.ms }}ms</p>
            <div v-for="(t, i) in tests.results" :key="i" class="pg-test" :class="{ fail: !t.ok }">
              <span>{{ t.ok ? '✓' : '✗' }}</span> {{ t.name }} <em v-if="t.generated">generated</em>
              <pre v-if="!t.ok">{{ t.error.message }}</pre>
            </div>
            <details><summary>See the generated test code</summary><pre v-for="(src, f) in tests.generated" :key="f">{{ src }}</pre></details>
            <button class="pg-btn" @click="runAllTests">Run again</button>
          </template>
        </div>
        <div v-if="tab === 'explain'" class="pg-panel">
          <div class="pg-roles">
            <button v-for="r in [['po', 'Product owner'], ['ba', 'Business analyst'], ['qa', 'QA'], ['dev', 'Developer']]" :key="r[0]" :class="{ on: role === r[0] }" @click="role = r[0]">{{ r[1] }}</button>
          </div>
          <pre class="pg-md">{{ explainText || 'Fix the errors first.' }}</pre>
        </div>
        <div v-if="tab === 'js'" class="pg-panel">
          <p class="pg-dim">This is the plain JavaScript Cluub generated. No framework, no dependencies.</p>
          <pre class="pg-code">{{ result?.ok ? `// ---- client ----\n${result.client}\n// ---- server ----\n${result.server}` : 'Fix the errors first.' }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pg { border: 1px solid var(--vp-c-divider); border-radius: 12px; overflow: hidden; background: var(--vp-c-bg); }
.pg-bar { display: flex; gap: 12px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft); flex-wrap: wrap; }
.pg-bar select { border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: 4px 8px; background: var(--vp-c-bg); color: var(--vp-c-text-1); }
.pg-status { font-size: 13px; color: var(--vp-c-green-1); font-weight: 600; }
.pg-status.bad { color: var(--vp-c-danger-1); }
.pg-dim { color: var(--vp-c-text-2); font-weight: 400; }
.pg-main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); height: 640px; }
.pg-editor { display: flex; border-right: 1px solid var(--vp-c-divider); background: #0f0f14; min-width: 0; }
.pg-gutter { margin: 0; padding: 12px 8px; color: #555; font: 13px/20px var(--vp-font-family-mono); text-align: right; user-select: none; overflow: hidden; min-width: 40px; background: #0b0b0f; }
.pg-gutter span { display: block; }
.pg-gutter span.err { color: #f87171; font-weight: 700; }
.pg-editor textarea { flex: 1; resize: none; border: 0; outline: none; padding: 12px; background: transparent; color: #e5e7eb; font: 13px/20px var(--vp-font-family-mono); white-space: pre; overflow: auto; tab-size: 2; }
.pg-out { display: flex; flex-direction: column; min-width: 0; }
.pg-tabs { display: flex; border-bottom: 1px solid var(--vp-c-divider); overflow-x: auto; }
.pg-tabs button, .pg-roles button { padding: 8px 12px; font-size: 13px; color: var(--vp-c-text-2); border-bottom: 2px solid transparent; white-space: nowrap; }
.pg-tabs button.on, .pg-roles button.on { color: var(--vp-c-brand-1); border-bottom-color: var(--vp-c-brand-1); font-weight: 600; }
.pg-preview { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.pg-url { font: 12px var(--vp-font-family-mono); padding: 4px 10px; color: var(--vp-c-text-2); background: var(--vp-c-bg-soft); border-bottom: 1px solid var(--vp-c-divider); }
.pg-preview iframe { flex: 1; width: 100%; border: 0; background: #fff; }
.pg-panel { flex: 1; overflow: auto; padding: 12px 14px; font-size: 14px; }
.pg-panel pre { white-space: pre-wrap; font-size: 12px; background: var(--vp-c-bg-soft); padding: 10px; border-radius: 8px; overflow: auto; }
.pg-code { white-space: pre !important; }
.pg-md { font-family: var(--vp-font-family-base) !important; font-size: 13px !important; }
.pg-ok { color: var(--vp-c-green-1); font-weight: 600; }
.pg-bad { color: var(--vp-c-danger-1); font-weight: 600; }
.pg-diag { display: block; width: 100%; text-align: left; border-left: 3px solid var(--vp-c-danger-1); background: var(--vp-c-bg-soft); border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; }
.pg-diag.warning { border-left-color: var(--vp-c-warning-1); }
.pg-diag.hint { border-left-color: var(--vp-c-brand-1); }
.pg-diag-head { display: flex; justify-content: space-between; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: var(--vp-c-text-2); }
.pg-hint { margin-top: 4px; color: var(--vp-c-text-2); }
.pg-test { padding: 3px 0; }
.pg-test span { color: var(--vp-c-green-1); font-weight: 700; }
.pg-test.fail span { color: var(--vp-c-danger-1); }
.pg-test em { font-size: 11px; color: var(--vp-c-text-3); margin-left: 6px; }
.pg-btn { margin-top: 10px; border: 1px solid var(--vp-c-divider); padding: 4px 12px; border-radius: 8px; }
.pg-roles { display: flex; flex-wrap: wrap; margin-bottom: 8px; border-bottom: 1px solid var(--vp-c-divider); }
@media (max-width: 860px) { .pg-main { grid-template-columns: 1fr; height: auto; } .pg-editor { height: 380px; border-right: 0; border-bottom: 1px solid var(--vp-c-divider); } .pg-out { height: 520px; } }
</style>
