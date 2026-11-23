# Automatic tests

```bash
cluub test
```

Every run, Cluub **reads your code and writes tests for it** into `tests/generated/`, then runs them together with your own tests. Frontend and backend run in one process with a fresh in-memory database, a fake AI and no network, so a full run usually takes milliseconds.

## What gets generated

| From your code | Tests Cluub writes |
|---|---|
| A model | creating it with valid values works; every `required`, `min`, `max`, `one of` and `email` rule rejects bad values **with the exact message** |
| A `require` in a service | an input that breaks it on purpose fails with that message (e.g. `title = ''`, `total = 0`) |
| A service action | it works with valid input |
| An api route | a missing parameter gives 400 and names the field; text where a number is expected gives 400; GET routes respond |
| A page | it renders and shows its headings |
| A button | typing sample text into the page's inputs and clicking it doesn't crash the page |

Generated tests are ordinary Cluub, so QA can read them:

```cluub
test "TodoService.add: rejects title = 'xx'"
  expect TodoService.add(title: "xx") fails with "Title must be at least 3 characters"

test "Home page: the Add button works"
  render Home
  type "Sample text" into "What needs doing?"
  click "Add"
  expect screen has "My todos"
```

## Writing your own

Put them in `tests/*.test.clb`:

```cluub
test "a new todo starts not done"
  let todo = TodoService.add("Buy milk")
  expect todo.done is false

test "toggling a missing todo says so"
  expect TodoService.toggle("42") fails with "not found"

test "a user can add a todo"
  render Home
  type "Call the bank" into "What needs doing?"
  click "Add"
  expect screen has "Call the bank"

test "the api checks input"
  let response = request post "/api/todos" with {title: ""}
  expect response.status is 400
```

| Statement | |
|---|---|
| `expect condition` | any comparison: `is`, `is not`, `has`, `>`, `is one of`… |
| `expect call fails` / `fails with "text"` | the call must fail (with a message containing the text) |
| `render Page` | open a page (headless, real backend) |
| `type "x" into "placeholder"` | type into an input |
| `click "label"` | click a button or link |
| `screen` | all visible text, e.g. `expect screen has "Saved"` |
| `request get|post|put|patch|delete "/path" with {…}` | call the api; gives `status` and `body` |

## Failures are precise

```text
tests/todo.test.clb
  ✗ a user can add a todo
      Expected screen has "Call the bank"
      got:      "Todos My todos What needs doing? Add"
      expected: has "Call the bank"
      at tests/todo.test.clb:14
```

```text
  ✗ checkout rejects empty carts
      It failed as expected, but with the message:
        "Cart not found"
      instead of one containing:
        "Your cart is empty"
```
