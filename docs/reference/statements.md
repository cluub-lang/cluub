# Statements

Statements are the lines inside an action, an api route, `when loaded`, an event block, or a test. Each statement sits on its own line; blocks (the body of `if`, `for`, `while`, `try`) are indented by 2 spaces.

## Where statements run

| Place | Example | Notes |
|---|---|---|
| Service action | `action place(total: number)` | Runs on the server. |
| Api route | `post place at "/" with total: number` | The returned value is the response. |
| Page action / `when loaded` | `action save()` | Runs in the browser. |
| Event block | `on click` + indented lines | Runs in the browser, like a page action. |
| Test | `test "places an order"` | Runs in `cluub test` with fresh stores and a fake AI. |

## Summary

| Statement | Allowed in |
|---|---|
| `let name = value` | everywhere |
| `name = value`, `a.b = value`, `a[i] = value` | everywhere |
| `return [value]` | everywhere |
| `require cond, message` | everywhere |
| `fail message [status code]` | everywhere |
| `if` / `else if` / `else` | everywhere |
| `for name in list` | everywhere |
| `while cond` | everywhere |
| `try` / `catch [name]` | everywhere |
| `log value` | everywhere |
| any expression (usually a call) | everywhere |
| `about "..."` | everywhere (no runtime effect) |
| `go to path` | pages, page event blocks, tests (else E201) |
| `expect`, `expect ... fails [with ...]` | tests only (else E120) |
| `render`, `click`, `type ... into` | tests only (else E120) |
| `request METHOD path [with body]` | tests only (else E120); it is an expression |

## `let`

Creates a new name in the current block.

```cluub
let price = 20
let label = "Total: {price}"
```

* The name must be camelCase (E103).
* Creating the same name twice **in the same block** is E111. An inner block (inside `if`, `for`, ...) may create a name that already exists outside it; the inner one hides the outer one until the block ends.
* A name exists from its `let` line to the end of its block.

## Assignment

Changes an existing value.

```cluub
let count = 1
count = count + 1
let user = {name: "Ada"}
user.name = "Grace"
let scores = [1, 2, 3]
scores[0] = 10
```

* Assigning to a plain name requires a `let` in an enclosing block, an action parameter, a loop variable, or (on a page) a `state`. Otherwise it is E110: `"x" doesn't exist yet.`
* Fields (`a.b`) and list items (`a[i]`) can be assigned on any value. Index positions start at `0`.
* On a page, assigning to top-level state (`count = ...`) re-renders the view. Changing a nested field (`user.name = ...`) does not schedule a render by itself, but every event handler re-renders when it finishes.
* Only names, fields and list items can be assigned. `f() = 1` is a syntax error.

## `return`

Ends the action or route and hands back a value. `return` on its own returns nothing.

```cluub
action total(prices: list of number) -> number
  let sum = 0
  for p in prices
    sum = sum + p
  return sum
```

In an api route, the returned value becomes the JSON body with status 200. A route that ends without returning anything (or with a bare `return`) answers **204 No Content**. `return nothing` answers 200 with the body `null`.

The `-> Type` after an action is documentation for readers and tools; the returned value is not checked against it.

## `require`

```cluub
action withdraw(amount: number)
  require amount > 0, "Amount must be positive"
  require amount is at most 500, "You can withdraw at most 500 at once"
  return amount
```

If the condition is falsy, the action stops with a validation error: HTTP status **400**, code `invalid`, and the given message. The message can be any expression, including interpolated text. In a page, the message appears as a toast.

## `fail`

```cluub
action find(id: text)
  if id is empty
    fail "Give me an id"
  fail "Order {id} was not found" status 404
```

Stops with an error carrying the message and a status (default **400**). The status is any expression that yields a number. The error code in the JSON body depends on the status: `not_found` for 404, `forbidden` for 403, `failed` for everything else. See [Runtime errors](/reference/runtime-errors).

## `if` / `else if` / `else`

```cluub
action shipping(total: number) -> number
  if total is greater than 100
    return 0
  else if total is at least 50
    return 5
  else
    return 10
```

`else if` is `else` followed by another `if` on the same line; chains can be any length. Conditions use JavaScript truthiness: `nothing`, `0`, `""` and `no` are false; every list (even an empty one) and every object is true. Use `is empty` to test for empty lists and text.

## `for`

```cluub
action names(people: list of any) -> list of text
  let out = []
  for person in people
    out.add(person.name)
  return out
```

* The loop variable is a new name visible only inside the loop body.
* `nothing` loops zero times. Text loops over its characters. Any other non-list value (a number, an object) loops **once**, with the value itself.
* There is no `break`, `continue` or index variable. Use `while`, or `.where(...)` and `.map(...)` from [Built-ins](/reference/builtins).
* Calls inside the loop body are awaited one after another, so `for` is the way to call a service or store for each item (calls are not allowed inside `x => ...` functions, E108).

## `while`

```cluub
action countdown(start: number) -> list of number
  let n = start
  let out = []
  while n > 0
    out.add(n)
    n = n - 1
  return out
```

Repeats while the condition is truthy. There is no iteration limit: a condition that never becomes false hangs the request or the page.

## `try` / `catch`

```cluub
action safeDivide(a: number, b: number) -> number
  try
    require b is not 0, "Cannot divide by zero"
    return a / b
  catch problem
    log problem.message
    return 0
```

