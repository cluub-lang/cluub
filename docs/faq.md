# FAQ

Straight answers to the questions people ask most about Cluub 0.1, including what it can't do yet. Where an answer depends on how the code behaves today, it was checked against the source and by running real projects.

## Getting started

### What is Cluub, in one sentence?

A small, structured programming language that **clubs together** the frontend, the backend and AI: you write `.clb` files, and Cluub builds the web pages, the API server, the AI calls and the tests, with zero dependencies.

### Is Cluub a library, a framework or a language?

**A language with a built-in framework.**

* A **library** is code *you* call (like Lodash or the OpenAI SDK). Cluub is not that: you don't import it into another program.
* A **framework** calls *your* code and decides the structure (like Angular or Next.js). Cluub does this: it decides the folder layout and the layers, wires dependencies and runs your pages and routes.
* A **language** has its own syntax and compiler. Cluub has both: `.clb` files are parsed, checked and compiled to plain JavaScript.

So it's closest to Elm or Svelte: a language whose compiler and runtime act as the framework.

### How do I install it?

With Node.js 18 or newer, like Vite or Angular:

```bash
npm create cluub@latest my-app
cd my-app
npm install
npm run dev
```

Or install the command globally and use `cluub new my-app`. See [Install & first app](/guide/install).

### Why the name Cluub?

Because it *clubs* frontend, backend and AI into one language. The logo hides the double **u** inside a cat: its happy closed eyes are the *uu* of cluub. See [Brand & logo](/brand).

### Where is the source code, and is it open source?

