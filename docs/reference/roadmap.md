# Status & roadmap

Cluub 0.1 is in **beta**. Here is exactly what exists today and what comes next.

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

## Road to 1.0 (enterprise-ready)

### UI and components
Today Cluub renders its built-in elements (`button`, `card`, `row`, `input`…) with a small hand-written virtual DOM and **plain CSS** (one theme file with variables, light/dark mode, the brand palette). There is no Tailwind and no component library yet.
1. **Cluub UI kit**: accessible, themeable ready-made components in the spirit of MUI, Chakra and shadcn/ui: data table (sort, filter, paginate), modal, drawer, tabs, menu, toast, date picker, autocomplete, file upload, charts, form builder with field errors.
2. **Component state** and slots for custom components.
3. **Styling options**: design tokens, multiple themes, optional Tailwind-style utility classes, CSS modules.
4. Routing extras: nested routes, route guards, query parameters, code splitting.

### Data
5. **Database stores**: `store Orders holds Order in postgres | mysql | sqlite | mongodb`, with migrations generated from models, indexes, transactions and seeding.
6. **Choose a database when creating an app**: `npm create cluub` asks SQL (PostgreSQL, MySQL, SQLite) or NoSQL (MongoDB) or none, writes the connection config and a Docker Compose service for it.

### Robustness
7. **Full static type checker** with inference: wrong field access, wrong return types and nothing-safety caught at compile time.
8. **Source maps**, so runtime errors point to the `.clb` line.
9. **Formatter** (`cluub fmt`), plus a **language server** and **VS Code extension** with inline errors, completion, hover docs and rename.
10. **Auto-correct**: `cluub fix` applies safe fixes for diagnostics (spelling suggestions, missing `uses`, naming, layer moves); `cluub dev --fix` and **fix on save** in the editor extension; a "auto-fix on save" choice when creating an app.
11. Fuzz and property tests for the compiler, a conformance test suite, mutation testing of generated tests, coverage reports.
12. Stable language specification, semantic versioning, deprecation policy and migration tool (`cluub migrate`).

### Security
13. **Authentication and authorization**: sessions, OAuth/OIDC (Google, Microsoft, Okta), roles and permissions declared in the language (`page Admin ... for role "admin"`).
14. CSRF tokens for cookie sessions, rate limiting, request size and timeout policies, configurable CORS.
15. Secrets from cloud vaults (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager); audit logging.
16. Security hardening: independent security audit, threat model, signed releases and npm provenance, SBOM, dependency-free supply chain kept by policy.

### Operations
17. **Docker**: `cluub build --docker` (multi-stage, non-root image) and generated `docker-compose.yml` with the chosen database.
18. **CI/CD**: generated GitHub Actions / GitLab CI / Azure Pipelines that run `cluub check`, `cluub test` and deploy.
19. **Cloud deploy**: `cluub deploy` targets for AWS, Azure, Google Cloud, Vercel, Fly.io and Kubernetes (Helm chart).
20. Observability: structured logs, health and readiness routes, metrics (Prometheus/OpenTelemetry), tracing.
21. Performance: clustering, caching, streaming AI replies, websockets, background jobs and scheduled tasks.

### AI
22. AI tools and agents with typed, permissioned access to service actions; streaming replies in the UI; usage and cost limits per user key.

