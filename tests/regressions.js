// Regression tests: one case per bug found while writing the docs.
// Most cases are small Cluub programs whose own `test` blocks must pass;
// the rest check that the compiler reports (or no longer reports) a diagnostic.
import { compile, formatAll, generateTests } from '../compiler/index.js';
import { parseEnv } from '../runtime/node.js';
import { runTests } from '../runtime/testing.js';
import { createAI } from '../runtime/ai.js';

const MODEL = 'model Item\n  title: text, required\n  qty: number = 1\n\nstore Items holds Item\n';

const programs = {
  'store count() and list .count()': `${MODEL}
service ItemService
  uses Items
  action total() -> number
    Items.add(Item(title: "a"))
    Items.add(Item(title: "b"))
    return Items.count()
  action listCount() -> number
    return [1, 2, 3].count()

test "count works"
  expect ItemService.total() is 2
  expect ItemService.listCount() is 3
`,
  'required fires for number, bool and list': `model Order
  amount: number, required
  paid: bool, required
  tags: list of text, required

test "missing required values fail"
  expect Order(paid: true, tags: ["x"]) fails with "amount is required"
  expect Order(amount: 1, tags: ["x"]) fails with "paid is required"
  expect Order(amount: 1, paid: true, tags: []) fails with "tags is required"
  expect Order(amount: 0, paid: false, tags: ["x"]).amount is 0
`,
  'empty text for an optional number becomes nothing': `model Limit
  max: number?

test "empty becomes nothing"
  expect Limit(max: "").max is nothing
`,
  'component callback given as a call, and state using state': `component Picker
  takes label: text, onPick: action
  view
    button label, on click onPick()

page Home at "/"
  state count = 2
  state doubled = count * 2
  state picked = ""

  action pick(name: text)
    picked = name

  view
    text "Doubled {doubled}"
    Picker label: "Choose A", onPick: pick("A")
    text "Picked {picked}"

test "callback with an argument runs"
  render Home
  expect screen has "Doubled 4"
  click "Choose A"
  expect screen has "Picked A"
`,
  'apis callable by name in tests; static path beats {id}': `${MODEL}
service ItemService
  uses Items
  action all() -> list of Item
    return Items.all()
  action stats() -> text
    return "stats"
  action one(id: text) -> Item
    return Items.get(id)

api ItemApi at "/api/items"
  uses ItemService
  get one at "/{id}"
    return ItemService.one(id)
  get stats at "/stats"
    return ItemService.stats()
  get list at "/"
    return ItemService.all()

test "api facade"
  expect ItemApi.list().count is 0
  expect ItemApi.one("9") fails with "not found"

test "static segment wins"
  let r = request get "/api/items/stats"
  expect r.status is 200
  expect r.body is "stats"

test "405 names every allowed method"
  let r = request delete "/api/items/stats"
  expect r.status is 405
  expect r.body.error.message has "GET"
`,
  'bound input keeps its own on input handler': `page Home at "/"
  state draft = ""
  state typed = 0

  action count()
    typed = typed + 1

  view
    input draft, placeholder "Type here", on input count
    text "Typed {typed}: {draft}"

test "both run"
  render Home
  type "hi" into "Type here"
  expect screen has "Typed 1: hi"
`,
  'nested binding re-renders': `page Home at "/"
  state user = {name: "Ada"}
  view
    input user.name, placeholder "Name"
    text "Hello {user.name}"

test "nested field updates the view"
  render Home
  type "Grace" into "Name"
  expect screen has "Hello Grace"
`,
  'submit button inside a form': `page Home at "/"
  state sent = false
  action send()
    sent = true
  view
    form, on submit send
      button "Send", type "submit"
    if sent
      text "Sent!"

test "click submits"
  render Home
  click "Send"
  expect screen has "Sent!"
`,
  'fake AI sample respects list min': `model Plan
  steps: list of text, min 2

service PlanService
  action make() -> Plan
    return ask ai "plan" as Plan

test "sample is valid"
  expect PlanService.make().steps.count is 2
`,
  'an action named d does not shadow dependencies': `${MODEL}
service ItemService
  uses Items
  action d() -> number
    Items.add(Item(title: "x"))
    return Items.count()

test "works"
  expect ItemService.d() is 1
`,
  'toast text appears once on screen': `page Home at "/"
  action boom()
    fail "Nope"
  view
    button "Go", on click boom

test "one toast"
  render Home
  click "Go"
  expect screen.split("Nope").count is 2
`,
  'declarations named like runtime internals (R, B, T, h)': `model R
  name: text, required

model B
  x: number = 1

store Rs holds R

service T
  uses Rs
  action add() -> R
    require 1 is 1, "never"
    return Rs.add(R(name: "ok"))

test "works"
  expect T.add().name is "ok"
  expect B().x is 1
`,
  'aikey element: end user adds and forgets a key': `page Home at "/"
  view
    heading "Settings"
    if hasAiKey()
      text "Key ready"
    aikey

test "add and forget"
  render Home
  type "sk-test-abcd1234" into "Paste your API key"
  click "Save key"
  expect screen has "Key ready"
  expect screen has "ending 1234"
  click "Forget my key"
  expect screen has "Paste your API key"
`,
  'property words usable as state names': `page Home at "/"
  state style = "bold"
  state type = "a"
  view
    select style, options ["bold", "thin"]
    text type

test "renders"
  render Home
  expect screen has "a"
`,
  'list helpers take, skip, reversed': `service ListService
  action page() -> list of number
    return [1, 2, 3, 4, 5].skip(1).take(2)
  action desc() -> list of number
    return [3, 1, 2].sortBy(x => x).reversed()

test "helpers"
  expect ListService.page() is [2, 3]
  expect ListService.desc() is [3, 2, 1]
`,
  'fake AI as list of Model returns a sample item': `model Tag
  name: text, required

service TagService
  action tags() -> list of Tag
    return ask ai "tags" as list of Tag

test "one sample"
  expect TagService.tags().count is 1
`,
  'generated button test survives navigation': `page Home at "/"
  action next()
    go to "/other"
  view
    heading "Home"
    button "Next", on click next

page Other at "/other"
  view
    heading "Other page"
`,
};

