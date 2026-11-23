# test

A `test` is a named list of statements that checks your app. A test can call services, stores and models directly, send HTTP requests to your apis, and render pages, type into inputs and click buttons against the real backend. `cluub test` runs every test with a fresh in-memory backend, a fake AI and no network, so tests are fast, repeatable and never touch real data. Cluub also writes tests for you from your code into `tests/generated/`.

## Syntax

```cluub
test "placing an order"
  let order = OrderService.place("1", 20)
  expect order.total is 20
  expect OrderService.place("1", 0) fails with "Total must be positive"

test "the orders page works"
  render Orders
  type "20" into "Total"
  click "Place order"
  expect screen has "Order"

test "the api validates input"
  let response = request post "/api/orders" with {total: "abc"}
  expect response.status is 400
```

The full shape:

```text
test "name"
  statements...
```

## Members / options

A test has a name and a body; there are no other members. The body can use every ordinary statement (`let`, assignment, `if`, `for`, `while`, `try` / `catch`, `log`, `require`, `fail`) plus these test statements:

| Statement | What it does |
|---|---|
| `expect condition` | Fails the test if the condition is not true. |
| `expect call fails` | Fails the test unless `call` throws a Cluub error. |
| `expect call fails with "text"` | Same, and the error message must contain `text` (ignoring case). |
| `render PageName` | Opens the page in a headless browser wired to the test's backend, runs `when loaded`, and waits until everything settles. |
| `click "label"` | Clicks the first button or link whose text contains `label` (ignoring case), then waits. |
| `type "value" into "placeholder"` | Types into the first input or multiline input whose placeholder contains `placeholder` (ignoring case), then waits. |
| `go to "/path"` | Navigates the headless browser to a path, then waits. |
| `screen` | All visible text of the current page, plus input values, placeholders and the toast message. |
| `request method "/path" [with {...}]` | Sends an HTTP request to your apis. `method` is `get`, `post`, `put`, `patch` or `delete`. Returns `{status, body}`. |

## Behaviour

**Isolation.** Each test gets its own backend:

* every store is empty and in memory (even stores with `saved in`), and ids start at `"1"`;
* the AI is fake: `ask ai "..."` returns `"AI reply to: "` followed by the first 60 characters of the prompt, `as one of [...]` returns the first option, `as Model` returns a sample value of that model, `as list of T` returns `[]`, and `as number` returns `0`;
* clients check their arguments like in production, then return `nothing` without sending anything;
* values from `.env` are available as `env.X`, but the AI stays fake.

Tests run one after another in file order. Nothing carries over between tests.

**What a test can reach.** Without any `uses`, a test can call any service, store, client or api by name, create models, use `request` for HTTP-level api tests and `render` for pages. Pages, components and layouts cannot be used as values.

**Calling an api by name.** `TodoApi.list()` or `TodoApi.add(title: "Milk")` calls the route in process, without HTTP. Arguments follow the route's parameter order (path parameters first, then `with` parameters) and are checked exactly as an HTTP request would be: missing values fail with `Missing required value "title"`, and values are converted and validated against their types (`TodoApi.one("7")` with `{id}` typed `number` gets `7`). The result is the route's return value as plain JSON data (model values become plain objects, and a route without `return` gives `nothing`). Errors are thrown rather than turned into a status, so test them with `expect ... fails with "..."`. Use `request` when you want to check status codes and error bodies.

**`expect`.** For comparisons (`is`, `is not`, `<`, `>`, `<=`, `>=`, `has`, `is one of`) a failure shows both sides:

```text
  ✗ placing an order
      Expected order . total is 20
      got:      0
      expected: 20
      at tests/orders.test.clb:3
```

Other conditions report `Expected <condition>, but it was not true.` `is` compares lists and objects by content.

**`expect ... fails`.** The expression must throw a Cluub error: a `require` or `fail`, a model rule, a not-found from a store, a network or AI error. Messages:

