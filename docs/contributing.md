# Contributing

Cluub is small on purpose. The compiler is about 2,200 lines and the runtime about 1,000, all dependency-free JavaScript that one person can read in an afternoon. This page explains how the pieces fit together, how to run the self-test, and exactly which files to touch for the most common changes.

## Repository layout

| Path | What it holds |
|---|---|
| `compiler/lexer.js` | source text → tokens, including `indent`/`dedent` (E001–E006) |
| `compiler/parser.js` | tokens → AST, hand-written recursive descent. The keyword, view-element and property lists live here (E010–E013) |
| `compiler/checker.js` | name resolution, layers, folders, naming and lints. Annotates the AST for codegen (E1xx, E2xx, E301, E401, W1xx) |
| `compiler/codegen.js` | checked AST → two JavaScript programs: server and client |
| `compiler/testgen.js` | checked AST → Cluub test source for `tests/generated/` |
| `compiler/explain.js` | checked AST → Markdown for `cluub explain` |
| `compiler/diagnostics.js` | `Reporter`, `CluubError`, "did you mean" suggestions, the code-frame formatter and the `CODES` catalogue |
| `compiler/index.js` | public API: `compile(files, opts)`, `formatAll`, `generateTests`, `explain` |
| `runtime/core.js` | browser-safe runtime: helpers, `Model`, `MemoryStore`, clients, the dependency container and the api dispatcher |
| `runtime/client.js` | virtual DOM, router, api client and toasts |
| `runtime/node.js` | Node HTTP server (security headers, JSON-only bodies), `FileStore`, `.env` loader. Copied into `dist/runtime/` so builds run with plain Node |
| `runtime/ai.js` | the AI providers and the fake AI |
| `runtime/testing.js` | the test runner (headless frontend wired to an in-memory backend) |
| `runtime/errors.js`, `runtime/messages.js` | runtime error classes and shared message templates |
| `runtime/theme.css` | the built-in theme |
| `cli/cluub.js` | the `cluub` command |
| `templates/` | `app`, `ai-chat` and `blank` starters (`_gitignore` and `_env.example` are renamed on copy, and `{{AppName}}` is replaced) |
| `editors/cluub.tmLanguage.json` | TextMate grammar, also used for highlighting in these docs |
| `docs/` | this VitePress site and the playground (`docs/.vitepress/theme/`) |
| `LANGUAGE.md` | the complete language reference, also sent to the AI by `cluub make` |
| `tests/run.js` | the repository self-test |
| `tests/regressions.js` | one small case per bug fixed so far, run by `tests/run.js` |

## How the compiler works

```text
 .clb files ──▶ lexer ──▶ parser ──▶ checker ──▶ codegen ──▶ server.js + app.client.js
                                       │            │
                                       │            └──▶ runtime (core / client / node / ai)
                                       ├──▶ testgen ──▶ tests/generated/*.test.clb
                                       └──▶ explain ──▶ Markdown overview
```

1. **Lexer** (`lex`). Turns each file into tokens. At the start of a line it measures indentation, emits `indent`/`dedent`, and throws E001–E003 on tabs or misalignment. Newlines inside `()`, `[]` and `{}` are ignored. Text tokens keep their `{expr}` parts, which are lexed recursively.
2. **Parser** (`parse`). One method per construct (`decl_page`, `statement`, `viewLine`, `expr` → `or` → `and` → `compare` → …). Errors are thrown as `CluubError`. `program()` catches them **per declaration**, records the name in `failed`, and skips to the next top-level keyword, so one typo doesn't hide other errors.
3. **Checker** (`check`). Builds a map of declarations, checks folders (when `enforceFolders` is set) and naming, then walks every declaration with a context (`owner`, `deps`, `states`, `props`, `actions`). It annotates nodes: `Name.ref` (local, state, prop, param, action, model, dep or builtin) and `Call.resolved` (named arguments → positions). It reports through `Reporter`, so all problems are collected.
4. **Codegen** (`generate`). Emits two function bodies that receive the runtime object `R`. The **server program** has models, stores, clients, services, apis and tests. The **client program** has models, the api spec, components, layouts and pages. Calls to dependencies become `await`ed calls, and views become `h(tag, props, children)` calls.
5. **Runtime.** `instantiate(code, R)` runs a program with `new Function`. `createBackend` wires dependencies and dispatches routes, and `createFrontend` renders pages. The same code runs in Node, in the browser and in the playground.
6. **Testgen and explain** read the same checked AST, so they never drift from the code.

`compile()` is pure: it gets a `{ path: source }` object and returns `{ ok, diagnostics, decls, server, client, ms }`. The CLI and `runtime/node.js` are the only places that touch the file system.

## Running the self-test

```bash
node tests/run.js        # or: npm test
```

It runs, in order:

