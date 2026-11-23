# Status & roadmap

Cluub 0.1 is a **working prototype**. Here is exactly what exists today and what comes next.

## Working today

| Area | Status |
|---|---|
| Lexer, parser, checker, code generator, runtime and CLI (zero dependencies, ~3,300 lines) | ✅ |
| Models with validation, stores (memory + JSON file), clients | ✅ |
| Services, typed and validated APIs, dependency injection | ✅ |
| Pages, components, layouts, reactive state, routing, toasts | ✅ |
| Enforced folder structure, layer rules, naming rules | ✅ |
| `ask ai`, `as Model`, `as one of`; Claude, OpenAI, Gemini, Ollama | ✅ (verified offline with the fake AI; live provider calls not yet tested end to end) |
| Generated tests for models, services, apis, pages and buttons | ✅ |
| Headless full-stack UI tests | ✅ |
| `cluub explain` for PO / BA / QA / dev | ✅ |
| `cluub make` (AI writes code, compiler-checked repair loop) | ✅ (built; needs an AI key to run) |
| CLI: new, dev (live reload), check, test, build, start, errors | ✅ |
| Docs with playground | ✅ |

## Known limits

* **Type checking is partial.** Names, dependencies, fields in model construction, call arguments and layers are checked at compile time; values are checked at runtime boundaries (models, apis). Full type inference is next.
* **Runtime errors point to generated JavaScript**, not to the `.clb` line. Source maps are planned.
* Stores are memory or JSON files: fine for prototypes and small apps, not for high write volume.
* Components are stateless by design; page state covers most needs.
* No auth, sessions, file uploads or websockets yet.

## Next

1. **Language server + VS Code extension**: inline errors, the same suggestions as `cluub check`, completion and hover docs (the grammar in `editors/` is the first piece).
2. **Full static types** with inference, so wrong field access is caught before running.
3. **Database stores**: `store Orders holds Order in postgres` / `sqlite`, with migrations generated from models.
4. **Auth**: `page Admin at "/admin" for role "admin"`, plus sessions and OAuth.
5. **AI tools and agents**: `ai agent Support uses OrderService`, giving the AI safe, typed access to service actions, plus streaming replies in the UI.
6. **Native compiler in Rust** (same language, much faster for very large projects) and a single-binary install.
7. **Formatter** (`cluub fmt`) that also normalizes dictated code.
8. **Deploy targets**: static frontend + serverless backend, Docker, edge.
