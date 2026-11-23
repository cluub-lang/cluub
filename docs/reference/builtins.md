# Built-ins

Cluub has a small set of built-in functions, two built-in values (`env` and, in tests, `screen`), and members and methods on lists and text. They need no `uses` line and no import.

## Functions

| Function | Returns | Example | Result |
|---|---|---|---|
| `now()` | current date and time, ISO text, UTC | `now()` | `"2026-11-23T13:31:01.263Z"` |
| `today()` | current date, `YYYY-MM-DD`, UTC | `today()` | `"2026-11-23"` |
| `round(x, digits = 0)` | number rounded to `digits` decimals | `round(2.345, 2)` | `2.35` |
| `text(x)` | `x` as display text | `text(1 / 3)` | `"0.33"` |
| `number(x)` | `x` as a number, or a validation error | `number("4.5")` | `4.5` |
| `uuid()` | a random unique id (text) | `uuid()` | `"686f6a6d-9c96-..."` |
| `json(x)` | `x` as pretty-printed JSON text | `json({a: 1})` | `"{\n  \"a\": 1\n}"` |
| `random(min = 0, max = 1)` | a whole number from `min` to `max`, inclusive | `random(1, 6)` | `4` |
| `hasAiKey()` | yes/no: has the end user saved their own AI key in this browser | `if hasAiKey()` | `yes` |
| `sleep(ms)` | nothing, after waiting `ms` milliseconds | `sleep(500)` | (waits) |

### `now()` and `today()`

Both use UTC. `now()` includes milliseconds and ends in `Z`. Both results are valid values for a `date` field.

```cluub
model Note
  body: text, required
  createdAt: date

service Notes
  action stamp(body: text) -> Note
    return Note(body: body, createdAt: now())
```

### `round(x, digits)`

Converts `x` with JavaScript `Number`, multiplies by 10^digits, rounds half up (towards positive infinity), and divides back. `round(2.5)` is `3`, `round(-2.5)` is `-2`. `round(nothing)` is `0`; `round("abc")` is `NaN`, shown as the text `NaN`. Binary floating point applies, so `round(1.005, 2)` is `1`.

### `text(x)`

The same conversion used by interpolation and by every value shown in a view:

| `x` | `text(x)` |
|---|---|
| `nothing` | `""` |
| whole number | `"42"` |
| other number | rounded to 2 decimals: `"3.14"` for `3.14159` |
| yes/no | `"true"` / `"false"` |
| list | items converted the same way, joined with `, ` |
| object or model | compact JSON |

### `number(x)`

Uses JavaScript `Number`. If the result is not a finite number, it fails with a validation error (400): `Can't turn "abc" into a number`. Note the JavaScript conversions: `number(nothing)` and `number("")` are `0`, `number(yes)` is `1`.

```cluub
action parseQuantity(raw: text) -> number
  let qty = number(raw)
  require qty is at least 1, "Quantity must be at least 1"
  return qty
```

### `uuid()`

A random version-4 UUID from the platform's `crypto.randomUUID`. Where that is unavailable, a time-based id is used instead (still unique within the process, but not a UUID). Stores create their own ids (`"1"`, `"2"`, ...) so you only need `uuid()` for ids you hand out yourself.

### `json(x)`

`JSON.stringify` with 2-space indentation. Models serialize to their fields. `json("hi")` is `"\"hi\""` (quoted) and `json(nothing)` is `"null"`. Useful for logging and for putting data into AI prompts.

### `random(min, max)`

A whole number with both ends included. `random()` returns `0` or `1`. Pass whole numbers; the result is not meaningful for decimals or for `min` greater than `max`.

### `sleep(ms)`

Waits, then returns `nothing`. It is awaited automatically, so the next line runs after the pause. Use it in actions, event blocks and tests. It can't be used in a view expression, because views are drawn without waiting: the compiler reports **E117** there.

### `hasAiKey()`

