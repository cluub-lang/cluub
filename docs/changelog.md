# Changelog

All notable changes to Cluub are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Cluub uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Before 1.0, minor versions may contain breaking changes to the language. Breaking changes will always be listed under **Changed** with a migration note.

## [Unreleased]

### Fixed
- Docs: all text now meets WCAG AA contrast (4.5 : 1) in light and dark mode. Diagrams keep a light background in dark mode, code uses GitHub's higher-contrast themes, and the playground's line numbers and labels are easier to read.

## [0.1.0-beta.1] - 2026-11-24

First public beta.

### Changed
- The language is now called **Cluub** (it *clubs* frontend, backend and AI). Files use the `.clb` extension, the command is `cluub`, and the npm packages are `@cluub-lang/cluub` (the compiler and the `cluub` command) and `create-cluub`, both published to npm. Environment variables use the `CLUUB_` prefix (for example `CLUUB_AI`).
- New logo: the **uu** of cluub are a cat's happy closed eyes. Brand colours stay Okabe–Ito (colour-blind safe), and every meaningful part of the logo has at least 3 : 1 contrast; the default app theme now uses the Cluub blue `#0072B2` (`#56B4E9` in dark mode).

### Added
- Claude Code skills: 11 app skills (feature, backend, frontend, naming, tests, code review, PR review, fix issue, security, accessibility, debug) copied into every new project with a `CLAUDE.md`, plus 6 skills and a `CLAUDE.md` for contributors. See [Claude skills](/guide/ai-assistants).
- Community files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue and pull request templates, `CODEOWNERS`, Dependabot and `.editorconfig`.
- `npm create cluub@latest` (also pnpm, yarn and bun `create`) via the new `create-cluub` package. New projects get a `package.json` with `dev`, `test`, `check`, `build` and `start` scripts.
- Bring-your-own-key AI: the `cluub ai` command (`set`, `use`, `test`, `remove`, status) manages developer keys in `.env` (mode 600, git-ignored).
- End-user keys: the `aiKeys` app setting (`"server"`, `"user"`, `"either"`), the built-in `aikey` view element and the `hasAiKey()` built-in. End-user keys stay in the browser, travel in `X-Cluub-AI-Provider` / `X-Cluub-AI-Key` headers, are scoped to one request with `AsyncLocalStorage`, and are never stored or logged.
- New error response `401 ai_key_required` when a feature needs the end user's key.
- Docs: [Your own AI keys](/guide/ai-keys), [Brand & logo](/brand), a larger FAQ and publishing instructions.
- The project lives at [github.com/cluub-lang/cluub](https://github.com/cluub-lang/cluub) and the docs are published by GitHub Pages at [cluub-lang.github.io](https://cluub-lang.github.io/) on every push to `main`.

## [Unreleased]

Planned work is tracked on the [roadmap](/reference/roadmap): a language server and VS Code extension, full static types, database stores, auth, AI agents and streaming, a native compiler, `cluub fmt` and more deploy targets.

## [0.1.0] - 2026-11-23

The first public prototype. The compiler, runtime and CLI work end to end with zero dependencies.

### Added

#### Language

- Ten declaration kinds: `app`, `model`, `store`, `client`, `service`, `api`, `page`, `component`, `layout` and `test`.
- Indentation-based blocks with exactly 2 spaces per level. Tabs are rejected (E001–E003).
- Word operators: `is`, `is not`, `and`, `or`, `not`, `has`, `is empty`, `is one of`, `is greater than`, `is at least`, `plus`, `minus`, `times`, `divided by` and more. Symbol operators such as `==` and `&&` are errors that hint at the right word (E006).
- Text interpolation with `{expr}`, multi-line `"""triple-quoted"""` text, lists, objects, `nothing`, `yes`/`no`, and numbers with `_` separators.
- Statements: `let`, assignment, `return`, `require`, `fail … status`, `if / else if / else`, `for`, `while`, `try … catch`, `log` and `go to`.
- List and text helpers: `.count`, `.first`, `.last`, `.where()`, `.map()`, `.sortBy()`, `.contains()`, `.add()`, `.upper()`, `.lower()`, `.trim()`.
- Built-ins: `now()`, `today()`, `round()`, `text()`, `number()`, `uuid()`, `json()`, `random()`, `sleep()`, `env` (backend only) and `screen` (tests only).
- Types: `text`, `number`, `bool`, `email`, `url`, `date`, `id`, `any`, `list of T`, model names and optional `T?`.

#### Data and backend

- Models with the rules `required`, `min`, `max` and `one of`, custom messages, defaults, and precise validation messages. Unknown fields are rejected.
- Stores in memory or saved to a JSON file (`saved in`), with `all`, `find`, `get`, `add`, `update`, `remove`, `where`, `count` and `clear`. File writes are atomic (temporary file, then rename).
- Clients for outside HTTP APIs: base URL, headers, typed routes and a 15-second timeout.
- Services with actions, `require` guards and dependency injection through `uses`.
- Apis with `get`, `post`, `put`, `patch` and `delete` routes, path, query and body parameters, and automatic type validation (400 with the field name). Statuses are mapped automatically: 400, 404, 405, 413, 502 and 500.
- A Node HTTP server with static file serving and a single-page-app fallback. Its security defaults are listed under **Security** below.
- File stores load when the server starts, so a broken data file stops startup with a clear message.

#### Frontend

- Pages with paths and path parameters, `title`, `layout`, `state`, `when loaded`, actions and views.
- Stateless components with `takes` and `action` properties, and layouts with `slot`.
- View elements: `heading`, `subheading`, `text`, `label`, `badge`, `item`, `button`, `link`, `image`, `input` (including `multiline`), `checkbox`, `select`, `row`, `column`, `card`, `box`, `grid`, `list`, `header`, `footer`, `nav`, `section`, `form`, `divider` and `spinner`, plus `for` and `if / else` in views.
- Properties `placeholder`, `type`, `disabled`, `style`, `class`, `alt`, `options`, `multiline`, `to` and `label` (sets `aria-label`). Events `click`, `change`, `input`, `enter`, `submit`, `blur` and `focus`, plus multi-line event blocks.
- A virtual DOM runtime with reactive page state, a client-side router, a typed api client that pages call by name, automatic awaiting, and error toasts (`role="alert"`).
- Text always rendered as text nodes, and `javascript:` URLs replaced in `href` and `src`.
- Accessibility: inputs and selects without a `label` use their placeholder as `aria-label`; `spinner` is `role="status"` ("Loading"); the crash message is `role="alert"`; focus moves to the page's `<main>` after client-side navigation; the `lang` app setting sets `<html lang>`; form-control borders use `--control-border` with at least 3:1 contrast. The `app` template labels its checkbox, delete button and priority select.
- A built-in responsive theme with light and dark mode, customizable through `theme.css`. Files in `assets/` are served from `/assets/`.

#### Architecture and diagnostics

- Enforced folder layout (E301), layer rules page → api → service → store/client (E201–E203), backend-only AI and `env` (E204, E205), and hard-coded secret detection (E401).
- Naming rules: PascalCase declarations (E102) and camelCase members (E103).
- Name resolution with "Did you mean …?" hints (E104–E116), and suggestions that teach design: unused dependency (W101), oversized action (W102) or service (W103), missing `about` (W104), unused state (W105), a page without a view (W106), a layout without exactly one `slot` (W107) and an unknown app setting (W108).
- E117: a view that calls an api, an action, a component callback or `sleep()` while drawing.
- The app name must be PascalCase. Models and services may be named `R`, `B`, `T` or `h` without clashing with generated code.
- Elm-style error output with a code frame, a caret and a hint. Parsing recovers per declaration, so one mistake doesn't hide the rest.

#### AI

- `ask ai` with structured output (`as Model`, `as list of Model`, validated, with one retry), classification (`as one of [...]`), `using "provider:model"` and `with system`.
- Providers: Claude, OpenAI, Gemini and Ollama, configured through `app.clb`, `CLUUB_AI`, `CLUUB_<PROVIDER>_MODEL` and `OLLAMA_HOST`. Live provider calls haven't been tested end to end for every provider.
- `cluub make`: AI writes or changes code, the compiler checks it, errors are fed back up to three times, and files are written only when the project compiles.

#### Testing

- A headless test runner: each test gets fresh in-memory stores, a fake AI and no network. Commands: `expect`, `expect … fails with`, `render`, `type … into`, `click`, `screen`, `request` and `go to`.
- Automatic test generation for model rules, `require` guards, service actions, api validation, page rendering and button clicks, written to `tests/generated/` as readable Cluub.

#### Tooling

- CLI commands: `new` (templates `app`, `ai-chat`, `blank`), `dev` (with live reload), `check`, `test`, `build`, `start`, `explain --for po|ba|qa|dev`, `make`, `errors`, `version` and `help`.
- A standalone build: `dist/` contains a copy of the runtime, and `node dist/start.mjs` runs the app with plain Node.js. The port comes from `--port` (for `cluub start`), then `PORT`, then the app's `port`, then 3000.
- `cluub explain` overviews for product owners, business analysts, QA and developers, generated from the code.
- A TextMate grammar for syntax highlighting (`editors/cluub.tmLanguage.json`).
- A VitePress documentation site with a live in-browser playground.
- A repository self-test (`node tests/run.js`) that compiles and tests the templates and playground examples, compiles every ```` ```cluub ```` sample in the docs, and runs the regression cases in `tests/regressions.js`.

### Security

- Api request bodies must be sent with `Content-Type: application/json` (otherwise `415`), which blocks cross-site request forgery through simple form or `text/plain` requests.
- Bodies are read as bytes: the 1 MB limit counts bytes (`413` above it), and multi-byte UTF-8 text is never split.
- Malformed percent-encoding in a URL returns `400 bad_url` instead of crashing the server.
- Every response sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` and `X-Frame-Options: DENY`. HTML pages send a strict Content-Security-Policy with no inline script; the boot script is `/_cluub/boot.js`.
- In production, automatic AI and network errors and unexpected errors reach the browser as generic messages. Details go to the server log. Messages written with `fail` are always shown.
- `.env` parsing: real environment variables win over `.env`; `export NAME=` lines and comments after unquoted values are supported.

### Fixed

During documentation review, before release:

- `Store.count()` works.
- `cluub start` uses the app's `port` setting when no `--port` or `PORT` is given.
- Apis declared outside `/api` are served, and route matching prefers static path segments over `{params}`.
- Live reload: each build has an id, and the browser reloads when it reconnects and sees a new one. `.env` changes trigger a rebuild in `cluub dev`.
- `CLUUB_AI` in the environment beats the app's `ai` setting.
- CLI errors outside a project print one clean line; `cluub test --no-generate <filter>` keeps the filter; logs honor `NO_COLOR`.
- The Ollama connection error names `OLLAMA_HOST`; `405` responses list every allowed method; the E301 hint suggests kebab-case file names.
- Generated page tests skip buttons with a `disabled` rule and accept a click that navigates away. Apis can be called by name in tests, and `click` on a submit button triggers its form.

Regression tests for each of these live in `tests/regressions.js`.

### Known limitations

- No authentication or sessions, no rate limiting, no CORS configuration and no HTTPS termination. See [Security](/guide/security#what-is-not-there-yet).
- Return types, page state and component properties aren't type-checked. Values are checked at runtime boundaries (models, apis, stores).
- Runtime errors point to generated JavaScript, not to `.clb` lines.
- File stores keep everything in memory and support one server process per data folder.

## See also

* [Status & roadmap](/reference/roadmap)
* [Contributing](/contributing)
* [FAQ](/faq)
