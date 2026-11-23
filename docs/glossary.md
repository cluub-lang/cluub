# Glossary

Every term used in the Cluub language, CLI and docs, in alphabetical order. Each entry links to the page that covers it in depth.

## A

**about**: A one-line description on an app, model, store, service, api, page, component or action: `about "Place a new order"`. It powers `cluub explain`, and Cluub suggests adding it when a service, api or page has none (W104). See [POs, BAs, QAs & AI](/guide/team).

**action**: A named piece of behavior. In a **service**, an action is business logic (`action add(title: text) -> Todo`). In a **page**, an action is what happens when the user does something, and it may change state and call apis. As a component property type (`onRemove: action`), it's a callback the page passes in. See [Services & APIs](/guide/backend).

**api**: A declaration in `api/` that exposes service actions as HTTP routes: `api TodoApi at "/api/todos"`. Apis may only use services (layer rule). Their parameters are validated before your code runs. See [Services & APIs](/guide/backend) and the [api reference](/reference/api).

**app**: The single declaration in `app.clb` that names the project (PascalCase) and holds the settings `about`, `port`, `ai`, `aiModel` and `lang`. An unknown setting is warning W108, and a second `app` is error E101.

**ask ai**: The expression that calls a language model: `ask ai "Summarize {text}"`. It can be followed by `as Model`, `as one of [...]`, `using "provider"` and `with system "..."`. It's only allowed in the backend (E204). See [AI](/guide/ai).

**as Model / as one of**: Modifiers on `ask ai` that make the reply structured. `as Contact` parses the reply as JSON and validates it against the model, retrying once. `as one of ["bug", "feature"]` always returns exactly one of the options.

## B

**backend**: The server half of an app: models, stores, clients, services and apis, compiled into `dist/server.js`.

**build**: `cluub build` compiles the project into `dist/`, which `cluub start` or `node dist/start.mjs` runs. It fails with exit code 1 on any error. See [Deployment](/guide/deployment).

**built-in**: A function or value that's always available: `now()`, `today()`, `round()`, `text()`, `number()`, `uuid()`, `json()`, `random()`, `sleep()`, `env` (backend only) and `screen` (tests only).

## C

**check**: `cluub check` reports errors, warnings and suggestions without building anything. It exits with code 1 on errors.

**client**: A declaration in `network/` that describes an outside HTTP API, with a base URL, headers and typed routes. It belongs to the **network layer**, and services use it. In tests, client calls return `nothing`. See the [client reference](/reference/client).

**component**: A reusable, stateless piece of UI in `ui/components/`. It receives data with `takes`, has a `view`, and may not `uses` anything (E203). It's used from a page as `TodoItem todo: t, onRemove: remove`. See [Pages & components](/guide/frontend).

**crash message**: The text `This page hit an error while drawing: …` that the runtime shows in place of a page whose view threw an error. See [Troubleshooting](/guide/troubleshooting).

## D

**declaration**: A top-level building block of a Cluub file: `app`, `model`, `store`, `client`, `service`, `api`, `page`, `component`, `layout` or `test`. Each kind lives in its own folder (E301), and names are PascalCase (E102).

**dependency injection**: Cluub builds each service and api with exactly the dependencies listed in its `uses` line. Tests get the same wiring with empty in-memory stores and a fake AI. See [Project structure & layers](/guide/structure).

**diagnostic**: Any problem the compiler reports. It carries a code, a file, a line and a column, a message and usually a hint. Diagnostics come in three severities: **error** (`E…`, blocks the build), **warning** (`W…`) and **suggestion**. See [Errors & suggestions](/guide/errors).

**dist**: The output folder written by `cluub build` and `cluub dev`. It's standalone: `node dist/start.mjs` runs it with plain Node.js. It's deleted and rewritten on every build.

## E

**env**: The backend-only built-in that reads configuration: `env.STRIPE_KEY`. Values come from the process environment and `.env` (real environment variables win over `.env`). Reading `env` in the UI is E205.