`yes` when the end user has saved their own AI key with the [`aikey`](/reference/view-elements#aikey) element in this browser, otherwise `no`. Use it in views and page actions, for example to show a hint before the first AI feature:

```cluub
page Home at "/"
  view
    if not hasAiKey()
      text "Add your AI key in Settings to use the writing helper."
```

On the server it is always `no`: the server sees a user's key only inside the request that carries it. See [Your own AI keys](/guide/ai-keys).

## `env`

`env.NAME` reads a configuration value on the server.

```cluub
service Mailer
  action from() -> text
    return env.MAIL_FROM or "noreply@example.com"
```

* Values come from the process environment, overlaid with the project's `.env` file (`NAME=value` lines; `#` lines are skipped; surrounding quotes are removed).
* A missing name gives `nothing`, so `env.X or "default"` works.
* Values are always text. Convert with `number(env.PORT)` when needed.
* Allowed in services, apis, clients, app settings and tests. In pages, components and layouts it is error **E205**: secrets must not reach the browser.
* Hard-coded keys in text are error **E401**; put them in `.env` and read them with `env`.

## `screen`

Tests only (E120 elsewhere). `screen` is the visible text of the page opened with `render`: all text, plus the value and placeholder of each field, plus the current toast message, with runs of whitespace collapsed to single spaces.

```cluub
page Hello at "/hello"
  state name = "world"
  view
    heading "Hello {name}"

test "the hello page greets"
  render Hello
  expect screen has "hello world"
```

`has` on text ignores case, so `expect screen has "Saved"` matches `saved` too.

## Members

Members are usually written without parentheses (`items.count`). Writing them with parentheses (`items.count()`, `name.first()`) gives the same result.

| Member | On a list | On text | On an object | On `nothing` |
|---|---|---|---|---|
| `.count` | number of items | number of characters | number of keys | `0` |
| `.first` | first item | first character | `nothing` | `nothing` |
| `.last` | last item | last character | `nothing` | `nothing` |

An empty list's `.first` and `.last` are `nothing`. On a number, `.count` is `0`.

## Methods

| Method | On | Returns | Changes the original? |
|---|---|---|---|
| `.where(x => cond)` | list | new list of items where `cond` is truthy | no |
| `.map(x => value)` | list | new list of the values | no |
| `.sortBy(x => key)` | list | new list sorted ascending by key | no |
| `.reversed()` | list | new list in reverse order | no |
| `.take(n)` | list | new list of the first `n` items | no |
| `.skip(n)` | list | new list without the first `n` items | no |
| `.contains(x)` | list, text | `yes` if present (strict equality; case-sensitive on text) | no |
| `.add(x)` | list | the new number of items | **yes**, appends `x` |
| `.upper()` | text | text in capitals | no |
| `.lower()` | text | text in lowercase | no |
| `.trim()` | text | text without surrounding spaces | no |
| `.startsWith(t)` | text | `yes` if the text starts with `t` | no |
| `.endsWith(t)` | text | `yes` if the text ends with `t` | no |

```cluub
action report(orders: list of any) -> text
  let paid = orders.where(o => o.paid)
  let totals = paid.map(o => o.total)
  let biggestFirst = paid.sortBy(o => o.total).reversed()
  let names = []
  for o in biggestFirst
    names.add(o.customer.trim().upper())
  return "{paid.count} paid orders, totals {totals}, by size: {names}"
```

Details:

* **`where`, `map`** pass each item to the quick function. The function cannot call services, stores, apis or clients (E108).
* **`sortBy`** compares keys with `<` and `>`: numbers numerically, text by character code (`"A"` before `"a"`). For descending order, write `.sortBy(f).reversed()`. The sort is stable. `sortBy` on `nothing` returns `[]`.
* **`take`, `skip`, `reversed`** never change the original list. `take(n)` with `n` larger than the list returns the whole list; a negative `n` counts as `0`. On `nothing` they return `[]`, and a text value is treated as a list of characters. Together they page through results: `items.skip(20).take(10)`.
* **`contains`** uses strict equality, so `[{a: 1}].contains({a: 1})` is `no`. Use the `has` operator for deep equality and case-insensitive text search.
* **`add`** mutates the list and returns the new count, not the list. Write `items.add(x)` as a statement. On a page, adding to a state list does not re-render by itself, but every event handler re-renders when it ends, so the new item appears as soon as the handler finishes.

### Other JavaScript methods

A method name not listed above is passed straight through to the JavaScript value. `.join(", ")`, `.split(",")`, `.slice(0, 3)`, `.replace("a", "b")`, `.includes(x)` and `.indexOf(x)` all work, with JavaScript semantics. Prefer `.reversed()` over JavaScript's `.reverse()`, which changes the list in place. The compiler does not check these names, and a typo fails only at runtime with a program error. Prefer the documented members and methods.

### Store methods are different

On a store, `where`, `count`, `add` and the others are **store methods** (see the [store reference](/reference/store)): `Todos.where(t => t.done)` reads stored items and is awaited.

## What happens on `nothing`

| Expression | In actions, routes, tests | In views |
|---|---|---|
| `x.count`, `x.first`, `x.last` | `0`, `nothing`, `nothing` | same |
| `x.sortBy(...)`, `x.take(n)`, `x.skip(n)`, `x.reversed()` | `[]` | `[]` |
| `x.where(...)`, `x.map(...)`, `x.upper()`, any other method | program error: `Cannot read properties of null` | `nothing` (null-safe) |
| `for item in x` | zero iterations | zero repetitions |
| `text(x)`, `"{x}"` | `""` | `""` |
| `number(x)`, `round(x)` | `0` | `0` |

On the server a program error becomes a 500 response (`Unexpected error in ...` in development). In a page it shows the toast `Something went wrong: ...`.

## Edge cases & limits

* `Todos.count()` on a store is the store method (awaited, counts stored items); `.count` on any other value is the member above.
* `.first` on an object returns `nothing`, not its first field.
* Interpolation and `text()` round to 2 decimals for display only; the number itself keeps full precision.
* `random`, `uuid`, `now` and `today` are not faked in tests; avoid asserting on their exact values.
* `app` is a reserved built-in name with no value; don't use it as a variable.

## See also

* [Expressions](/reference/expressions)
* [Types](/reference/types)
* [Store reference](/reference/store)
* [Testing guide](/guide/testing)
