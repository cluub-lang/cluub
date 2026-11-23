# 7. Testing

**Goal:** understand what the generated tests cover, then write your own service, api and UI tests for the things only you know, including the parts that use AI.

## What you already have

Run the tests:

```bash
cluub test
```

You get `48 passed`, all of them generated. Here's what Cluub wrote, and from what:

| From your code | Generated tests |
|---|---|
| `Ticket` and `TicketDraft` | a valid one can be created; every `required`, `min`, `max`, `one of` and `email` rule rejects bad values with the exact message |
| `require` lines in services | an input that breaks each one on purpose (`rawEmail = ''`, `resolution = 'xxxxxxxxx'`) |
| service actions | each one works with valid sample input (except those that need an existing ticket) |
| api routes | a missing parameter gives 400 and names the field; parameterless GET routes respond with 200 |
| pages | each page renders and shows its first texts; each button without a `disabled` rule can be clicked after typing into every input, without crashing the page |

They're rewritten on every run, so they always match your code. What they **can't** know is what the app is *for*: that the queue puts urgent tickets first, that a resolved ticket can't be restarted, that an agent can go from "open" to "resolved" on the detail page. Those are your tests. See [Automatic tests](/guide/testing) and the [test reference](/reference/test).

## How tests run

Every test gets:

- **fresh, empty in-memory stores**, so nothing touches `storage/tickets.json` and tests can't affect each other. The first ticket a test creates always gets id `"1"`.
- **a fake AI**, so tests are free, fast, offline and give the same answer every time.
- **no network.**
- When a test renders a page, a **headless browser wired straight to the real backend**. UI tests are full-stack tests: the click goes through the page, the api, the service and the store.

## The fake AI

This is the one thing you need to know to test AI features. In tests, `ask ai` never calls a provider. Instead:

| You write | The fake returns |
|---|---|
| `ask ai "prompt"` | `"AI reply to: "` followed by the first 60 characters of the prompt |
| `ask ai "..." as one of [...]` | the **first** option |
| `ask ai "..." as SomeModel` | a valid **sample** of that model: `"Sample customerName"`, `"user@example.com"`, the first option of each `one of`, ... |

So in tests, every new ticket comes out `low` priority (the first of `["low", "normal", "high", "urgent"]`), `billing` category, with a summary starting `AI reply to: Summarize this support ticket...`. An imported email becomes a ticket from `Sample customerName` with the subject `Sample subject`.

That gives you two kinds of test to write:

- Tests that are **true for any AI**, such as "the priority is one of the allowed values" or "the summary isn't empty". These describe your app's real contract, and they stay true if you switch providers or models.
- Tests that **pin the fake's answer**, so you can check what your code does with a known AI result. Keep these few, and name them so nobody mistakes them for a claim about the real model.

## Service tests

Your tests go in `tests/`, in files ending in `.test.clb`. Create `tests/tickets.test.clb`:

```cluub
test "a new ticket is open and triaged"
  let ticket = TicketService.submit("Ada Lovelace", "ada@example.com", "Cannot log in", "The login button does nothing when I click it.")
  expect ticket.status is "open"
  expect ticket.priority is one of ["low", "normal", "high", "urgent"]
  expect ticket.category is one of ["billing", "technical", "account", "other"]
  expect ticket.summary is not empty
  expect ticket.receivedOn is today()

test "emails are saved in lower case"
  let ticket = TicketService.submit("Ada Lovelace", "Ada@Example.COM", "Cannot log in", "The login button does nothing when I click it.")
  expect ticket.customerEmail is "ada@example.com"

test "the fake AI picks the first option"
  let ticket = TicketService.submit("Ada Lovelace", "ada@example.com", "Cannot log in", "The login button does nothing when I click it.")
  expect ticket.priority is "low"
  expect ticket.summary has "AI reply to"

test "the queue shows urgent tickets first and hides resolved ones"
  Tickets.add(Ticket(customerName: "Ada Lovelace", customerEmail: "ada@example.com", subject: "Printer jam", message: "The printer jams on page two.", priority: "low"))
  Tickets.add(Ticket(customerName: "Alan Turing", customerEmail: "alan@example.com", subject: "Site is down", message: "Nobody can reach the website.", priority: "urgent"))
  Tickets.add(Ticket(customerName: "Grace Hopper", customerEmail: "grace@example.com", subject: "Old problem", message: "This was fixed last week.", status: "resolved"))
  let queue = TicketService.queue()
  expect queue.count is 2
  expect queue.first.subject is "Site is down"

test "a resolved ticket cannot be started again"
  let ticket = TicketService.submit("Ada Lovelace", "ada@example.com", "Cannot log in", "The login button does nothing when I click it.")
  TicketService.resolve(ticket.id, "Cleared the session cookie")
  expect TicketService.start(ticket.id) fails with "already resolved"

test "resolving a missing ticket says so"
  expect TicketService.resolve("42", "Cleared the session cookie") fails with "not found"

test "importing an email creates an open ticket"
  let ticket = TicketService.importEmail("Hi, this is Alan (alan@example.com). The export button crashes every time.")
  expect ticket.id is not nothing
  expect ticket.status is "open"
```

The pieces:

- `test "name"` followed by indented statements. Tests can call any service or store by name, without `uses`.
- `expect condition` passes if the condition is true. Any comparison works: `is`, `is not`, `has`, `is one of`, `is empty`, `>`.
- `expect call fails with "text"` passes only if the call fails **and** its message contains that text. Plain `expect call fails` accepts any failure.
- The queue test can't rely on the AI to produce an urgent ticket (the fake always says `low`), so it adds tickets straight to the `Tickets` store with the priorities it needs. Tests are the one place where skipping the service is fine.