| Situation | Failure message |
|---|---|
| It did not fail | `Expected this to fail with "…", but it succeeded.` |
| Wrong message | `It failed as expected, but with the message: "…" instead of one containing: "…"` |
| A JavaScript error instead of a Cluub error | `It failed, but with an unexpected program error instead of a Cluub error: …` |

**`request`.** Goes straight to the api dispatcher, with the same parameter checks, error statuses and JSON bodies as a real server. The body is an object; for `get` and `delete`, put parameters in the query string of the path. `response.body.error.message`, `.code` and `.field` describe errors.

**UI statements.** The first `render`, `click`, `type`, `go to` or `screen` creates a headless frontend connected to the test's backend, so api calls from the page hit the same stores the test uses. `render` opens the page's path with every `{param}` replaced by `1`. After each UI statement Cluub waits until every pending action and redraw has finished. An error that the page shows as a toast (a 400 from the server, a `fail`) does not fail the test; its message is part of `screen`. An unexpected JavaScript error while drawing or running the page fails the test with `The page crashed: …`.

UI failure messages:

| Situation | Message |
|---|---|
| No matching button or link | `There is no button or link labelled "Save" on screen. Found: "Add", "Clear".` |
| Button is disabled | `The "Save" button is disabled.` |
| No matching input | `There is no input with the placeholder "Email" on screen.` |
| No page in the project | `This project has no pages to render.` |

**Other errors.** If a statement throws outside `expect ... fails` (for example a service call that fails), the test fails with `Unexpected error: <message>`.

**Running.** `cluub test` compiles the project, regenerates `tests/generated/`, then runs your tests and the generated ones. `cluub test checkout` runs only tests whose name contains "checkout" (ignoring case). `cluub test --no-generate` skips generation. The command exits with status 1 if any test fails.