// Programs whose compile result must contain exactly these error/warning codes.
const diagnostics = {
  'E117: api call inside a view': ['E117', `model T
  t: text
store Ts holds T
service S
  uses Ts
  action all() -> list of T
    return Ts.all()
api A at "/api/a"
  uses S
  get list at "/"
    return S.all()
page Home at "/"
  uses A
  view
    text "{A.list()}"
`],
  'E117: sleep inside a view': ['E117', 'page Home at "/"\n  view\n    text "{sleep(5)}"\n'],
  'E117: component calls its callback while drawing': ['E117', 'component Card\n  takes onPick: action\n  view\n    text "{onPick()}"\n'],
  'E203: uses inside a component': ['E203', 'component Card\n  uses Something\n  view\n    text "x"\n'],
  'W107: layout without slot': ['W107', 'layout Main\n  view\n    header\n      text "x"\n'],
  'W108: unknown app setting': ['W108', 'app Shop\n  prot 3000\n'],
  'E301 hint uses kebab-case file names': ['E301', 'service OrderHistory\n  action a() -> text\n    return "x"\n', 'services/order-history.clb'],
  'E102: app name must be PascalCase': ['E102', 'app my_shop\n'],
  'E115: two routes with the same method and path': ['E115', `service S
  action a() -> text
    return "a"
api A at "/api/a"
  uses S
  get one at "/"
    return S.a()
  get two at "/"
    return S.a()
`],
};

