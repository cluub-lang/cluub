# 3. A store and a service

**Goal:** save tickets in a store, and put every business decision (how tickets are submitted, ordered, started and resolved) in a service.

## The layers

The model says what a valid ticket *is*. Two more pieces decide what happens to tickets:

- A **store** keeps tickets. It's the data layer: add, find, update, remove.
- A **service** holds the business logic. It's the only place that decides things like "a resolved ticket can't be started again".

Later, the api (chapter 4) calls the service, and pages (chapter 5) call the api. This direction is enforced:

```text
page ──uses──▶ api ──uses──▶ service ──uses──▶ store
```

A page can never reach into the store directly; you'll see the error for that in chapter 5. See [Project structure & layers](/guide/structure).

## Create the store

Create `data/tickets.clb`:

```cluub
store Tickets holds Ticket saved in "storage/tickets.json"
  about "Every ticket, saved to a JSON file"
```

That's the whole data layer. A [store](/reference/store) declaration names the store (`Tickets`), the model it holds (`Ticket`), and optionally where it's saved. Without `saved in ...` it keeps tickets in memory and forgets them on restart. With it, tickets go to a JSON file that survives restarts. The `storage/` folder is already in `.gitignore`.

Every store has the same methods, so you never write them yourself:

| Method | Does |
|---|---|
| `all()` | every ticket |
| `find(id)` | the ticket, or `nothing` |
| `get(id)` | the ticket, or fails with 404 *Ticket "7" was not found* |
| `add(item)` | validates, assigns an `id` (`"1"`, `"2"`, ...), saves, returns the saved ticket |
| `update(id, changes)` | merges the changes, **re-validates**, saves |
| `remove(id)` | deletes (404 if missing) |
| `where(t => condition)` | the tickets for which the condition is true |
| `count()`, `clear()` | |

Stores return copies, so changing a ticket you got from a store doesn't change what's saved until you call `update`. Because services only talk to the store through these methods, you could later swap the JSON file for a database without touching a single service.

## Create the service

Create `services/ticket-service.clb`:

```cluub
service TicketService
  about "Business rules for submitting, working on and resolving tickets"
  uses Tickets

  action submit(customerName: text, customerEmail: email, subject: text, message: text) -> Ticket
    about "Submit a new ticket"
    let ticket = Ticket(customerName: customerName.trim(), customerEmail: customerEmail.lower(), subject: subject.trim(), message: message.trim(), receivedOn: today())
    return Tickets.add(ticket)

  action queue() -> list of Ticket
    about "Tickets that still need work, most urgent first"
    let open = Tickets.where(t => t.status is not "resolved")
    let sorted = []
    for level in ["urgent", "high", "normal", "low"]
      for ticket in open.where(t => t.priority is level)
        sorted.add(ticket)
    return sorted

  action get(id: text) -> Ticket
    about "Look up one ticket by its number"
    return Tickets.get(id)

  action start(id: text) -> Ticket
    about "An agent starts working on a ticket"
    let ticket = Tickets.get(id)
    if ticket.status is "resolved"
      fail "This ticket is already resolved"
    return Tickets.update(id, {status: "in progress"})

  action resolve(id: text, resolution: text) -> Ticket
    about "Close a ticket and record how the problem was solved"
    require resolution is not empty, "Please describe how you solved the problem"
    require resolution.count >= 10, "The resolution must be at least 10 characters"
    let ticket = Tickets.get(id)
    if ticket.status is "resolved"
      fail "This ticket is already resolved"
    return Tickets.update(id, {status: "resolved", resolution: resolution})
```

There's a lot here, so let's take it a piece at a time.

### `uses`

`uses Tickets` declares that this service depends on the `Tickets` store. Every dependency must be declared. Call `Tickets.add` without it and you get error **E106**; declare something you never use and you get warning **W101**. Declaring dependencies is what lets Cluub build each service with exactly what it needs, and lets tests swap the JSON file for a fresh, empty in-memory store. See [Services](/reference/service).

### Actions

An **action** is a function. `action submit(customerName: text, ...) -> Ticket` takes four typed parameters and returns a `Ticket`. The first line, `about "..."`, describes it for the team.

### `submit`: let the model do the checking

