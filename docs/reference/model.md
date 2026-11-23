# model

A `model` describes the shape of a piece of data and the rules it must follow. Every time a model value is created, whether in a service, an api parameter, a store, an AI answer or a test, Cluub fills in defaults, converts loose input where it safely can (`"7"` becomes `7` for a number field) and checks every rule. If a value breaks a rule, creation stops with a `ValidationError` that has a plain-English message and an HTTP status of 400. The same model code runs on the server and in the browser.

## Syntax

```cluub
model Customer
  about "A person who buys things"
  name: text, required, min 2, max 80
  email: email, required "We need an email to send receipts"
  age: number = 0, min 0, max 130
  plan: text = "free", one of ["free", "pro", "team"]
  tags: list of text = []
  company: text?
```

Each field line has this shape:

```text
fieldName: type [= default] [, rule ["custom message"]]...
```

## Members / options

| Member | What it does | Required? | Default |
|---|---|---|---|
| `about "text"` | Describes the model. Used by `cluub explain`. | No | none |
| `name: type` | Declares a field and its type. | At least one field is usual, but zero is allowed | none |
| `= expression` | Value used when the field is not given. Evaluated again for every new value, so `= now()` gives the current time. | No | The empty value for the type (see below) |
| `, required` | The field may not be missing, `nothing`, blank text or (for lists) empty. | No | not required |
| `, min N` | Text: at least N characters. Number: at least N. List: at least N items. | No | none |
| `, max N` | Text: at most N characters. Number: at most N. List: at most N items. | No | none |
| `, one of [...]` | The value must equal one of the listed values. | No | none |
| `"message"` after a rule | Replaces the built-in message for that rule only. | No | built-in message |

**Types:** `text`, `number`, `bool`, `email`, `url`, `date`, `id`, `any`, `list of T`, the name of another model, and any of these followed by `?` to mean "may be `nothing`". See [Types](/reference/types).

**Empty values.** When a field is not given, has no default and is not `required`, it starts as: `""` for `text`, `email`, `url`, `date` and `id`; `0` for `number`; `false` for `bool`; `[]` for lists; `nothing` for `any`, nested models and every optional (`?`) field.

**The `id` field.** Every model also has an optional `id` that you do not declare. If you pass one, it is turned into text (`id: 5` becomes `"5"`). Stores assign it automatically when you `add` a value.

## Behaviour

**Creating a value.** Call the model like a function. Named values are the normal form:

```cluub
model Customer
  name: text, required
  email: email

test "creating a customer"
  let c = Customer(name: "Ada", email: "ada@example.com")
  expect c.name is "Ada"
```

Positional values are also accepted and fill fields in declaration order (`Customer("Ada", "ada@example.com")`), but named values are clearer and are what the docs use.

**Order of checks**, for each field in declaration order:

1. If the field was not given, use the default (evaluated now) or the empty value for its type.
2. If the value is missing: fail with the `required` message if the field is required. Missing means not given (and no default), `nothing`, text that is empty after trimming, or, for a required list, an empty list. If the field is not required, the remaining checks are skipped; blank text is kept as is for `text`, `id` and `any` fields, and becomes `nothing` for every other type (so `""` sent for an optional `number?` becomes `nothing`).
3. Check and convert the type: numbers given as text (`"42"`) become numbers; for `text` and `id`, numbers become text; for `bool`, `"true"`/`"yes"` and `"false"`/`"no"` become booleans; a plain object given for a nested model field is turned into that model (and validated); each item of a `list of T` is checked as a `T`.
4. Check `min`, then `max`, then `one of`.

The first failing check stops creation. Only one message is reported, never a list.