export async function runRegressions(ok, bad) {
  for (const [name, src] of Object.entries(programs)) {
    let r = compile({ 'main.clb': src });
    if (!r.ok) { bad(name, formatAll(r.diagnostics.filter((d) => d.severity === 'error'), r.sources)); continue; }
    r = compile({ 'main.clb': src, ...generateTests(r.decls) });
    if (!r.ok) { bad(name, formatAll(r.diagnostics.filter((d) => d.severity === 'error'), r.sources)); continue; }
    const res = await runTests({ serverCode: r.server, clientCode: r.client });
    if (res.failed || !res.passed) bad(name, res.results.filter((x) => !x.ok).map((x) => `${x.name}: ${x.error.message}`).join('\n') || 'no tests ran');
    else ok(`${name} (${res.passed} tests)`);
  }
  for (const [name, [code, src, hintHas]] of Object.entries(diagnostics)) {
    const r = compile({ 'main.clb': src }, { enforceFolders: !!hintHas });
    if (r.diagnostics.some((d) => d.code === code && (!hintHas || d.hint.includes(hintHas)))) ok(name);
    else bad(name, `expected ${code}, got: ${r.diagnostics.map((d) => d.code).join(', ') || 'nothing'}`);
  }
  // Expect inside try/catch must still fail the test.
  {
    const r = compile({ 'main.clb': 'test "swallowed?"\n  try\n    expect 1 is 2\n  catch problem\n    log problem.message\n' });
    const res = await runTests({ serverCode: r.server, clientCode: r.client });
    res.failed === 1 ? ok('a failed expect inside try still fails the test') : bad('a failed expect inside try still fails the test', 'the test passed');
  }
  // Production hides automatic AI/network details but keeps messages written with `fail`.
  {
    const { errorResponse, Fail, AIError } = await import('../runtime/core.js');
    const a = errorResponse(new Fail('Service paused for maintenance', 503), 'x', false);
    const b = errorResponse(new AIError('openai returned 401: key sk-... invalid'), 'x', false);
    (a.body.error.message === 'Service paused for maintenance' && !b.body.error.message.includes('401'))
      ? ok('production keeps fail messages, hides AI details') : bad('production keeps fail messages, hides AI details', JSON.stringify([a.body, b.body]));
  }
  // Bring your own key: the end user's key from request headers is used for their request only.
  {
    const { createBackendR, instantiate, createBackend, ctxFromHeaders } = await import('../runtime/core.js');
    const src = 'app Byok\n  aiKeys "user"\n\nservice AskService\n  action ask(q: text) -> text\n    return ask ai q\n\napi AskApi at "/api/ask"\n  uses AskService\n  post ask at "/" with q: text\n    return AskService.ask(q)\n';
    const r = compile({ 'main.clb': src });
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, headers: init.headers }); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'hi from claude' }] }), { status: 200 }); };
    const settings = {};
    const R = createBackendR({ env: { ANTHROPIC_API_KEY: 'server-key-should-not-be-used' }, settings, fetchImpl });
    const prog = instantiate(r.server, R); Object.assign(settings, prog.app.settings);
    const be = createBackend(prog, R, { dev: false });
    const none = await be.dispatch('POST', '/api/ask', { q: 'x' }, ctxFromHeaders({}));
    const withKey = await be.dispatch('POST', '/api/ask', { q: 'x' }, ctxFromHeaders({ 'x-cluub-ai-provider': 'claude', 'x-cluub-ai-key': 'user-key-123' }));
    const good = none.status === 401 && none.body.error.code === 'ai_key_required' && withKey.status === 200 && withKey.body === 'hi from claude'
      && calls.length === 1 && calls[0].headers['x-api-key'] === 'user-key-123';
    good ? ok('aiKeys "user": requires the end user key and uses only it') : bad('aiKeys "user": requires the end user key and uses only it', JSON.stringify({ none, withKey, calls }));
    settings.aiKeys = 'either';
    calls.length = 0;
    await be.dispatch('POST', '/api/ask', { q: 'x' }, ctxFromHeaders({}));
    calls[0]?.headers['x-api-key'] === 'server-key-should-not-be-used' ? ok('aiKeys "either": falls back to the server key') : bad('aiKeys "either": falls back to the server key', JSON.stringify(calls));
  }
  // .env parsing: export lines, inline comments, quotes; CLUUB_AI in the environment beats app.clb.
  {
    const env = parseEnv('export A=1\nB=two # note\nC="x # not a comment"\n# D=4\n');
    const good = env.A === '1' && env.B === 'two' && env.C === 'x # not a comment' && !('D' in env);
    good ? ok('.env parsing') : bad('.env parsing', JSON.stringify(env));
    let seen = null;
    const ai = createAI({ env: { CLUUB_AI: 'ollama' }, settings: { ai: 'claude' }, fetchImpl: async (url) => { seen = url; throw new Error('down'); } });
    try { await ai.ask('hi', {}); } catch { /* expected */ }
    String(seen).includes('11434') ? ok('CLUUB_AI in the environment overrides app.clb') : bad('CLUUB_AI in the environment overrides app.clb', `called ${seen}`);
  }
  // AI provider specs keep everything after the first colon, and the Ollama error names OLLAMA_HOST.
  {
    let seen = null;
    const ai = createAI({ env: { OLLAMA_HOST: 'http://gpu-box:11434' }, fetchImpl: async (url, init) => { seen = { url, body: JSON.parse(init.body) }; throw new Error('down'); } });
    try { await ai.ask('hi', { using: 'ollama:llama3.2:3b' }); } catch (e) {
      const good = seen?.body.model === 'llama3.2:3b' && e.message.includes('http://gpu-box:11434');
      good ? ok('ollama model with a tag and custom host message') : bad('ollama model with a tag and custom host message', `model=${seen?.body.model} message=${e.message}`);
    }
  }
}