* `catch` is required; a `try` without it is a syntax error.
* In tests, a failing `expect` passes straight through `catch`, so a broken expectation always fails the test.
* The name after `catch` is optional and defaults to `error`.
* The caught value has `message`, `status`, `code` and (for validation errors) `field`. Unexpected program errors (for example reading a field of `nothing`) arrive with status `500` and code `internal`. See [Runtime errors](/reference/runtime-errors#catch-problem).
* There is no `finally`, and you cannot rethrow the same error; use `fail problem.message status problem.status`.

## `log`

```cluub
action debug(order: any)
  log order
  log "Total is {order.total}"
```

Prints a line starting with `[log]` to the server terminal (services, apis, tests) or the browser console (pages). Objects and lists are printed as JSON.

## Expression statements

Any expression can stand alone as a statement. This is how you call something for its effect:

```cluub
action clean()
  Orders.clear()
  sleep(100)
```

## `about`

`about "text"` describes the declaration for `cluub explain` and generated documentation. As the first line of an action it becomes that action's description. Elsewhere it is accepted and has no runtime effect.

## `go to`

```cluub
page NewOrder at "/orders/new"
  uses OrderApi
  state total = 0
  action place()
    let order = OrderApi.place(customerId: "1", total: total)
    go to "/orders/{order.id}"
  view
    input total, type "number", placeholder "Total"
    button "Place", on click place
```

Navigates to another page without reloading. Allowed in pages (actions, `when loaded`, event blocks) and in tests. In any other declaration it is E201: navigation is a UI concern, so return a value and let the page decide. A path that matches no page shows the built-in "Page not found" screen.

## Test-only statements

These are only valid inside `test` blocks (E120 elsewhere). Each test runs with empty in-memory stores, a fake AI and no network.

### `expect`

```cluub
model Order
  total: number, min 1

service Shop
  action double(n: number) -> number
    return n * 2

test "doubling"
  expect Shop.double(2) is 4
  expect Shop.double(3) is greater than 5
  expect [1, 2] has 2
  expect Order(total: 0) fails with "total must be at least 1"
```

`expect cond` fails the test when `cond` is falsy. For comparisons (`is`, `is not`, `<`, `>`, `<=`, `>=` and their word forms, `has`, `is one of`) the failure shows both sides:

```text
Expected Shop . double ( 2 ) is 5
      got:      4
      expected: 5
```

Other conditions report `Expected <source>, but it was not true.`

### `expect ... fails` and `expect ... fails with`

`expect X fails` passes when evaluating `X` raises a Cluub error (validation, `require`, `fail`, not found, api, AI or network error). `fails with "text"` additionally checks that the error message **contains** the text, ignoring case.

The expectation fails when:

* `X` succeeds: `Expected this to fail with "...", but it succeeded.`
* the message does not contain the text,
* `X` raises a program error instead of a Cluub error: `It failed, but with an unexpected program error instead of a Cluub error: ...`.

### `render`

`render PageName` opens the page in a headless browser wired directly to the test backend. Path parameters are replaced with `1` (`/orders/{id}` opens `/orders/1`). It waits until `when loaded` and all pending calls finish. If the page throws a program error while loading or drawing, the test fails with `The page crashed: ...`.

### `click`

`click "Label"` finds the first button or link (in page order, layout included) whose text contains the label, ignoring case, and fires its click handler, then waits for the page to settle.

* No match: `There is no button or link labelled "Label" on screen. Found: "Save", "Home".`
* Disabled button: `The "Label" button is disabled.`
* The button's click handler fires. A `type "submit"` button without a click handler submits its enclosing `form` instead, running the form's `on submit`.

### `type ... into`

`type "Milk" into "New todo"` finds the first `input` or textarea whose **placeholder** contains the target text (ignoring case) and enters the value, as text, through the field's input handler. No match: `There is no input with the placeholder "New todo" on screen.`

### `request`

`request METHOD path [with body]` is an expression that calls an api route directly and returns `{status, body}`. `METHOD` is `get`, `post`, `put`, `patch` or `delete`.

```cluub
test "the api validates input"
  let response = request post "/api/orders" with {total: "abc"}
  expect response.status is 400
  expect response.body.error.code is "invalid"
```

The path can include a query string (`request get "/api/orders?limit=5"`). The body is passed as parsed JSON, so the HTTP body size limit and JSON parsing do not apply.

### `screen`

Not a statement, but used with `expect`: `screen` is the visible text of the rendered page (including input values and placeholders) including the current toast message. `expect screen has "Saved"` checks it, ignoring case.

## Edge cases & limits

* Statement keywords are only keywords at the start of a line and when not followed by `=` or `.`. A local named `type` or `click` can be assigned (`type = "x"`) without confusion.
* A failing `expect` inside a `try` block is not caught by `catch`: the test still fails.
* `while` has no safety limit.
* `for` over an object loops once, over the object itself, not over its keys.
* A `return` inside an event block ends that handler.
* `-> Type` on actions is not enforced at runtime.

## See also

* [Expressions](/reference/expressions)
* [Runtime errors](/reference/runtime-errors)
* [Properties & events](/reference/properties-events)
* [Testing guide](/guide/testing)