**error code**: The identifier of a diagnostic, such as E201 or W104. Look one up with `cluub errors E201` or in the [error reference](/reference/errors).

**event**: A user interaction bound to an action in a view: `on click`, `on change`, `on input`, `on enter`, `on submit`, `on blur`, `on focus`. The handler must call an action (E113). See [Properties & events](/reference/properties-events).

**explain**: `cluub explain [--for po|ba|qa|dev]` writes a plain-English Markdown overview of the project straight from the code. See [POs, BAs, QAs & AI](/guide/team).

## F

**fail**: The statement that stops an action with an error: `fail "Free accounts can order up to 500" status 403`. The default status is 400.

**fake AI**: The stand-in for `ask ai` used by every test. It returns `AI reply to: <prompt start>` for text, a valid sample for `as Model`, an empty list for `as list of`, and the first option for `as one of`. It never touches the network. See [Testing strategy](/guide/testing-strategy#fake-ai-and-the-no-network-rule).

**file store**: A store with `saved in "path.json"`. It loads when the server starts, keeps every record in memory, and writes the whole JSON file atomically on each change, relative to the project root. See [Deployment](/guide/deployment#data-file-stores-and-backups).

## G

**generated test**: A test that `cluub test` writes into `tests/generated/` from your code: model rules, `require` checks, api validation, page rendering and button clicks. The files are rewritten on every run, so don't edit them. See [Automatic tests](/guide/testing).

**go to**: The statement that navigates to another page without a reload: `go to "/orders"`. It's allowed in pages and tests only.

## H

**hint**: The "how to fix it" line under a diagnostic, often a "Did you mean …?" suggestion based on spelling distance.

**holds**: The keyword that ties a store to its model: `store Todos holds Todo`.

## I

**id**: The optional identifier every model instance has. Stores assign `"1"`, `"2"`, … when you add a record without one. It's always text.

## L

**label (property)**: A view property that gives an element an accessible name (`aria-label`): `button "Delete", label "Delete {todo.title}"`. An `input` or `select` without it uses its placeholder. Not to be confused with the `label` view element, which renders a visible `<label>`. See [Accessibility](/guide/accessibility).

**lang**: The `app` setting that sets the page language (`<html lang>`), for example `lang "de"`. The default is `en`.

**layer**: One of the architectural levels every project follows: **UI** (pages, components, layouts), **api**, **service**, and **data** (stores) or **network** (clients). Models are shared by all of them.

**layer rule**: The enforced direction of dependencies: page → api → service → store, client or service. Breaking it is E201. See [Project structure & layers](/guide/structure).

**layout**: A declaration in `ui/layouts/` that wraps pages with shared UI such as a header and footer. A page opts in with `layout Main`, and the layout marks where the page goes with exactly one `slot` (warning W107 otherwise).

**LANGUAGE.md**: The complete language reference in the repository root. `cluub make` gives it to the AI.

**live reload**: `cluub dev` rebuilds when a `.clb`, `.css` or `.env` file changes. Each build has an id, and the browser reloads when it sees a new one. See [Troubleshooting](/guide/troubleshooting#live-reload-doesn-t-reload).

## M

**make**: `cluub make "<request>"` asks an AI to write or change `.clb` files and only writes them when the whole project compiles (up to three attempts). See [AI](/guide/ai).

**model**: A declaration in `models/` that describes a data shape and its validation rules: `title: text, required, max 80`. Creating one (`Todo(title: "x")`) validates it. See [Models & data](/guide/data) and the [model reference](/reference/model).

**model rule**: A constraint on a model field: `required`, `min N`, `max N`, `one of [...]`, each with an optional custom message.

## N

**nothing**: Cluub's missing value (like `null`). Optional types are written `T?`.

## P

**page**: A screen with a URL, in `ui/pages/`: `page Home at "/"`. It may have `title`, `layout`, `uses` (apis only), `state`, `when loaded`, actions and a `view`. See [Pages & components](/guide/frontend) and the [page reference](/reference/page).

**path parameter**: A `{name}` segment in a route or page path, such as `"/todos/{id}"`. It's available by name in the route body or page, and is always text.

**playground**: The in-browser editor on the docs site that compiles, runs and tests Cluub code with no install. See [Playground](/playground).

**project root**: The folder that contains `app.clb`. CLI commands search upward for it, and file stores and `.env` are relative to it.

## R

**render**: In a test, `render Home` opens a page headlessly against a fresh in-memory backend.

**request**: In a test, `request post "/api/todos" with {title: "x"}` calls an api route and gives back `status` and `body`.

**require**: The statement that guards an action: `require total > 0, "Total must be positive"`. If the condition is false, the action fails with status 400 and that message, and the test generator writes a test that breaks it.

**route**: One HTTP endpoint inside an api or client: method (`get`, `post`, `put`, `patch`, `delete`), name, path and `with` parameters. Parameters come from the path, the query string (get/delete) or the JSON body.

**runtime**: The JavaScript in `runtime/` that runs compiled programs: models, stores, the api dispatcher, the virtual DOM, the router, AI providers and the test runner. It has zero dependencies.

## S

**screen**: In a test, all visible text of the rendered page, including input values and the current toast: `expect screen has "Saved"`.

**service**: A declaration in `services/` that holds business logic and AI calls. It `uses` stores, clients and other services (but not in a circle, E202). See [Services & APIs](/guide/backend).

**slot**: The view line in a layout that marks where the page's content goes. Using it outside a layout is E013.

**state**: Data owned by a page that the view displays: `state draft = ""`. Assigning to it re-renders the page. Inputs bind to state (E112).

**store**: A declaration in `data/` that keeps records of one model, in memory or in a JSON file. Methods: `all`, `find`, `get`, `add`, `update`, `remove`, `where`, `count`, `clear`. It belongs to the **data layer**. See the [store reference](/reference/store).

**style**: A view property that applies a theme variant: `style primary | danger | ghost | muted`.

**suggestion**: The mildest diagnostic. It teaches a good habit (such as adding `about`) and never blocks anything.

## T

**takes**: The line where a component declares the properties it receives: `takes todo: Todo, onRemove: action`. Missing or unknown properties are E114.

**template**: A starter project for `cluub new --template app | ai-chat | blank`.

**test**: A declaration in `tests/` with a name and statements such as `expect`, `render`, `type … into`, `click` and `request`. See [Automatic tests](/guide/testing).

**theme.css**: The built-in stylesheet (`/_cluub/theme.css`), or your override file in the project root, served as `/assets/theme.css`.

**toast**: The message box the runtime shows at the bottom of the page when an action fails. It's announced to screen readers (`role="alert"`) and disappears after 5 seconds.

## U

**uses**: The line that declares a declaration's dependencies: `uses Todos, Mailer`. Using an undeclared dependency is E106, and declaring an unused one is W101.

**using**: The `ask ai` modifier that picks a provider or model for one call: `using "ollama:llama3.2"`.

## V

**view**: The block that describes what a page, component or layout shows, made of view elements, components, `for` and `if`. A view only shows data: calling an api, an action or `sleep()` while it draws is E117. See [View elements](/reference/view-elements).

**view element**: A built-in UI building block such as `heading`, `text`, `button`, `input`, `row`, `card` or `list`. An unknown element is E013.

**virtual DOM**: The runtime's in-memory description of the page. After each change it is rebuilt and compared with the previous one, and only the differences are applied to the browser's DOM. See [Performance](/guide/performance#the-runtime-model).

## W

**warning**: A diagnostic (`W101`–`W108`) for code that works but will hurt later, such as an unused dependency or an oversized action. Warnings don't block the build.

**when loaded**: The page block that runs when the page opens, typically to fetch data.

**with**: In a route, it introduces the parameters: `post add at "/" with title: text`. In `ask ai`, `with system "..."` sets the system prompt. In tests, `request post "/x" with {...}` sets the body.

## See also

* [FAQ](/faq)
* [Language reference](/reference/language)
* [Error codes](/reference/errors)
* [Why Cluub](/guide/introduction)
