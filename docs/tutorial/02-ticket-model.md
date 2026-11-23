# 2. The Ticket model

**Goal:** describe what a support ticket is, including every rule a valid ticket must follow, in one place.

In most stacks, "what is a valid ticket?" ends up spread over a database schema, a backend validator, a frontend form library and a pile of tests, and those copies drift apart. In Cluub you write it once, in a **model**, and every layer uses it: services, the api, stores and tests.

## Create the model

Create `models/ticket.clb`:

```cluub
model Ticket
  about "A support request from a customer"
  customerName: text, required "Please tell us your name", min 2, max 80
  customerEmail: email, required "We need your email address to reply"
  subject: text, required "Please add a subject", min 5, max 120
  message: text, required "Please describe the problem", min 10, max 2000
  priority: text = "normal", one of ["low", "normal", "high", "urgent"]
  category: text = "other", one of ["billing", "technical", "account", "other"]
  status: text = "open", one of ["open", "in progress", "resolved"]
  summary: text = ""
  resolution: text = ""
  receivedOn: date?
```

Save. If `cluub dev` is still running, it recompiles without complaint: a model on its own doesn't change any page.

## Reading a model

A [model](/reference/model) is a list of **fields**, one per line. Each line reads left to right as a sentence:

```text
name: type [= default] [, rule] [, rule] ...
```

Field names are `camelCase` (error **E103** otherwise). Let's go through the pieces.

### Types

| Field | Type | Meaning |
|---|---|---|
| `customerName`, `subject`, ... | `text` | any string |
| `customerEmail` | `email` | a string that must look like an email address |
| `receivedOn` | `date?` | a date like `"2026-11-23"`; the `?` makes it **optional**, so it may be `nothing` |

The built-in types are `text`, `number`, `bool`, `email`, `url`, `date`, `id`, `any` and `list of T`, plus the name of any other model. See [Types](/reference/types).

### Rules

Rules come after the type, separated by commas:

- `required` means the field can't be missing or blank. `required "Please tell us your name"` replaces the default message with your own. Every rule accepts a custom message like this.
- `min 2` and `max 80` limit the **length** for text and lists, and the **value** for numbers.
- `one of [...]` allows only the listed values.

### Defaults

`priority: text = "normal"` gives the field a starting value. A new ticket is `normal` priority, `other` category and `open` until something changes it. `summary` and `resolution` start as empty text; the AI fills in the summary in chapter 6 and an agent writes the resolution in chapter 5.

Every model also gets an optional `id` field for free. The store assigns it when you save a ticket in the next chapter.

### Why these fields?

`priority` and `category` look like they belong to the AI, and they do: in [chapter 6](/tutorial/06-ai-features) AI will choose them. But the **allowed values** are a business decision, so they live in the model. Whatever the AI answers, a ticket can never end up with priority `"super urgent!!"`, because the model won't accept it.

`status` has three values that describe the ticket's life: `open` when it arrives, `in progress` when an agent starts on it, `resolved` when it's done. Values are plain text, so spaces are fine.

## Creating tickets

You create a model by calling it with **named values**:

```text
Ticket(customerName: "Ada Lovelace", customerEmail: "ada@example.com", subject: "Cannot log in", message: "The login button does nothing.")
```

Fields you leave out get their defaults. If anything breaks a rule, creating the ticket **fails immediately** with a message that's ready to show to a user:

| Code | Fails with |
|---|---|
| `Ticket(customerName: "", ...)` | Please tell us your name |
| `Ticket(customerName: "A", ...)` | customerName must be at least 2 characters |
| `Ticket(..., customerEmail: "nope", ...)` | customerEmail must be a valid email address |
| `Ticket(..., subject: "Help", ...)` | subject must be at least 5 characters |
| `Ticket(..., priority: "asap", ...)` | priority must be one of: low, normal, high, urgent |

Models validate every time one is created or changed, in services, in the api, in stores and in tests. That's what makes the model the single source of truth: there is no way to get an invalid `Ticket` into the system.

## The compiler knows your model

Models are also checked at compile time. Misspell the type of `customerEmail` as `emial` and save:

```text
error E105 models/ticket.clb:4:18
  Unknown type "emial".
   3 |   customerName: text, required "Please tell us your name", min 2, max 80
   4 |   customerEmail: emial, required "We need your email address to reply"
     |                  ^^^^^
  hint: Did you mean "email"?

✗ 1 error · 0 warnings · 0 suggestions
```

Fix it and save again. Later, when you write `Ticket(subjct: ...)` in a service, the compiler catches that too (error **E109**), before anything runs.

## Tests for free

Run the tests:

```bash
cluub test
```

```text
Generated 16 tests in tests/generated/

tests/generated/models.test.clb
  ✓ Ticket: can be created with valid values 0ms
  ✓ Ticket: customerName is required 0ms
  ✓ Ticket: customerName must be at least 2 characters 0ms
  ✓ Ticket: customerName must be at most 80 characters 0ms
  ✓ Ticket: customerEmail is required 0ms
  ✓ Ticket: customerEmail must be a valid email 1ms
  ✓ Ticket: subject is required 0ms
  ✓ Ticket: subject must be at least 5 characters 0ms
  ✓ Ticket: subject must be at most 120 characters 0ms
  ✓ Ticket: message is required 0ms
  ✓ Ticket: message must be at least 10 characters 0ms
  ✓ Ticket: message must be at most 2000 characters 0ms
  ✓ Ticket: priority must be one of the allowed values 0ms
  ✓ Ticket: category must be one of the allowed values 0ms
  ✓ Ticket: status must be one of the allowed values 0ms

tests/generated/ui.test.clb
  ✓ Home page: renders 2ms

16 passed in 3ms
```

You wrote twelve lines and got fifteen model tests: one that creates a valid ticket, and one for each rule that tries to break it and checks the **exact message**. Open `tests/generated/models.test.clb` to read them. Here's one:

```text
test "Ticket: customerName is required"
  expect Ticket(customerName: "", customerEmail: "user@example.com", subject: "Sample subject", message: "Sample message", priority: "low", category: "billing", status: "open", summary: "Sample summary", resolution: "Sample resolution", receivedOn: "2026-01-31") fails with "Please tell us your name"
```

The generated tests fill every other field with a valid **sample value** (`"Sample subject"`, `"user@example.com"`, the first option of each `one of`) so that only the field under test is wrong. You'll see these sample values again in later chapters.

If you change a rule, say `min 5` to `min 8` on `subject`, the next `cluub test` rewrites the test to match. Generated tests can't go stale.

## Checkpoint

- `models/ticket.clb` exists with the model above.
- `cluub check` prints `✓ No errors`.
- `cluub test` prints `16 passed`: 15 model tests and the home page test.
- The browser still shows the Helpdesk home page from chapter 1. Nothing visible has changed yet.

## Recap

- A **model** describes the shape of your data and its rules, in one place.
- Fields are `name: type`, optionally with `= default` and rules: `required`, `min`, `max`, `one of`. Any rule can carry a custom message.
- `T?` makes a field optional. Every model has an optional `id`.
- Models validate on every create and change, everywhere, with user-ready messages.
- The compiler checks types and field names; `cluub test` generates a test for every rule.

Next: [3. A store and a service](/tutorial/03-store-and-service), where tickets get saved and the business rules arrive.
