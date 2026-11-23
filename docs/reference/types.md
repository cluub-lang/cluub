# Types

Types describe model fields, action and route parameters, component properties and `ask ai ... as` results. This page lists every type, the validation rules, exactly how incoming values are converted, and the messages produced when a value is wrong.

## Where types are checked

| Written on | Checked at runtime? |
|---|---|
| Model fields (`name: text, required`) | Yes, every time a model value is created or updated. |
| Api route parameters (`post add at "/" with title: text`) | Yes, on every request, before the route body runs. Rules (`min`, `max`, ...) cannot be written on parameters. |
| Client route parameters (`get forecast at "/forecast" with latitude: number`) | Yes, before the request is sent: `latitude must be a number (got "abc")`. Numeric text is converted. Model types are not converted here. |
| `ask ai ... as Type` | Model types are validated; see [Ask AI](/reference/ask-ai). |
| Service and page action parameters, `-> Type`, `state x: T`, component `takes` | No. Used by the compiler (unknown type names are E105) and tools only. |

## Type reference

| Type | Accepts | Converts | Value when absent (not required, no `=` default) |
|---|---|---|---|
| `text` | text | a number becomes its text (`5` to `"5"`) | `""` |
| `number` | finite numbers | numeric text (`"12"`, `" 4.5 "`) becomes a number | `0` |
| `bool` | `true` / `false` | `"true"`, `"yes"` to `true`; `"false"`, `"no"` to `false` | `false` |
| `email` | text that looks like `a@b.c` | none | `nothing` |
| `url` | text starting with `http://` or `https://`, no spaces | none | `nothing` |
| `date` | text that JavaScript can parse as a date | none (stays text) | `nothing` |
| `id` | like `text` | a number becomes text | `""` |
| `any` | anything | none | `nothing` |
| `list of T` | a list; each item checked as `T` | each item converted as `T` | `[]` |
| `action` | anything (a callback) | none | `nothing` |
| a model name | a model value or an object | an object becomes that model, validated | `nothing` |
| `T?` | `T` or `nothing` | as `T` | `nothing` |

`list` must be written `list of T` (`list of text`, `list of Order`).

### `text` and `id`

Text values pass unchanged. Numbers are converted to text. Anything else (yes/no, lists, objects) fails with `title must be a text (got true)`. `id` behaves exactly like `text`; use it to signal that a value is an identifier.

### `number`

Numbers must be finite. Text is converted when, after trimming spaces, it is non-empty and JavaScript's `Number` reads it as finite. That accepts `"12"`, `" 4.5 "`, `"-3"`, and also `"1e3"` (1000) and `"0x10"` (16). `"abc"`, `"12abc"`, yes/no and lists fail: `age must be a number (got "abc")`.

### `bool`

Only the exact lowercase texts `"true"`, `"yes"`, `"false"` and `"no"` are converted. `"TRUE"`, `1` and `0` fail: `active must be a yes/no value (got "TRUE")`.

### `email`, `url`, `date`

* `email` must match `something@something.something` with no spaces: `email must be a valid email address`.
* `url` must start with `http://` or `https://` and contain no spaces: `site must be a valid web address (https://...)`.
* `date` must be text that `Date.parse` accepts, such as `"2026-01-31"` or `"2026-01-31T10:00:00Z"`: `due must be a valid date like 2026-01-31`. The value stays text; there is no date object. `today()` and `now()` produce valid dates.

### `list of T`

The value must be a list (`tags must be a list (got "a")`). Each item is validated and converted as `T`, and errors name the item by its 1-based position: `tags[2] must be a number (got "x")`.

### `any` and `action`

`any` accepts every value without checks. `action` is the type of component callback properties (`takes onSave: action`); the compiler requires the argument to be an action, and an `action` property is never reported as missing.

```cluub
component SaveBar
  takes label: text = "Save", onSave: action
  view
    button label, on click onSave, style primary
```

### Model types and nesting

A field, parameter or AI result typed with a model name accepts a model value or a plain object. An object is turned into that model, which validates all of its fields. A non-object fails with `home must be an Address (got "x")`.

```cluub
model Address
  city: text, required
  zip: text?

model Customer
  name: text, required
  home: Address?
  past: list of Address = []
```

Errors inside a nested model name the inner field only: `Customer(name: "Ada", home: {})` fails with `city is required`.

### Optional types: `T?`

`T?` allows `nothing`. A missing optional field is `nothing` rather than the type's default (`notes: text?` is `nothing`, `notes: text` is `""`). For api parameters, `T?` (or a default value) makes the parameter optional.

## Validation rules

Rules follow the type on a model field, separated by commas:

```cluub
model Product
  name: text, required "Every product needs a name", min 2, max 80
  price: number, required, min 0 "Price can't be negative"
  tags: list of text = [], max 5
  size: text = "M", one of ["S", "M", "L"]
```

