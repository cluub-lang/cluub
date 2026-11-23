# Cluub Language Reference (v0.1)

Cluub is one language for frontend, backend and AI. Code reads like plain English,
blocks are defined by **2-space indentation**, and every project has the **same
structure**, enforced by the compiler. This file is the complete reference; it is
also what `cluub make` gives the AI so generated code follows the same rules.

## 1. Project layout (enforced, error E301)

| Folder | Holds | Layer |
|---|---|---|
| `app.clb` | the single `app` declaration | config |
| `models/` | `model` | data shapes + validation |
| `data/` | `store` | data layer |
| `network/` | `client` | network layer (outside APIs) |
| `services/` | `service` | business logic, AI |
| `api/` | `api` | HTTP endpoints |
| `ui/pages/`, `ui/components/`, `ui/layouts/` | `page`, `component`, `layout` | UI layer |
| `tests/` | `test` (generated tests go to `tests/generated/`) | tests |

## 2. Layer rules (enforced, error E201)

```
page ──uses──▶ api ──uses──▶ service ──uses──▶ store | client | service
component / layout: no dependencies (they receive data with `takes`)
```
* Every dependency is declared with `uses X` (Dependency Inversion). Using one without `uses` is error E106.
* `ask ai` and `env.X` are only allowed in services/apis/clients, never in the UI (E204, E205).
* Services may not depend on each other in a circle (E202).
* A view only shows data: calling an api or an action inside a view expression is E117. Load data into `state` in `when loaded` or an action.

## 3. Naming (enforced)
Declarations are `PascalCase` (E102). Fields, actions, state, params and values are `camelCase` (E103).

## 4. Lexical rules
* Comments start with `#`.
* Text uses double quotes: `"Hello {name}"`. `{expr}` interpolates. `"""triple quotes"""` span lines (great for prompts). Escape braces as `\{`.
* Numbers: `42`, `3.5`, `1_000`. Booleans: `true`/`false` (or `yes`/`no`). Missing value: `nothing`.
* Lists `[1, 2]`, objects `{name: "Ada", age: 36}`. A trailing comma is allowed: `[1, 2, 3,]`.
* Symbols `==`, `!=`, `&&`, `||`, `!` are errors (E006); use words.

## 5. Declarations

### app
```
app ShopApp
  about "What the app is"
  port 3000
  ai "claude"              # claude | openai | gemini | ollama, or "claude:claude-sonnet-5-5"
  aiKeys "server"          # whose keys pay: "server" (.env), "user" (each end user's own key) or "either"
```

### model
```
model Customer
  about "A person who buys things"
  name: text, required, min 2, max 80
  email: email, required "We need an email to send receipts"
  age: number = 0, min 0
  tier: text = "free", one of ["free", "pro"]
  tags: list of text = []
  notes: text?               # ? = optional
```
Types: `text number bool email url date id any list of T`, a model name, or `T?`.
Rules: `required`, `min N`, `max N`, `one of [...]`, each with an optional custom message.
Every model also has an optional `id`. Create one with named values: `Customer(name: "Ada", email: "a@b.co")`.
Invalid values fail with precise messages ("name must be at least 2 characters").

### store (data layer)
```
store Customers holds Customer                          # in memory
store Orders holds Order saved in "storage/orders.json" # persisted
```
Methods: `all()`, `find(id)` (nothing if missing), `get(id)` (fails 404 if missing), `add(item)`,
`update(id, changes)`, `remove(id)`, `where(x => condition)`, `count()`, `clear()`.

### client (network layer)
```
client Weather at "https://api.open-meteo.com/v1"
  header "User-Agent" "my-app"
  get forecast at "/forecast" with latitude: number, longitude: number
```

### service (business logic)
```
service OrderService
  about "Placing and tracking orders"
  uses Orders, Customers

  action place(customerId: text, total: number) -> Order
    about "Place a new order"
    require total > 0, "Total must be positive"
    let customer = Customers.get(customerId)
    return Orders.add(Order(customerId: customer.id, total: total))
```

### api (backend endpoints)
```
api OrderApi at "/api/orders"
  uses OrderService
  get list at "/"
    return OrderService.all()
  get one at "/{id}"                 # {id} becomes a text parameter
    return OrderService.get(id)
  post place at "/" with customerId: text, total: number
    return OrderService.place(customerId, total)
  delete remove at "/{id}"
    OrderService.remove(id)
```
Parameters come from the path, the query string (get/delete) or the JSON body (post/put/patch),
are type-checked automatically, and missing or invalid values return 400 with a clear message.