## Api tests

Create `tests/api.test.clb`:

```cluub
test "the api creates a ticket"
  let response = request post "/api/tickets" with {customerName: "Ada Lovelace", customerEmail: "ada@example.com", subject: "Cannot log in", message: "The login button does nothing when I click it."}
  expect response.status is 200
  expect response.body.status is "open"

test "the api rejects a bad email address"
  let response = request post "/api/tickets" with {customerName: "Ada Lovelace", customerEmail: "nope", subject: "Cannot log in", message: "The login button does nothing when I click it."}
  expect response.status is 400
  expect response.body.error.message has "customerEmail"

test "the api says when a ticket does not exist"
  let response = request get "/api/tickets/42"
  expect response.status is 404
```

`request get|post|put|patch|delete "/path" with {...}` calls your api exactly like a browser would, and gives you `status` and `body`. Use api tests for the HTTP contract: status codes and the shape of responses.

## UI tests

Create `tests/ui.test.clb`:

```cluub
test "a customer can submit a ticket"
  render Home
  type "Ada Lovelace" into "Your name"
  type "ada@example.com" into "Your email"
  type "Cannot log in" into "Subject"
  type "The login button does nothing when I click it." into "What happened?"
  click "Submit ticket"
  expect screen has "Your ticket number is #1"

test "new tickets show up in the queue"
  TicketService.submit("Ada Lovelace", "ada@example.com", "Cannot log in", "The login button does nothing when I click it.")
  render Queue
  expect screen has "1 waiting"
  expect screen has "Cannot log in"

test "an agent can work on and resolve a ticket"
  TicketService.submit("Ada Lovelace", "ada@example.com", "Cannot log in", "The login button does nothing when I click it.")
  render TicketDetail
  expect screen has "Cannot log in"
  click "Start working"
  expect screen has "in progress"
  type "Cleared the session cookie" into "How did you solve it?"
  click "Resolve ticket"
  expect screen has "Resolution"
  expect screen has "Cleared the session cookie"
```

- `render Home` opens a page. For a page with path parameters, `render` fills each one with `1`, so `render TicketDetail` opens `/tickets/1`. That's why the last test creates a ticket first: in a fresh store, it gets id `"1"`.
- `type "text" into "placeholder"` finds an input by its placeholder.
- `click "label"` finds a button or link by its text. It fails with a clear message if the button is missing or disabled.
- `screen` is all the visible text on the page, toasts included.

These tests read like the steps a QA engineer would follow by hand, because that's what they are. They're also plain Cluub, so QA can read, review and write them.

## Checkpoint

Run `cluub test`:

```text
Generated 48 tests in tests/generated/

tests/api.test.clb
  ✓ the api creates a ticket 1ms
  ✓ the api rejects a bad email address 0ms
  ✓ the api says when a ticket does not exist 0ms

tests/generated/api.test.clb
  ✓ TicketApi.queue: responds 0ms
  ...

tests/tickets.test.clb
  ✓ a new ticket is open and triaged 0ms
  ✓ emails are saved in lower case 0ms
  ✓ the fake AI picks the first option 0ms
  ✓ the queue shows urgent tickets first and hides resolved ones 0ms
  ✓ a resolved ticket cannot be started again 0ms
  ✓ resolving a missing ticket says so 0ms
  ✓ importing an email creates an open ticket 0ms

tests/ui.test.clb
  ✓ a customer can submit a ticket 8ms
  ✓ new tickets show up in the queue 1ms
  ✓ an agent can work on and resolve a ticket 6ms

61 passed in 37ms
```

That's 13 tests of your own and 48 generated, all in well under a second.

### When a test fails

Break one on purpose: in `tests/ui.test.clb`, change `"1 waiting"` to `"2 waiting"`. Then run only the tests whose name contains "queue":

```bash
cluub test queue
```

```text
tests/ui.test.clb
  ✗ new tickets show up in the queue 2ms
      Expected screen has "2 waiting"
            got:      "Helpdesk New ticket Queue Import email Ticket queue 1 waiting low billing open #1 Cannot log in From Ada Lovelace on 2026-11-23 AI reply to: Summarize this support ticket in one short sentence for a bu Open Start Helpdesk · built with Cluub"
            expected: has "2 waiting"
      at tests/ui.test.clb:13

✗ 1 failed, 4 passed in 5ms
```

The failure shows what was expected, what was actually on screen and the exact line. You can also see the fake AI at work: priority `low`, category `billing`, and the summary `AI reply to: Summarize this support ticket...`. Change it back to `"1 waiting"`.

## Recap

- `cluub test` regenerates tests for models, `require` lines, service actions, api routes, pages and buttons, then runs them with yours.
- Every test gets fresh in-memory stores, a fake AI and no network. UI tests render real pages against the real backend.
- The fake AI returns `"AI reply to: ..."` for text, the **first option** for `as one of`, and a **sample** for `as Model`. Prefer assertions that hold for any AI; pin the fake only on purpose.
- `expect`, `expect ... fails with`, `request`, `render`, `type ... into`, `click` and `screen` cover service, api and UI tests.
- `cluub test <filter>` runs only matching tests; failures show expected, actual and the line.

Next: [8. Share and ship](/tutorial/08-share-and-ship), where the team gets docs straight from the code and the app gets built for production.
