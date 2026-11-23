# Testing strategy

This page is for QA engineers and test leads planning how to test a Cluub app. It explains which layers Cluub tests automatically, what those generated tests really prove (and what they don't), how to write the tests that matter, and how to run everything in CI. For the test syntax itself, see [Automatic tests](/guide/testing).

## The test pyramid in Cluub

Cluub's enforced layers (page → api → service → store/client) map directly onto a test pyramid. Every level runs in the same process with `cluub test`. Each test gets fresh, empty in-memory stores, a fake AI and no network.

| Level | What you test | How | Speed |
|---|---|---|---|
| **Model** (unit) | field rules: `required`, `min`, `max`, `one of`, `email` | `expect Todo(title: "") fails with "..."` | < 1 ms |
| **Service** (unit / integration) | business rules, `require`, store effects | call actions directly: `TodoService.add("Milk")` | < 1 ms |
| **Api** (contract) | status codes, validation, response shape | `request post "/api/todos" with {...}` | < 1 ms |
| **Page** (UI, full stack) | screens render, buttons work, data flows end to end | `render`, `type`, `click`, `screen` | 2–5 ms |
| **Browser e2e** (outside Cluub) | real browser, CSS, focus, real AI and outside APIs | Playwright, Cypress or manual, against `cluub start` | seconds |

Most tests should sit at the service and api levels: that's where the business rules live, and those tests are the fastest and most stable. Page tests in Cluub are cheap, because they run headlessly against the real backend. Use them for the main user journeys, not every edge case. Keep a thin layer of real-browser tests for what Cluub can't see (next section).

## What generated tests cover, and what they don't

`cluub test` rewrites `tests/generated/` from the code on every run. Here is exactly what it generates:

| Generated test | It proves | It does **not** prove |
|---|---|---|
| `Todo: can be created with valid values` | a sample built from the rules is accepted | real-world values are accepted |
| `Todo: title is required` / `must be at most 120 characters` / `must be one of...` / `must be a valid email` | each rule rejects a bad value **with the exact message** | rules on `date`, `url` or `bool` fields. `min` on text is only tested when `min` > 1 |
| `TodoService.add: rejects title = 'xx'` | a `require` at the **top** of an action rejects a value that breaks it | a `require` after other statements, or one with a condition the generator can't invert (anything beyond `is not empty`, `is not nothing`, or `>`, `>=`, `<`, `<=` against a number or `.count`) |
| `TodoService.add: works with valid input` | the action runs and returns something | that it returns the **right** thing. Actions that use `get`, `update`, `remove`, `fail` or a client get no such test, because they need data to exist |
| `TodoApi.add: says when title is missing` | a missing required parameter gives 400 and names the field | the success path of POST/PUT/PATCH/DELETE |
| `TodoApi.add: rejects text where ... should be a number` | number parameters reject text | other types |
| `TodoApi.list: responds` | GET routes **without** parameters return 200 | GET routes with path or query parameters |
| `Home page: renders` | the page draws without crashing and shows its first one or two literal headings or texts | pages with path parameters (skipped), content inside `if`, `for` or components |
| `Home page: the Summarize with AI button works` | typing "Sample text" into every text input and clicking the button doesn't crash the page (navigating to another page is fine) | that the click had the right effect: a server error toast doesn't fail this test. Buttons with a `disabled` rule get no generated test, because their enabled state depends on data |

In short, generated tests are a **safety net for rules and crashes**. They catch a removed validation, a renamed field, a broken route or a page that throws. They don't check that your features do the right thing. That part is your job, and it's what the next sections cover.

Generated tests can't be edited (the file is rewritten), and they can't be disabled one by one. If one fails, either the code changed behavior on purpose (fix the code or accept the new message) or you found a bug.

## Writing your own tests

Put hand-written tests in `tests/*.test.clb` (error **E301** if a test is elsewhere). Tests can call any store, service, client or api by name without `uses`. Calling an api by name (`TodoApi.list()`) goes through the same validation as an HTTP request and fails with the api's error message.

### Service tests: business rules

Arrange data through services or stores, act, then assert outcomes and failures:

```cluub
test "TodoService.toggle: finishes an open todo"
  let todo = TodoService.add("Buy milk")
  let done = TodoService.toggle(todo.id)
  expect done.done is true

test "TodoService.toggle: says when the todo doesn't exist"
  expect TodoService.toggle("42") fails with "not found"

test "TodoService.list: shows open todos first"
  Todos.add(Todo(title: "Done one", done: true))
  Todos.add(Todo(title: "Open one"))
  let list = TodoService.list()
  expect list.first.title is "Open one"
```

`fails with "text"` passes when the call fails with a **Cluub error** (validation, `require`, `fail`, not found, AI or network) whose message *contains* the text, ignoring case. A plain JavaScript crash fails the test with `It failed, but with an unexpected program error`, so you can tell bugs from rules.

### Api tests: the contract

```cluub
test "TodoApi.add: creates a todo and returns it"
  let response = request post "/api/todos" with {title: "Call the bank"}
  expect response.status is 200
  expect response.body.title is "Call the bank"

test "TodoApi.remove: returns 204 and the todo is gone"
  let todo = TodoService.add("Temporary")
  let response = request delete "/api/todos/{todo.id}"
  expect response.status is 204
  expect Todos.find(todo.id) is nothing
```

`response.status` is the HTTP status. `response.body` is the parsed JSON. Errors look like `response.body.error.message` and `response.body.error.field`.

### UI tests: user journeys

```cluub
test "Home: a user adds a todo and sees it"
  render Home
  type "Call the bank" into "Add a todo"
  click "Add"
  expect screen has "Call the bank"

test "Home: an empty title shows the rule"
  render Home
  type "ab" into "Add a todo"
  click "Add"
  expect screen has "at least 3 characters"
```

How the UI commands find things:

* `render Page` opens the page by name. Path parameters are filled with `"1"`.
* `type "x" into "text"` finds the first `input` or multiline input whose **placeholder** contains the text. Labels aren't searched, so give every field a placeholder.
* `click "text"` finds the first button or link whose text contains the text, and fails if it's disabled. Clicking a `type "submit"` button inside a `form` triggers the form's `on submit`.
* `screen` is all visible text, including input values, placeholders and the current toast. `expect screen has "..."` is the main UI assertion.
* `go to "/path"` navigates.

There is no command to pick a `select` option or tick a `checkbox`. Cover those paths with service or api tests.

## Naming tests

Use the same pattern as the generated tests, `Subject: behavior`, so reports sort and filter well:

| Level | Example name |
|---|---|
| Service | `OrderService.place: rejects totals over the free limit` |
| Api | `OrderApi.place: returns 403 for free accounts over 500` |
| Page | `Checkout: a user can pay with a saved card` |

`cluub test <filter>` runs only tests whose name contains the filter (case-insensitive), for example `cluub test "OrderService"`. Combine it with `--no-generate` to skip regenerating `tests/generated/`.

## Fake AI and the no-network rule

Tests never call a real AI provider or outside API. That keeps them free, fast and deterministic:

| In a test | Returns |
|---|---|
| `ask ai "..."` | `"AI reply to: "` followed by the first 60 characters of the prompt |
| `ask ai "..." as Contact` | a valid sample `Contact` built from the model's rules |
| `ask ai "..." as list of Contact` | an empty list |
| `ask ai "..." as one of ["bug", "feature"]` | the first option, `"bug"` |
| any `client` route | `nothing` |

So test **your code around the AI**: the prompt inputs are validated, the reply is stored, the page shows it. Don't test the model's judgement here. For prompt quality, run a separate, manual or scheduled evaluation against a real provider (for example a small script that calls your api on `cluub start` with a list of inputs).

Code that uses client results must handle `nothing`. Otherwise its tests fail with a plain JavaScript error.

## Using `cluub explain --for qa`

```bash
cluub explain --for qa --out qa-overview.md
```

The report lists the number of hand-written and generated tests, every test name with its file and line, and **"Edge cases to explore manually"**: one line for every `require` and `fail` in every service, phrased as the condition to break, for example `TodoService.add: check "Title must be at least 3 characters" appears when NOT (title.count is at least 3)`. Use it as the starting checklist for exploratory testing and to spot rules nobody has tested yet. Run `cluub test` first so the generated tests exist and are listed.

## CI

`cluub test` exits with **code 1** if the project doesn't compile or any test fails, and **0** otherwise. `cluub check` exits 1 on errors, while warnings and suggestions don't fail it. `cluub build` exits 1 on errors.

A typical pipeline: `cluub check` → `cluub test` → `cluub build`, plus optionally `cluub explain --for qa` as an artifact. Cluub isn't published to npm yet, so CI has to get the toolchain from its source repository.

This GitHub Actions workflow is an **example we haven't run**. Replace `your-org/cluub` with wherever your team keeps the Cluub source:

```yaml
# .github/workflows/test.yml
name: test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get the Cluub toolchain
        uses: actions/checkout@v4
        with:
          repository: your-org/cluub
          path: .cluub            # folders starting with "." are not compiled

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - run: npm install -g ./.cluub
      - run: cluub check
      - run: cluub test
      - run: cluub build
      - run: cluub explain --for qa --out qa-overview.md

      - uses: actions/upload-artifact@v4
        with:
          name: qa-overview
          path: qa-overview.md
```

Whether to commit `tests/generated/` is up to you: CI regenerates it anyway. Committing it makes behavior changes show up in code review (a new rule appears as a new test).

## See also

* [Automatic tests](/guide/testing)
* [POs, BAs, QAs & AI](/guide/team)
* [CLI reference](/reference/cli)
* [Accessibility](/guide/accessibility)
* [Troubleshooting](/guide/troubleshooting)
