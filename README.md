<p align="center">
  <img src="docs/public/logo-full.svg" alt="Cluub" height="96">
</p>

<p align="center"><b>One structured language that clubs together frontend, backend and AI.</b><br>
Zero dependencies · bring your own AI key · tests that write themselves</p>

<p align="center"><a href="https://cluub.dev">cluub.dev</a> · <a href="https://cluub.dev/guide/tour">10-minute tour</a> · <a href="https://cluub.dev/playground">Playground</a></p>

---

```cluub
model Todo
  title: text, required, max 80

store Todos holds Todo saved in "storage/todos.json"

service TodoService
  uses Todos
  action add(title: text) -> Todo
    require title.count >= 3, "Title must be at least 3 characters"
    return Todos.add(Todo(title: title))

api TodoApi at "/api/todos"
  uses TodoService
  post add at "/" with title: text
    return TodoService.add(title)

page Home at "/"
  uses TodoApi
  state draft = ""
  action save()
    TodoApi.add(title: draft)
    draft = ""
  view
    heading "My todos"
    input draft, placeholder "What needs doing?", on enter save
    button "Add", on click save, style primary
```

A validated model, a JSON-file database, business rules, a typed REST endpoint and a reactive page. `cluub test` writes and runs the tests for all of it.

## Get started

```bash
npm create cluub@latest my-app
cd my-app
npm install
npm run dev
```

Or install the command globally: `npm install -g cluub`, then `cluub new my-app`. Requires Node.js 18+.

## Bring your own AI key

Cluub never ships, proxies or charges for AI. Use your own key:

```bash
cluub ai set claude     # or openai / gemini; local Ollama needs no key
cluub ai test claude
```

Or let each user of your app bring theirs: set `aiKeys "user"` and add the built-in `aikey` element. The key stays in their browser and is used only for their requests. See [Your own AI keys](https://cluub.dev/guide/ai-keys).

## What's in this repository

| Folder | |
|---|---|
| `compiler/` | lexer, parser, checker (layers, naming, SOLID lints), code generator, test generator, explainer |
| `runtime/` | browser and Node runtime: models, stores, dependency injection, api server, virtual DOM, router, AI providers, test runner |
| `cli/` | the `cluub` command |
| `packages/create-cluub/` | the `npm create cluub` package |
| `templates/` | `app`, `ai-chat`, `blank` starters |
| `docs/` | the [cluub.dev](https://cluub.dev) site (VitePress) with a live playground |
| `editors/` | TextMate grammar for syntax highlighting |
| `LANGUAGE.md` | the complete language reference (also what `cluub make` gives the AI) |
| `tests/` | self-test: templates, examples, every docs sample, regressions (`npm test`) |

## Status

Cluub 0.1 is a working prototype. See [Status & roadmap](https://cluub.dev/reference/roadmap) for what's done and what's next, and [Contributing](https://cluub.dev/contributing) to help.

MIT licensed.
