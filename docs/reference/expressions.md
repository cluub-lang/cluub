# Expressions

Expressions produce values: `20`, `"Hello {name}"`, `total * 1.2`, `todos.where(t => t.done)`, `count is greater than 3`. This page covers literals, names, member access, calls, quick functions, every operator and their precedence.

## Literals

| Literal | Examples | Notes |
|---|---|---|
| Number | `42`, `3.5`, `1_000_000` | Underscores are ignored. No leading dot (`.5`), no exponent (`1e3`), no hex. Negative numbers use the `-` operator. |
| Text | `"Hello"`, `"Hi {name}"` | Double quotes only. `{expr}` interpolates. |
| Multi-line text | `"""..."""` | Spans lines, indentation removed (see below). |
| Yes/no | `true`, `false`, `yes`, `no` | `yes` is `true`, `no` is `false`. |
| Nothing | `nothing` | The missing value (`null` in JSON). |
| List | `[1, 2, 3]`, `[]` | Items are any expressions. Newlines and a trailing comma (`[1, 2,]`) are allowed. |
| Object | `{name: "Ada", age: 36}`, `{"first name": "Ada"}` | Keys are names or text. Newlines and a trailing comma are allowed. |

### Text and interpolation

`{expression}` inside text is replaced by the expression's value, converted to text:

| Value | Shown as |
|---|---|
| `nothing` | empty string |
| whole number | `42` |
| other number | rounded to 2 decimals: `0.33` for `1 / 3` |
| `yes` / `no` | `true` / `false` |
| list | items joined with `, ` |
| object | JSON, e.g. `{"a":1}` |

```cluub
let name = "Ada"
let items = [1, 2]
let line = "Hi {name}, you have {items.count} items: {items}"
```

`line` is `Hi Ada, you have 2 items: 1, 2`.

Escapes:

| Escape | Produces |
|---|---|
| `\"` | `"` |
| `\\` | `\` |
| `\{` and `\}` | literal braces |
| `\n` | new line |
| `\t` | tab |
| `\` + any other character | that character (the backslash is dropped) |

A single-line text ends at the first unescaped `"`, so text inside an interpolation must use triple quotes: `"""Hi {name + "!"}"""`. A `{` without a closing `}` is error E004.

### Triple-quoted text

`"""` starts text that may span several lines. The **dedent rule**:

1. If the first line (right after the opening `"""`) is blank, it is removed.
2. If the last line (before the closing `"""`) is blank, it is removed.
3. The smallest indentation among the remaining non-blank lines is removed from every line.

```cluub
let topic = "tea"
let prompt = """
  Write a haiku about {topic}.
    Keep it calm.
  """