1. **Templates.** Each template compiles with folder rules on, its generated tests compile, and all its tests pass.
2. **Playground examples** (`docs/.vitepress/theme/examples.js`). Each one compiles and passes its tests, except "See an error", which must report exactly E013, E105 and E201.
3. **Docs code samples.** Every ```` ```cluub ```` block in `docs/**/*.md` and `LANGUAGE.md` is compiled on its own (see [Docs conventions](#docs-conventions)).
4. **Tutorial.** Every declaration in `docs/tutorial/*.md`, with later versions replacing earlier ones, must build into one working project whose tests pass.
5. **Reference coverage.** Every declaration keyword has a page `docs/reference/<keyword>.md`, and every view element, property, event, built-in, store method, type and error code appears in its reference page.
6. **Regressions** (`tests/regressions.js`). Small Cluub programs whose own `test` blocks must pass (one per fixed bug), programs that must report a specific diagnostic (`E117`, `W107`, `W108`, ...), and direct checks of runtime pieces such as the `.env` parser and AI provider selection.
7. **Theme.** Every CSS class the runtime emits exists in `theme.css`.

It exits with code 1 if anything fails. Run it before every pull request.

For a quick manual check of a change, create a scratch project **outside** the repository:

```bash
cd /tmp && node /path/to/cluub/cli/cluub.js new demo && cd demo
node /path/to/cluub/cli/cluub.js test
```

## Adding a view element, end to end

Say you want `quote` to render a `<blockquote>`.

| Step | File | Change |
|---|---|---|
| 1 | `compiler/parser.js` | Add `'quote'` to `CONTENT_TAGS` (it takes a value like `text`), `CONTAINER_TAGS` (only children) or `VOID_TAGS` (nothing). This also makes the E013 hint and the "did you mean" suggestion list it |
| 2 | `compiler/codegen.js` | In `element()`, add `quote: 'blockquote'` to the `simple` map. If it needs a default class, add it to `autoClass`. Elements with special behavior (binding, `href`, `src`) get their own branch, like `input` and `link` |
| 3 | `runtime/theme.css` | Style it. If you added an `autoClass`, define that class (the Theme self-test checks the classes it knows about) |
| 4 | `compiler/checker.js` | Usually nothing. Only needed for rules like E112 (inputs must bind to state) |
| 5 | `compiler/testgen.js` | Optional: add the tag to the list in `pageTests` if its text should be checked by "renders" tests |
| 6 | `editors/cluub.tmLanguage.json` | Add it to the view-element pattern so it's highlighted |
| 7 | `docs/reference/view-elements.md` | Document it with `` `quote` `` (the coverage self-test fails without it) |
| 8 | `LANGUAGE.md` | Add it to the "View elements" list |
| 9 | — | `node tests/run.js` |

## Adding a built-in function

Say you want `slug(text)`.

| Step | File | Change |
|---|---|---|
| 1 | `compiler/checker.js` | Add `slug: { fn: true }` to `BUILTINS`. Use `backend: true` for backend-only (like `env`) or `test: true` for tests only (like `screen`) |
| 2 | `runtime/core.js` | Add `slug: (x) => …` to the `B` object. Generated code calls `B.slug(...)`. It must stay browser-safe: no Node imports |
| 3 | `compiler/codegen.js` | Only if it's async: add it next to `sleep` in `call()` so the call is awaited |
| 4 | `editors/cluub.tmLanguage.json` | Add it to the built-in function pattern |
| 5 | `docs/reference/builtins.md` | Document it as `` `slug` `` (coverage self-test) |
| 6 | `LANGUAGE.md` | Add it to the built-ins line in "Expressions" |
| 7 | — | Add a test to a template or a docs sample that uses it, then run `node tests/run.js` |

## Adding a diagnostic code

Say you want a warning W107 for a page with more than 10 state values.

| Step | File | Change |
|---|---|---|
| 1 | `compiler/diagnostics.js` | Add `W107: 'Page has too much state'` to `CODES`. `cluub errors` and `cluub errors W107` pick it up automatically |
| 2 | `compiler/checker.js` | Report it where the information is available, for example in `dPage`: `this.warn('W107', message, hint, d)`. Use `this.err` for errors (they block the build) and `this.info` for suggestions. In the lexer or parser, throw with `this.fail(message, hint, token, 'E0xx')` instead |
| 3 | `docs/reference/errors.md` | Add a row with the code, the problem and the fix (coverage self-test) |
| 4 | `LANGUAGE.md` | Mention it if it enforces a language rule |
| 5 | `docs/.vitepress/theme/examples.js` | Only if you change what the "See an error" example reports |
| 6 | `tests/regressions.js` | Add an entry to `diagnostics`: `'W107: …': ['W107', '<program>']`. The self-test fails if the code isn't reported |
| 7 | — | `node tests/run.js`, and check the message by hand with a tiny project |

**Message style:** the message says what is wrong in plain English and names the thing (`"Mailer" is listed in uses but never used.`). The hint says how to fix it, with code in backticks. Always pass a location (`file`, `line`, `col`, and `length` for the caret).

## Fixing a bug

Add a failing case to `tests/regressions.js` first: a small program with a `test` block that shows the bug (in `programs`), or a program that should or shouldn't report a diagnostic (in `diagnostics`). Fix the code, run `node tests/run.js`, and add a line to the [changelog](/changelog).

## Coding conventions

* **Zero dependencies.** No npm packages in the compiler, the runtime, the CLI or the generated code. Only Node built-ins (`node:fs`, `node:path`, `node:http`, `node:url`), and only in `cli/` and `runtime/node.js`.
* **Browser-safe core.** `compiler/*`, `runtime/core.js`, `client.js`, `ai.js`, `errors.js`, `messages.js` and `testing.js` are imported by the docs playground, so they must not import Node modules.
* **ES modules**, two-space indentation, single quotes, semicolons, and compact functions in the style of the surrounding code.
* **Precise errors over clever code.** Every user-facing failure gets a code or a plain-English runtime message that names the field, value or file.
* **Keep `LANGUAGE.md` complete.** It's the spec and the AI's guide. A feature that isn't documented there doesn't exist for `cluub make`.
* **No hidden magic in generated code.** Output should stay readable: people debug it.

## Docs conventions

* Pages use `# Title`, a short intro, `##` sections, tables where they help, and a **See also** list at the end. Links use VitePress paths without `.md`: `/guide/testing`, `/reference/cli`.
* **Every ```` ```cluub ```` block is compiled by the self-test.** Each block compiles on its own. Unknown-name errors (E101, E104–E109, E116) are tolerated, so a snippet may reference a model it doesn't show. Syntax and structural errors fail the run. Blocks are wrapped automatically when they start with:

| Block starts with | It is wrapped in |
|---|---|
| indentation | `service Wrapper` → `action wrapped()` |
| `action` | `service Wrapper` |
| `button`, `row`, `card`, `heading`, `text`, `input` | the `view` of a page with `state draft = ""` and `state results = []` |
| `let`, `if`, `return`, `expect`, `try`, `require` | an action body |

* An event handler must name a real action (E113 isn't tolerated), so give snippet pages their actions.
* Use ```` ```text ````, ```` ```bash ````, ```` ```ini ```` or ```` ```dockerfile ```` for anything that isn't Cluub, including deliberately wrong code and terminal output.
* Every number in the docs must come from a real run. State the method and the machine.
* Samples that compile standalone get a "Run in playground" button automatically.

## Publishing the npm packages

Cluub ships as two packages, both free on npm at the time of writing:

| Package | Folder | Gives users |
|---|---|---|
| `cluub` | repository root | the `cluub` command, compiler and runtime (`npm install -g cluub`, `npx cluub`) |
| `create-cluub` | `packages/create-cluub/` | `npm create cluub@latest` (also pnpm, yarn and bun `create`) |

Release steps (run by a maintainer with an npm account):

```bash
npm test                                   # the self-test must say "All good"
npm version patch                          # bump cluub (and update packages/create-cluub/package.json to match)
npm publish                                # publishes cluub
cd packages/create-cluub && npm publish    # publishes create-cluub
```

Publish `cluub` first: `create-cluub` depends on it. To try the packages without publishing, run `npm pack` in both folders and install the two `.tgz` files into an empty folder.

## Publishing the docs site

The documentation is published at **https://cluub-lang.github.io/home/** by GitHub Pages, automatically:

1. On every push to `main` in `cluub-lang/cluub`, the **Docs** workflow (`.github/workflows/docs.yml`) builds the site with `DOCS_BASE=/home/`.
2. It pushes the built files to the `cluub-lang/home` repository, using a deploy key that can write to that one repository only (stored as the `DOCS_DEPLOY_KEY` secret in `cluub-lang/cluub`).
3. GitHub Pages serves `cluub-lang/home` at `https://cluub-lang.github.io/home/`.

To build the site yourself:

```bash
cd docs && npm install && npm run build                         # for a host at the root: /
cd docs && npm install && DOCS_BASE=/home/ npm run build        # the same paths as GitHub Pages
```

The output in `docs/.vitepress/dist` is plain static files, so a copy can be hosted anywhere (Netlify and Cloudflare Pages also apply `docs/public/_headers`). After a deploy, check that the home page loads and that `/playground` works on a hard refresh.

## See also

* [Changelog](/changelog)
* [Status & roadmap](/reference/roadmap)
* [Error codes](/reference/errors)
* [Glossary](/glossary)