**Folder and naming.** Tests live in `tests/` ([E301](/reference/errors#e301)); by convention in files named `something.test.clb`. Do not edit `tests/generated/`, which is rewritten on every run. Test names are free text and do not need to be unique. Test statements anywhere else are [E120](/reference/errors#e120).

## Errors

| Code | Message (example) | Fix |
|---|---|---|
| [E010](/reference/errors#e010) | ``Tests need a name in quotes, e.g. `test "adding a todo"`.`` | Quote the name. |
| [E010](/reference/errors#e010) | ``Expected `into` but found …`` (hint: ``Write `type "Milk" into "Placeholder of the field"`.``) | Use `type "value" into "placeholder"`. |
| [E105](/reference/errors#e105) | `"Hom" is not a page.` (hint: `Did you mean "Home"?`) | `render` needs a page name. |
| [E107](/reference/errors#e107) | `TodoService has no action "ad".` | Fix the action name. |
| [E108](/reference/errors#e108) | `TodoService.add is missing the value for "title".` | Pass every parameter. |
| [E109](/reference/errors#e109) | `Todo has no field "titel".` | Fix the field name. |
| [E120](/reference/errors#e120) | `` `expect` can only be used inside a `test`. `` / `` `request` can only be used inside a `test`. `` / `` `screen` is only available in tests. `` | Move the statement into a test. |
| [E301](/reference/errors#e301) | `A test belongs in the "tests" folder, but "…" is in services/todo.clb.` | Move the test to `tests/`. |

## Examples

**1. Testing a service and its rules.**

```cluub
model Todo
  title: text, required, min 3
  done: bool = false

store Todos holds Todo

service TodoService
  about "Managing todos"
  uses Todos
  action add(title: text) -> Todo
    return Todos.add(Todo(title: title))
  action toggle(id: text) -> Todo
    let todo = Todos.get(id)
    return Todos.update(id, {done: not todo.done})

test "a new todo starts not done"
  let todo = TodoService.add("Buy milk")
  expect todo.done is false
  expect todo.id is "1"

test "toggling flips done"
  let todo = TodoService.add("Buy milk")
  let toggled = TodoService.toggle(todo.id)
  expect toggled.done is true

test "short titles and missing todos are rejected"
  expect TodoService.add("ab") fails with "at least 3 characters"
  expect TodoService.toggle("42") fails with "not found"
```

**2. Testing the HTTP api.**

```cluub
model Note
  body: text, required, max 280

store Notes holds Note

service NoteService
  about "Notes"
  uses Notes
  action add(body: text) -> Note
    return Notes.add(Note(body: body))
  action all() -> list of Note
    return Notes.all()

api NoteApi at "/api/notes"
  about "Note endpoints"
  uses NoteService
  get list at "/"
    return NoteService.all()
  post add at "/" with body: text
    return NoteService.add(body)

test "posting a note returns it with an id"
  let response = request post "/api/notes" with {body: "Hello"}
  expect response.status is 200
  expect response.body.id is "1"
  let list = request get "/api/notes"
  expect list.body.count is 1

test "a missing body is a 400 that names the field"
  let response = request post "/api/notes" with {}
  expect response.status is 400
  expect response.body.error.field is "body"
  expect response.body.error.message is "Missing required value \"body\""

test "unknown routes are 404"
  let response = request get "/api/nope"
  expect response.status is 404

test "routes can also be called by name"
  let note = NoteApi.add(body: "Hi")
  expect note.body is "Hi"
  expect NoteApi.list().count is 1
  expect NoteApi.add(body: "") fails with "Missing required value"
```

**3. A full-stack UI test.**

```cluub
model Todo
  title: text, required, min 3

store Todos holds Todo

service TodoService
  about "Todos"
  uses Todos
  action add(title: text) -> Todo
    return Todos.add(Todo(title: title))
  action all() -> list of Todo
    return Todos.all()

api TodoApi at "/api/todos"
  about "Todo endpoints"
  uses TodoService
  get list at "/"
    return TodoService.all()
  post add at "/" with title: text
    return TodoService.add(title)

page Home at "/"
  about "The todo list"
  uses TodoApi
  state todos = []
  state draft = ""
  when loaded
    todos = TodoApi.list()
  action add()
    TodoApi.add(title: draft)
    draft = ""
    todos = TodoApi.list()
  view
    heading "My todos"
    input draft, placeholder "What needs doing?", on enter add
    button "Add", on click add, disabled draft is empty
    for todo in todos
      text todo.title

test "a user can add a todo"
  render Home
  type "Call the bank" into "What needs doing?"
  click "Add"
  expect screen has "Call the bank"
  expect Todos.all().count is 1

test "server validation appears on screen"
  render Home
  type "ab" into "What needs doing?"
  click "Add"
  expect screen has "title must be at least 3 characters"
```

## Edge cases & limits

* **Clients cannot be faked.** After checking their arguments they always return `nothing` in tests, and there is no way to provide a canned response or a custom AI answer.
* **`click` and `type` match by text.** `click` finds buttons and links by the text they contain (the first match wins, so `click "Add"` can hit "Add to cart"). `type` finds inputs by placeholder only; inputs without a placeholder, checkboxes and selects cannot be driven.
* **Only click events.** There is no way to press Enter, submit a form, change a checkbox or pick from a select.
* **`render` replaces path parameters with `1`.** To open `/orders/7`, use `go to "/orders/7"`.
* **`screen` is plain text**: it cannot tell headings from buttons or check styles and attributes.
* **No setup/teardown blocks, test groups, skipping or parallel runs.** Repeat the setup lines, or put them in a service action.
* **Time is real.** `now()` and `today()` are not frozen, and `sleep` really waits.
* **`request` and api calls by name do not go through the HTTP server**, so the 1 MB body limit and bad-JSON handling of the production server are not exercised.

## See also

* [Automatic tests guide](/guide/testing)
* [api](/reference/api) and [page](/reference/page)
* [CLI: cluub test](/reference/cli)
* [Error codes](/reference/errors)