```text
let ticket = Ticket(customerName: customerName.trim(), customerEmail: customerEmail.lower(), ...)
return Tickets.add(ticket)
```

`let` creates a value. Notice what's **not** here: no "is the subject long enough?" checks. Creating the `Ticket` runs every rule from chapter 2. If the subject is `"Help"`, `submit` fails with *"subject must be at least 5 characters"* and nothing is saved.

What the service adds is **business decisions** the model can't know: we trim stray spaces, store email addresses in lower case so `Ada@Example.com` and `ada@example.com` are the same customer, and stamp the date with the built-in `today()` (see [Built-ins](/reference/builtins)).

You also didn't write `await`. Calls to stores, services and AI are awaited for you.

### `queue`: lists, lambdas and loops

```text
let open = Tickets.where(t => t.status is not "resolved")
```

`t => ...` is a quick one-line function (a *lambda*). `where` keeps the tickets for which it is true. Comparisons are words: `is`, `is not`, `is empty`, `is at least`, `has`, `is one of`. Symbols like `==` and `!=` are errors in Cluub (E006). This makes code read like the sentence you'd say out loud, which also means it can be dictated (see [Voice coding](/guide/voice)).

Then we sort by priority with two `for` loops: for each level from `urgent` down to `low`, add the open tickets with that priority to `sorted`. `.add(x)` appends to a list. It's not the shortest possible code, but anyone on the team can read it and check that urgent tickets come first.

### `start` and `resolve`: `fail` and `require`

These are the real business rules:

- `fail "This ticket is already resolved"` stops the action with that message and HTTP status **400**. You can choose another status: `fail "..." status 409`.
- `require condition, "message"` is shorthand for "if the condition is false, fail with this message". Put `require` lines at the top of an action, before it does any work.
- `Tickets.get(id)` already fails with **404** *Ticket "42" was not found* if there's no such ticket, so there's nothing to write for that case.
- `Tickets.update(id, {status: "resolved", resolution: resolution})` passes an object of changes. Because `update` re-validates, setting `status` to `"done"` would fail: it's not one of the allowed values.

The resolution rules are a nice example of where rules belong. "A resolution is at least 10 characters" only matters when *resolving*. A ticket starts with an empty resolution, so it's not a model rule. It goes in the service.

## Checkpoint

Run:

```bash
cluub check
```

```text
✓ No errors (0 suggestions · checked in 4.1ms)
```

Then run the tests:

```bash
cluub test
```

```text
Generated 20 tests in tests/generated/

tests/generated/models.test.clb
  ✓ Ticket: can be created with valid values 0ms
  ...

tests/generated/services.test.clb
  ✓ TicketService.submit: works with valid input 0ms
  ✓ TicketService.queue: works with valid input 0ms
  ✓ TicketService.resolve: rejects resolution = '' 0ms
  ✓ TicketService.resolve: rejects resolution = 'xxxxxxxxx' 0ms

tests/generated/ui.test.clb
  ✓ Home page: renders 1ms

20 passed in 3ms
```

There are four new tests in `tests/generated/services.test.clb`. Cluub read your `require` lines and wrote inputs that break each one on purpose:

```text
test "TicketService.resolve: rejects resolution = 'xxxxxxxxx'"
  expect TicketService.resolve(id: "Sample id", resolution: "xxxxxxxxx") fails with "The resolution must be at least 10 characters"
```

It also checks that `submit` and `queue` work with valid sample input. It doesn't generate "works" tests for `get`, `start` and `resolve`, because they need a ticket that already exists. You'll write those yourself in chapter 7.

The browser hasn't changed: the service has no way to reach a page yet. That's the api's job.

## Recap

- A **store** (`store Tickets holds Ticket saved in "..."`) is the data layer, with built-in `all`, `find`, `get`, `add`, `update`, `remove`, `where`, `count` and `clear`.
- A **service** holds business logic in **actions** with typed parameters and a return type.
- Every dependency is declared with `uses`.
- Let the model validate data; the service adds decisions the model can't know.
- `require cond, "message"` and `fail "message"` stop an action with a 400 and a clear message. `get` on a missing item gives a 404.
- Comparisons are words (`is`, `is not`, `is empty`); `x => ...` is a lambda; there's no `await` to write.

Next: [4. The api](/tutorial/04-api), where the service gets HTTP endpoints.