Cluub is MIT-licensed open source. The code lives at [github.com/cluub-lang/cluub](https://github.com/cluub-lang/cluub) and is published to npm as `cluub` and `create-cluub`.

## The language

### Why a new language instead of TypeScript and React?

A web feature in the usual stack spans a framework, a router, a state library, an HTTP server, a validation library, a test runner and an AI SDK, each with its own conventions. Cluub replaces that wiring with one small language whose compiler **enforces** one structure. That gives three things a library can't guarantee:

* every project has the same folders and the same layer rules (errors E301, E201), so any developer or AI finds anything immediately,
* validation, error display, dependency wiring and awaiting happen automatically,
* the compiler knows the whole app, so it can generate tests and plain-English overviews from it.

The cost is a smaller ecosystem and a young toolchain. If you need the npm ecosystem, an existing React codebase or fine-grained control over rendering, stay with TypeScript and React. See [Why Cluub](/guide/introduction).

### Who is Cluub for?

Small full-stack apps, internal tools, prototypes and AI-backed features, built by mixed teams where product owners, BAs and QAs read the code too. It isn't aimed yet at large public sites with heavy traffic, complex auth or big data.

### Why does Cluub use words like `is` and `and` instead of `==` and `&&`?

So code reads like a sentence, works with voice dictation and can be reviewed by non-developers. Writing `==`, `!=`, `&&`, `||` or `!` is error **E006**, with a hint that names the word to use instead.

### Why is indentation an error instead of a style choice?

Blocks are defined by indentation, so a misaligned line changes the program's meaning. Rejecting tabs (E001) and anything other than 2-space steps (E002, E003) makes every file look identical, and the compiler never has to guess.

### Why is something that works in other languages an error here?

Most Cluub errors protect an architectural rule rather than syntax. Every code comes with a hint, and `cluub errors CODE` explains it:

| Error | The rule it protects |
|---|---|
| E201 | the UI talks to data only through an api; apis only call services |
| E106 | every dependency is declared with `uses` (so tests can swap it) |
| E204 / E205 | AI and secrets never reach the browser |
| E301 | everyone can find every file |
| E102 / E103 | one naming style everywhere |
| E112 | inputs are bound to page state, so the value isn't lost |
| E401 | keys never end up in source control |
| E117 | views only show data: no api calls or actions while drawing |

Warnings (W…) and suggestions never block a build. See [Error codes](/reference/errors).

### Can I write a component with its own state?

No. Components are stateless by design (`takes` only, no `state`, no `uses`), and pages own the data. A component reports events back through an `action` property, as in `takes onRemove: action`. This keeps components reusable and easy to test. See [Pages & components](/guide/frontend).

## Ecosystem and integration

### Can I use npm packages?

No. Cluub has no `import` statement, and a project has no `package.json`. The toolchain and the generated code have zero dependencies. To use outside functionality, call it over HTTP with a [`client`](/reference/client) from a service, or run it as a separate service your Cluub app calls.

### Does it support databases?

Not yet. Stores are in memory or saved to a JSON file (`saved in "storage/x.json"`). File stores keep all records in memory and rewrite the file on every write, which is fine for small apps and prototypes but not for high write volume or several server processes. Postgres and SQLite stores with generated migrations are on the [roadmap](/reference/roadmap). Services only talk to the store interface (`all`, `get`, `add`, ...), so changing the store later shouldn't touch service code.

### Does it support authentication?

No. There are no sessions, logins, roles or cookie access in 0.1, so every api route is public. Put authentication in front of the app with a reverse proxy or an SSO gateway. See [Security](/guide/security#no-authentication-sessions-or-roles). Auth (`page Admin at "/admin" for role "admin"`) is on the roadmap.

### File uploads, websockets, streaming AI replies?

Not supported yet. Request bodies are JSON only, up to 1,000,000 bytes, sent with `Content-Type: application/json`.

### Can I call my existing REST API?

Yes, with a `client` in `network/`:

```cluub
client Weather at "https://api.open-meteo.com/v1"
  header "User-Agent" "my-app"
  get forecast at "/forecast" with latitude: number, longitude: number
```

A service then `uses Weather` and calls `Weather.forecast(52.5, 13.4)`. Calls time out after 15 seconds and fail with a clear `502` message. In tests, client calls return `nothing` (no network).

### Can I deploy the frontend and backend separately?

Not in 0.1. `cluub start` (or `node dist/start.mjs`) serves both from one Node process, and the server doesn't send CORS headers. Separate static and serverless targets are on the roadmap. See [Deployment](/guide/deployment).

## AI

### Does Cluub provide an AI key, or charge for AI?

No. Cluub is **bring-your-own-key**: it never ships a key, never routes your requests through a Cluub server, and never charges for AI. Calls go directly from your server to the provider using a key that you, or your users, own. Add yours with `cluub ai set claude` (or `openai` / `gemini`), or use a local Ollama model with no key at all. See [Your own AI keys](/guide/ai-keys).

### Can the users of my app bring their own AI keys?

Yes. Set `aiKeys "user"` in `app.clb` and put the built-in `aikey` element on a page. Each user pastes their own key; it stays in their browser and is sent only with their requests, where the server uses it for that request and never stores or logs it. `aiKeys "either"` uses the user's key when they added one and yours otherwise. See [Your own AI keys](/guide/ai-keys#end-user-keys-aikeys-user-and-the-aikey-element).

### Where are my keys stored, and can they leak into git?

On your machine, in the project's `.env` file. `cluub ai set` writes it with permissions only you can read and adds `.env` to `.gitignore`. In production, set keys as real environment variables in your hosting provider; they take priority over `.env`. A key typed directly into a `.clb` file is compile error E401.

### How do AI keys stay safe?

On three levels:

1. **Compile time:** `ask ai` outside services, apis and clients is error E204, `env.X` in the UI is E205, and a key-like string in code is E401.
2. **Build output:** the browser bundle contains no service code, no `env` reads and no AI calls. The browser can only reach your api routes.
3. **Runtime:** keys are read from `.env` or the environment on the server and sent only in request headers to the provider. In production, AI errors reach the browser only as a generic message; details stay in the server log.

`cluub make` sends your `.clb` files (not `.env`) to the AI provider you choose.

### Which AI providers work? Can I use a local model?

Claude (`ANTHROPIC_API_KEY`), OpenAI (`OPENAI_API_KEY`), Gemini (`GEMINI_API_KEY`) and Ollama (local, no key). Set the default with `ai "ollama"` in `app.clb`, or per call with `using "ollama:llama3.2"`. `CLUUB_AI` in the environment or `.env` overrides the `ai` line, so each environment can pick its own provider. All four providers are implemented and tested offline with the fake AI, but live calls haven't been tested end to end for every provider. See [AI](/guide/ai).

### Do tests cost money or need a network connection?

No. Tests use a fake AI: a predictable text reply, a valid sample for `as Model`, the first option for `as one of`. They never make network calls. A full template test run takes about 10 ms.

### Is AI-written code (`cluub make`) safe to merge?

It's compiled before anything is written. Files are only written if the whole project compiles, and the AI gets up to three tries to fix compile errors. Compiling proves structure and names, not intent, so review the diff and run `cluub test` as you would for a human change.

## Working with Cluub

### How do I debug?

* **Compile problems:** `cluub check` or the `cluub dev` terminal. Each message has a file, a line, a caret and a hint.
* **Backend values:** `log value` in a service prints `[log] ...` in the server terminal.
* **Frontend values:** `log value` in a page action prints to the browser console.
* **Server errors:** the server terminal always prints the full error. `cluub dev` also shows it in the toast and prints stack lines.
* **Generated code:** read `dist/server.js` and `dist/public/_cluub/app.client.js`. They're readable JavaScript. Errors point there, not to `.clb` lines (source maps are planned).
* **CLI failures:** `CLUUB_DEBUG=1 cluub build` prints the stack trace.

There is no step debugger integration yet.

### Is there editor support?

Syntax highlighting through the TextMate grammar in `editors/cluub.tmLanguage.json`. A language server with inline errors and completion is the first item on the roadmap. Until it lands, keep `cluub dev` running: it re-checks on every save.

### Can I eject to plain JavaScript?

There is no eject command, but `dist/` is already standalone: it contains your compiled app plus a copy of the runtime, and `node dist/start.mjs` runs it with plain Node.js, without the Cluub toolchain. All of it is readable JavaScript with no dependencies (MIT licensed, about 1,000 lines of runtime). You could keep developing that output by hand, but you'd lose the compiler's checks, generated tests and `explain`, and the generated code isn't designed to be edited.

### How fast is it?

On an Apple M3: the `app` template compiles in about 0.5 ms, `cluub test` takes 88 ms including Node startup, and one server handled 8,000–10,000 small api reads per second with an idle memory use of 64 MB. Read [Performance](/guide/performance) for the methods and the caveats.

### Does it work on Windows?

The CLI uses Node's cross-platform `path` handling and `fs.watch` with recursive mode, which Windows supports. We haven't tested 0.1 on Windows. On Linux, `cluub dev` needs Node 20 or newer for recursive file watching.

### How do I add CSS?

Put a `theme.css` in the project root. It's linked after the built-in theme, so you can override variables such as `--primary`, `--radius` and `--font`, or define classes and use them with `class "my-class"`. Images and other files go in `assets/` and are served from `/assets/`.

### Can I have more than one app per server?

No. One project builds one app with one `app` declaration (a second one is error E101).

## Status

### Is Cluub production ready?

No. It's a **beta (0.1.0-beta.1)**. The compiler, runtime and CLI work end to end, and the templates pass their tests, but:

* there's no auth, no database and no rate limiting,
* runtime errors point to generated JavaScript,
* type checking is partial (values are checked at runtime boundaries),
* the server has no automatic restart, compression or HTTPS. Run it behind a proxy and a process manager ([Deployment](/guide/deployment)).

Use it for prototypes, internal tools and learning. If you deploy, follow the checklist in [Security](/guide/security#checklist-before-going-live).

### Is it on npm?

The packages are ready to publish as **`cluub`** (the compiler and command) and **`create-cluub`** (for `npm create cluub@latest`). Until they're published, install from the source folder with `npm link` ([Install](/guide/install)).

### Where is the documentation hosted?

At **[cluub-lang.github.io](https://cluub-lang.github.io/)**, published free by GitHub Pages and rebuilt automatically on every change to the code. The site is plain static files built with VitePress, so you can also host a copy anywhere (see [Contributing](/contributing#publishing-the-docs-site)). See [Contributing](/contributing#publishing-the-docs-site).

### How do I report a bug or contribute?

See [Contributing](/contributing). The compiler and runtime are dependency-free JavaScript, and `node tests/run.js` checks templates, examples and every code sample in the docs.

## See also

* [Why Cluub](/guide/introduction)
* [Troubleshooting](/guide/troubleshooting)
* [Glossary](/glossary)
* [Status & roadmap](/reference/roadmap)