| Rule | Text | Number | List | Default message |
|---|---|---|---|---|
| `required` | not missing | not missing | not missing | `name is required` |
| `min N` | at least N characters | at least N | at least N items | `name must be at least 2 characters` / `price must be at least 0` / `tags must have at least 1 items` |
| `max N` | at most N characters | at most N | at most N items | `name must be at most 80 characters` / `price must be at most 9` / `tags must have at most 5 items` |
| `one of [...]` | equal to an entry | equal to an entry | equal to an entry (deep) | `size must be one of: S, M, L` |

* A text after a rule replaces that rule's message entirely: `required "Every product needs a name"`.
* Rules run in this order: required, type check and conversion, `min`, `max`, `one of`. The first failure is reported.
* `min`/`max` on `email`, `url`, `date` and `id` count characters. On other types they compare the value numerically.
* A missing value skips `min`, `max` and `one of`.

## What counts as missing

A value is **missing** when it is `nothing`, absent, text that is empty or only spaces, or (for a `required` field) an empty list.

When a model is created, an **absent** field is filled in first:

| Field | Absent value |
|---|---|
| has `= default` | the default (then validated like any value) |
| `required`, no default | stays absent, so `required` fails: `age is required` |
| optional `T?` | `nothing` |
| otherwise | the type's value from the table above (`""`, `0`, `false`, `[]`, `nothing`) |

A field passed explicitly as `nothing` does not get the default.

Then a missing value:

* fails `required` with `<field> is required`, for every type. A `required` list must have at least one item.
* otherwise skips all checks and is stored as follows: `nothing` stays `nothing`; blank text is kept as-is for `text`, `id` and `any`; for every other type (`number`, `bool`, `email`, `url`, `date`, models) blank text becomes `nothing`.

```cluub
model Profile
  name: text, required
  age: number, required
  admin: bool
  emails: list of email, required
  site: url

test "missing values"
  expect Profile(age: 30, emails: ["a@b.co"]) fails with "name is required"
  expect Profile(name: "Ada", emails: ["a@b.co"]) fails with "age is required"
  expect Profile(name: "Ada", age: 30, emails: []) fails with "emails is required"
  let p = Profile(name: "Ada", age: "36", emails: ["a@b.co"], site: "")
  expect p.admin is no
  expect p.site is nothing
```

Api parameters work the same way: an absent, `nothing` or empty-text parameter reports `Missing required value "age"` unless it is optional.

## Coercion at the api boundary

Api route parameters are validated with the same type rules (rules such as `min` do not apply to parameters):

* Path parameters (`/{id}`) are always text before conversion, and are type `text` unless declared in `with`.
* Query parameters (get, delete) are text, so `number` and `bool` conversion matters there: `?limit=10&done=yes` arrives as `10` and `true`.
* Body parameters (post, put, patch) arrive as parsed JSON.
* An absent, `null` or empty-text parameter is `Missing required value "name"` (400), unless the parameter has a default or a `?` type.
* A model-typed parameter accepts a JSON object; unknown keys fail with `Customer has no field "nmae". Did you mean "name"?`.

## Model values

* Create a model with named values: `Customer(name: "Ada")`. Positional values fill fields in order.
* Every model has an optional `id`, always stored as text.
* Unknown field names fail at compile time (E109) or, for data from requests or the AI, at runtime: `Customer has no field "x"`.
* Creating a model from something other than named values fails: `Customer must be created from named values, like Customer(name: ...)`.
* A store's `update(id, changes)` merges the changes into the current value and validates the result again.

## Message reference

| Situation | Message |
|---|---|
| required | `<field> is required` |
| wrong type | `<field> must be <a type> (got <value>)` where the type reads `a text`, `a number`, `a yes/no value`, `a list`, or `a`/`an` + model name |
| email | `<field> must be a valid email address` |
| url | `<field> must be a valid web address (https://...)` |
| date | `<field> must be a valid date like 2026-01-31` |
| min / max | see the rules table |
| one of | `<field> must be one of: a, b, c` |
| unknown field | `<Model> has no field "<x>"` plus `. Did you mean "<y>"?` when close |
| missing api parameter | `Missing required value "<name>"` |

`<value>` is shown as quoted text (cut to 30 characters), a number, `nothing`, `a list`, or `an object`. All of these are validation errors: status 400, code `invalid`, `field` set to the field name. See [Runtime errors](/reference/runtime-errors).

## Edge cases & limits

* Whitespace-only text in a non-required `text` field is kept as-is.
* `bool` does not accept `1`/`0` or capitalized words.
* Query parameters cannot carry lists; a `list of T` parameter on a get route always fails.
* Action parameter types are not checked at runtime; validate inside the action with `require` if the action is called from code you do not control.
* A non-required list with `min` and no `= default` starts as `[]`, so leaving it out fails `min`. Give it a default that satisfies the rule, or drop `min`.

## See also

* [Model reference](/reference/model)
* [Expressions](/reference/expressions)
* [Runtime errors](/reference/runtime-errors)
* [Data guide](/guide/data)