```

`prompt` is two lines: `Write a haiku about tea.` and `  Keep it calm.` (the extra two spaces stay). If text starts on the same line as `"""`, that line has zero indentation, so nothing is removed from the others. Interpolation and escapes work as in single-line text.

## Names and scoping

A name is looked up in this order; the first match wins:

1. Local names: `let` values, action parameters, loop variables, the `catch` name, quick-function parameters. Inner blocks first.
2. Page `state`. A state's starting value may refer to states declared above it (`state a = 2` then `state b = a * 3`).
3. Component properties (`takes`).
4. Page path parameters (`{id}` in `page X at "/x/{id}"`).
5. The declaration's own actions.
6. Declarations: models anywhere; services, stores, clients and apis only if listed in `uses` (E106 otherwise). In tests, every non-UI declaration is available without `uses`.
7. Built-ins: `now`, `today`, `round`, `text`, `number`, `uuid`, `json`, `random`, `sleep`, `env`, `screen`.

Because locals come first, `let text = "x"` hides the built-in `text(...)` in that block. An unknown name is E105 with a "Did you mean" suggestion.

## Member access

`order.total` reads a field. `items[0]` reads a list item (positions start at `0`; out of range gives `nothing`).

* In views, member access is null-safe: `user.name` on `nothing` gives `nothing`.
* In actions, routes and tests it is not: reading a field of `nothing` is a program error (`Cannot read properties of null`). On the server this is a 500 response; in a page it shows `Something went wrong: ...`. Check first with `if user is not nothing`.
* `.count`, `.first` and `.last` are special members, safe on `nothing`, and may also be written with parentheses (`.count()`). See [Built-ins](/reference/builtins#members).

## Calls

`name(args)` or `thing.member(args)`. Arguments are positional, named (`name: value`), or a mix. A trailing comma after the last argument is allowed, which helps when a call spans several lines.

```cluub
model Customer
  name: text, required
  tier: text = "free"

service Billing
  action charge(customerId: text, amount: number, note: text = "")
    return amount

test "calls"
  let a = Billing.charge("c1", 20)
  let b = Billing.charge(amount: 20, customerId: "c1")
  let c = Billing.charge("c1", note: "gift", amount: 5)
  let ada = Customer(name: "Ada")
  let bob = Customer("Bob", "pro")
  expect bob.tier is "pro"
```

How named arguments map, for actions, api routes, client routes and store methods:

* Each named argument goes to the parameter with that name (E108 if none matches).
* Positional arguments fill parameters from the first one, in order, counting only positional arguments. Write positional arguments first.
* Any parameter without a value, a default, or a `?` type is E108 (`... is missing the value for "amount"`). Passing too many positional values is also E108.
* The call is rewritten to plain positional order, so a parameter left out in the middle uses its default.

Model constructors (`Customer(...)`) take named field values; positional values fill fields in declaration order (excluding `id`). Unknown field names are E109.

For built-ins and methods, names are ignored and values are passed in the order written.

Calls to service actions, store methods, api and client routes, the declaration's own actions, component `action` properties and `sleep` are **awaited automatically**. Everything else runs synchronously. Because views are drawn synchronously, an awaited call (an api route or an action) inside a view expression is error **E117**; load the value into state first.

## Quick functions (lambdas)

`x => expression` is a one-expression function, used with `where`, `map` and `sortBy`.

```cluub
let todos = [{title: "Milk", done: true}, {title: "Eggs", done: false}]
let open = todos.where(t => not t.done)
let titles = todos.map(t => t.title.upper())
let byTitle = todos.sortBy(t => t.title)
let add = (a, b) => a + b
```

* One parameter: `x => ...`. Zero or several: `() => ...`, `(a, b) => ...`.
* The body is one expression; no statements.
* The body may not call services, stores, apis or clients (E108: `Calls to Orders can't go inside a quick x => ... function`). Use a `for` loop.
* A lambda can read names from the surrounding code.

## Operators

### Comparison

| Write | Means | Notes |
|---|---|---|
| `a is b`, `a equals b` | equal | Deep: lists and objects compare by content. `nothing` equals a missing value. No type conversion: `1 is "1"` is false. |
| `a is not b` | not equal | |
| `a < b`, `a is less than b`, `a is fewer than b` | less than | |
| `a > b`, `a is greater than b`, `a is more than b` | greater than | |
| `a <= b`, `a is at most b` | at most | |
| `a >= b`, `a is at least b` | at least | |
| `a is empty` | empty | `nothing`, blank text, `[]`, `{}`. Not `0`. |
| `a is not empty` | not empty | |
| `a is one of [x, y]` | member of list | Deep equality. `false` if the list is `nothing`. |
| `a has b` | contains | Text: substring, **ignoring case**. List: an item equal to `b`. Object: has key `b`. `nothing`: false. |

Every `is ...` form accepts `not`: `is not greater than`, `is not one of`, `is not at least`.

`<`, `>`, `<=`, `>=` use JavaScript rules: numbers numerically, text alphabetically by character code (`"10" < "9"` is true), mixed types converted to numbers.

Object equality compares the JSON form, so `{a: 1, b: 2}` and `{b: 2, a: 1}` are **not** equal.

### Logic

| Write | Result |
|---|---|
| `a and b` | `a` if it is falsy, otherwise `b` |
| `a or b` | `a` if it is truthy, otherwise `b` |
| `not a` | `true` if `a` is falsy |

`and` and `or` return one of their operands, so `name or "guest"` gives a default. Falsy values are `nothing`, `no`, `0` and `""`; empty lists and objects are truthy.

### Arithmetic

| Symbol | Word | Notes |
|---|---|---|
| `a + b` | `a plus b` | Numbers add. If either side is text, both are joined as text: `"2" + 3` is `"23"`. |
| `a - b` | `a minus b` | |
| `a * b` | `a times b` | |
| `a / b` | `a divided by b` | Division by zero gives `Infinity`, not an error. |
| `a % b` | none | Remainder. |
| `-a` | none | Negation. |

Prefer interpolation over `+` for building text. Adding lists (`[1] + [2]`) joins their text forms and is rarely what you want.

## Precedence

From loosest to tightest binding. Operators on the same row group left to right.

| Level | Operators |
|---|---|
| 1 | `x => ...`, `(a, b) => ...` |
| 2 | `or` |
| 3 | `and` |
| 4 | `not` (prefix) |
| 5 | `is`, `is not`, `equals`, `has`, `is empty`, `is one of`, `is greater/less/more/fewer than`, `is at least/most`, `<`, `>`, `<=`, `>=` |
| 6 | `+`, `-`, `plus`, `minus` |
| 7 | `*`, `/`, `%`, `times`, `divided by` |
| 8 | `-` (prefix) |
| 9 | `.member`, `(call)`, `[index]` |

Consequences:

* `not done is true` means `not (done is true)`.
* `a or b and c` means `a or (b and c)`.
* `1 + 2 * 3` is `7`; `10 divided by 4 times 2` is `5`.
* Comparisons do not chain meaningfully: `1 < x < 3` compares `(1 < x)` (a yes/no) with `3`. Write `x > 1 and x < 3`.
* `ask ai` reads its prompt and options at level 6, so `ask ai "Hi " + name` works but a comparison in the prompt needs parentheses.

Parentheses override everything: `(price + tax) * 2`.

## Rejected symbols (E006)

Cluub uses words for logic and equality. These symbols are compile errors:

| Symbol | Error message hint |
|---|---|
| `==` | Cluub uses the word `is` for comparison. Write `a is b`. |
| `!=` | Cluub uses `is not`. Write `a is not b`. |
| `&&` | Cluub uses the word `and`. |
| `\|\|` | Cluub uses the word `or`. |
| `!` | Cluub uses the word `not`. Write `not done`. |

Other characters outside the language (`'`, `;`, `@`, `&`, `|`, `^`, `~`, `$`, backtick) are E005 `Unexpected character`; a single quote gets the hint `Use double quotes (") for text.` Combinations like `+=` or `**` are syntax errors (E010).

## Edge cases & limits

* Word operators (`plus`, `minus`, `times`, `divided`, `and`, `or`, `not`, `is`, `has`, `equals`) are read as operators wherever an operator can appear, so avoid them as variable names.
* `.contains(x)` on a list uses strict equality (objects never match); `has` uses deep equality. On text, `.contains` is case-sensitive and `has` is not.
* Methods not listed in [Built-ins](/reference/builtins) are passed straight to JavaScript (`.join(", ")`, `.split(",")`, `.slice(0, 3)` work). They are not checked by the compiler.
* Numbers are JavaScript doubles: `0.1 + 0.2` is `0.30000000000000004` (shown as `0.3` in text).
* There is no ternary operator; use `if` / `else`, or `cond and a or b` when `a` is never falsy.

## See also

* [Statements](/reference/statements)
* [Built-ins](/reference/builtins)
* [Types](/reference/types)
* [Language reference](/reference/language)