**Unknown fields.** Passing a field the model does not have is a compile error ([E109](/reference/errors#e109)) when the compiler can see it, and a runtime `ValidationError` otherwise (for example in a JSON body or in `Store.update` changes): `Customer has no field "nme". Did you mean "name"?`

**Compile time vs runtime.** The compiler checks field names (camelCase), duplicate fields, type names and named arguments in model calls. All value rules (`required`, `min`, `max`, `one of`, type checks) run at runtime, every time a value is created, including `Store.update`, api parameters typed with the model, and `ask ai ... as Model`.

**Where values are validated:**

| Where | When |
|---|---|
| `Model(...)` in any code | when the call runs |
| `Store.add`, `Store.update` | the item (or merged item) is rebuilt and checked |
| Api parameters typed as a model | before the route body runs, error 400 |
| `ask ai "..." as Model` | the AI's JSON is checked; invalid data is retried once |
| Loading a `saved in` file | each record is checked when the server starts |

**Errors and statuses.** A broken rule throws a `ValidationError` (status 400, code `invalid`, and `field` set to the field name). In an api it becomes a 400 response; on a page it appears as a toast; in a test you match it with `expect ... fails with "..."`.

**Folder and naming.** Models live in `models/` ([E301](/reference/errors#e301)). The model name is PascalCase ([E102](/reference/errors#e102)); field names are camelCase ([E103](/reference/errors#e103)). Models are not a layer: every declaration may use a model by name without `uses`.

### Built-in messages

| Rule | Message |
|---|---|
| required | `name is required` |
| min (text) | `name must be at least 2 characters` |
| max (text) | `name must be at most 80 characters` |
| min / max (number) | `age must be at least 0` / `age must be at most 130` |
| min / max (list) | `tags must have at least 1 items` / `tags must have at most 5 items` |
| one of | `plan must be one of: free, pro, team` |
| type | `age must be a number (got "abc")` |
| email | `email must be a valid email address` |
| url | `site must be a valid web address (https://...)` |
| date | `birthday must be a valid date like 2026-01-31` |

For list items the label includes the position: `scores[2] must be a number (got "x")`.

## Errors

| Code | Message (example) | Fix |
|---|---|---|
| [E010](/reference/errors#e010) | ``Expected `:` but found `text`.`` (hint: ``Fields look like `title: text`.``) | Put a colon between the field name and its type. |
| [E010](/reference/errors#e010) | ``Expected `of` but found `text`.`` | Write `list of text`, not `list text`. |
| [E012](/reference/errors#e012) | ``Unknown field rule `unique`.`` (hint: `Rules are: required, min N, max N, one of [...].`) | Use only the four rules. |
| [E101](/reference/errors#e101) | `"Customer" is declared twice (first as a model in models/customer.clb:1).` | Rename one declaration. |
| [E102](/reference/errors#e102) | `"customer" should be PascalCase (start with a capital letter, no underscores).` | Rename the model. |
| [E103](/reference/errors#e103) | `The field "first_name" should be camelCase (start lowercase, no underscores).` | Rename to `firstName`. |
| [E105](/reference/errors#e105) | `Unknown type "strng".` (hint: `Did you mean "text"?`) | Use a built-in type or a declared model. |
| [E108](/reference/errors#e108) | `Customer only has 2 fields.` | Too many positional values in a model call. |
| [E109](/reference/errors#e109) | `Customer has no field "nme".` (hint: `Did you mean "name"?`) | Fix the field name in the call. |
| [E115](/reference/errors#e115) | `Field "email" appears twice.` | Remove or rename the duplicate. |
| [E301](/reference/errors#e301) | `A model belongs in the "models" folder, but "Customer" is in services/customer.clb.` | Move the file to `models/`. |

## Examples

**1. A simple shape with defaults.**

```cluub
model Todo
  about "Something to do"
  title: text, required, min 3, max 120
  done: bool = false
  createdAt: date = today()
```

**2. Custom messages and allowed values.**

```cluub
model Signup
  about "Someone joining the waiting list"
  email: email, required "Please enter your email"
  name: text, required "Tell us your name", max 60 "Keep your name under 60 characters"
  plan: text = "free", one of ["free", "pro"] "Choose free or pro"
  seats: number = 1, min 1 "You need at least one seat", max 50
```

**3. Nested models, lists and tests for the rules.**

```cluub
model Address
  street: text, required
  city: text, required
  country: text = "NL", min 2, max 2

model Order
  about "An order placed by a customer"
  customerId: id, required
  items: list of text, min 1 "An order needs at least one item"
  total: number, required, min 0
  shipTo: Address?
  note: text?

test "an order needs items"
  expect Order(customerId: "1", items: [], total: 10) fails with "at least one item"

test "a nested address is validated"
  expect Order(customerId: "1", items: ["pen"], total: 3, shipTo: {street: "Main 1", city: ""}) fails with "city is required"

test "numbers given as text are converted"
  let o = Order(customerId: "1", items: ["pen"], total: "3")
  expect o.total is 3

test "required works for numbers too"
  expect Order(customerId: "1", items: ["pen"]) fails with "total is required"
```

## Edge cases & limits

* **`required` works on every type.** A required `number` or `bool` that is not given fails with `qty is required` instead of becoming `0` or `false`, and a required list must have at least one item (`[]` fails with `tags is required`). Without `required`, a missing number, bool or list quietly gets its empty value. Use `min N` on a list when you need more than one item.
* **Custom messages apply to one rule only.** In `email: email, required "We need an email"`, a missing email gives the custom message, but `"nope"` still gives `email must be a valid email address`. Type errors and `email`/`url`/`date` format errors cannot be customised.
* **Blank text is treated as missing.** `"   "` on a required field gives `name is required`. On an optional `text` field it is kept as `"   "` and `min` is not checked; on an optional field of another type (`number?`, `bool?`, `date?`…) it becomes `nothing`. This matters for form inputs and query strings, which send empty text.
* **`date` is text.** It is checked with the JavaScript date parser and stored as the original string; there is no date object or time zone handling.
* **`email` checking is shallow**: something `@` something `.` something, with no spaces.
* **`min` and `max` on `email`, `url`, `date` and `id`** count characters, like text.
* **Defaults are not checked against types at compile time.** `count: number = "x"` compiles and fails at runtime.
* **Fields cannot be named `about`**, because a line starting with `about` is read as the model description.
* **No computed fields, methods, uniqueness constraints or cross-field rules.** Put such checks in a service with `require`.
* **Return types are not enforced.** An action declared `-> Customer` can return anything; only creating a `Customer(...)` validates.

## See also

* [store](/reference/store): keeping model values
* [Types](/reference/types)
* [Models & data guide](/guide/data)
* [Error codes](/reference/errors)