### page (UI)
```
page Orders at "/orders"
  about "Lists orders"
  title "Orders"
  layout Main
  uses OrderApi
  state orders = []
  state total = 0

  when loaded
    orders = OrderApi.list()

  action place()
    OrderApi.place(customerId: "1", total: total)
    orders = OrderApi.list()

  view
    heading "Orders"
    row
      input total, type "number", placeholder "Total"
      button "Place order", on click place, style primary, disabled total is 0
    for order in orders
      OrderCard order: order
    if orders is empty
      text "No orders yet."
```
Calls to apis are awaited automatically. Errors from the server appear as a message toast automatically.
Path params (`at "/orders/{id}"`) are available by name (`id`). `go to "/path"` navigates.

### component and layout
```
component OrderCard
  takes order: Order, onCancel: action
  view
    card
      text "Order {order.id}: {order.total}"
      button "Cancel", on click onCancel(order.id), style danger

layout Main
  view
    header
      link "Home" to "/"
    slot                     # the page goes here
    footer
      text "© 2026"
```
Components have no state and no dependencies; pages own data (smart page / simple component pattern).

### View elements
Content: `heading`, `subheading`, `text`, `label`, `badge`, `item`, `button`, `link ... to`, `image`,
`input`, `checkbox`, `select ..., options [...]`. Containers: `row`, `column`, `card`, `box`, `grid`, `list`,
`header`, `footer`, `nav`, `section`, `form`. Others: `divider`, `spinner`, `slot`, `aikey` (built-in form where an end user adds or forgets their own AI key).
Control: `for x in list`, `if cond` / `else`. Components: `Name prop: value, other: value`.
Properties (after a comma): `on click|change|enter|submit|input action`, `placeholder "..."`, `type "number"`,
`disabled cond`, `style primary|danger|ghost|muted`, `class "..."`, `alt "..."`, `multiline`, `options [...]`.
Event blocks: an indented `on click` line followed by statements.

### test
```
test "placing an order"
  let order = OrderService.place("1", 20)
  expect order.total is 20
  expect OrderService.place("1", 0) fails with "Total must be positive"

test "the orders page works"
  render Orders
  type "20" into "Total"
  click "Place order"
  expect screen has "Order"

test "the api validates input"
  let response = request post "/api/orders" with {total: "abc"}
  expect response.status is 400
```
Every test gets fresh in-memory stores, a fake AI and no network.
`cluub test` also **generates** tests for every model rule, `require`, api route, page and button.

## 6. Statements
`let x = value`, `x = value`, `return value`, `require cond, "message"` (fails with 400),
`fail "message"` or `fail "message" status 404`, `if / else if / else`, `for x in list`,
`while cond`, `try` … `catch problem` (problem.message, problem.status), `log value`, `go to "/path"`.

## 7. Expressions
* Comparison: `is`, `is not`, `<`, `>`, `<=`, `>=`, `is greater than`, `is less than`, `is at least`,
  `is at most`, `is more than`, `is fewer than`, `is empty`, `is not empty`, `is one of [...]`, `has` (text/list contains), `equals`.
* Logic: `and`, `or`, `not`. Math: `+ - * / %` or `plus minus times divided by`.
* Lists/text: `.count`, `.first`, `.last`, `.where(x => ...)`, `.map(x => ...)`, `.sortBy(x => ...)`,
  `.contains(x)`, `.add(x)`, `.upper()`, `.lower()`, `.trim()`.
* Built-ins: `now()`, `today()`, `round(x, digits)`, `text(x)`, `number(x)`, `uuid()`, `json(x)`, `random(a, b)`, `sleep(ms)`, `hasAiKey()` (UI: has the end user saved their own AI key), `env.NAME` (backend only). In tests: `screen`.

## 8. AI
```
let summary = ask ai "Summarize: {text}"
let contact = ask ai "Extract the contact from: {email}" as Contact     # structured, validated
let kind = ask ai "Bug or feature? {report}" as one of ["bug", "feature"]
let fr = ask ai "Translate to French: {t}" using "openai" with system "You are a translator"
```
Providers: Claude (`ANTHROPIC_API_KEY`), OpenAI (`OPENAI_API_KEY`), Gemini (`GEMINI_API_KEY`), Ollama (local, no key).
Cluub is bring-your-own-key: it never ships or proxies a key. Developers add keys with `cluub ai set <provider>` (stored in `.env`); hard-coded keys are a compile error (E401). With `aiKeys "user"` each end user's key stays in their browser and is sent only with their requests.

## 9. Spoken (voice / dictation) friendly
Everything is words: "if total is greater than 100", "let price equal…" is written `let price = …`,
"divided by", "plus", "is not empty". Dictated code works with tools like Wispr Flow.
