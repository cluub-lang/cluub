# service

A `service` holds business logic: the decisions, checks and AI calls of your app. It is a named group of **actions**. Each action takes typed parameters, runs statements, and returns a value. Services reach data through stores, outside APIs through clients, and other logic through other services. Every dependency is declared with `uses`. Apis call services and turn their results and failures into HTTP responses. Services never talk to the UI directly.

## Syntax

```cluub
service OrderService
  about "Placing and tracking orders"
  uses Orders, Customers

  action place(customerId: text, total: number) -> Order
    about "Place a new order for a customer"
    require total > 0, "Total must be more than zero"
    let customer = Customers.get(customerId)
    if customer.plan is "free" and total > 500
      fail "Free accounts can order up to 500" status 403
    return Orders.add(Order(customerId: customer.id, total: total))
```

The full shape:

```text
service Name
  [about "description"]
  [uses Dep1, Dep2, ...]...
  action name[(param: type [= default], ...)] [-> type]
    [about "what this action does"]
    statements...
```

## Members / options

| Member | What it does | Required? | Default |
|---|---|---|---|
| `about "text"` | Describes the service. Missing it gives suggestion W104. | No (suggested) | none |
| `uses A, B` | Declares dependencies: stores, clients and other services. The line can repeat. | No | no dependencies |
| `action name(...)` | Declares an action. Parentheses can be left out when there are no parameters. | No, but a service without actions does nothing | none |
| parameter `p: type` | A typed parameter. The type is optional (`p` alone means `any`). | No | none |
| parameter `= default` | Value used when the caller leaves the parameter out. | No | none |
| `-> type` | Declares what the action returns. | No | none |
| `about` as the first statement | Describes the action (used by `cluub explain`). | No | none |

### Statements in actions

`let`, assignment, `return`, `require cond, "message"`, `fail "message" [status N]`, `if` / `else if` / `else`, `for x in list`, `while`, `try` / `catch name`, `log value`, and expression statements such as `Orders.remove(id)`. See [Statements](/reference/language).

## Behaviour

**Calling.** Apis, other services and tests call an action as `ServiceName.action(...)`, with positional or named values (`OrderService.place(customerId: "1", total: 20)`). Inside the same service, call another action by its bare name: `place("1", 20)`. The compiler checks that the action exists ([E107](/reference/errors#e107)) and that the arguments fit ([E108](/reference/errors#e108)): no unknown names, no extra values, and every parameter without a default or `?` is given.

**Everything is awaited.** Calls to stores, clients, services, own actions, `ask ai` and `sleep` are awaited automatically. Actions run top to bottom; there is no parallelism to manage.

**Failing.**

| Statement | Error | HTTP status in an api |
|---|---|---|
| `require cond, "message"` | `ValidationError` when `cond` is false | 400 (code `invalid`) |
| `fail "message"` | `Fail` | 400 (code `failed`) |
| `fail "message" status 404` | `Fail` | 404 (code `not_found`) |
| `fail "message" status 403` | `Fail` | 403 (code `forbidden`) |
| `fail "message" status N` | `Fail` | N (code `failed`) |
| `Store.get` on a missing id | not found | 404 |
| client or AI problem | `NetworkError` / `AIError` | 502 |
| any other runtime error (for example reading a field of `nothing`) | internal error | 500 |

`try` / `catch problem` catches any of these; `problem.message`, `problem.status` and `problem.field` describe it. A status of 500 or more is logged on the server.

**Parameters are not validated when one service calls another.** Types on action parameters are checked by the compiler (the type name must exist) and documented by `cluub explain`, but values passed from code are not converted or checked at runtime. Validation of user input happens in the api, which checks every route parameter before calling the service, and in models.

**Instances.** One instance of each service exists per running backend; dependencies are created on first use. Services keep no state between calls of their own; keep data in stores.

**Layer rules.** A service may use stores, clients and other services ([E201](/reference/errors#e201) for apis or pages). Using a dependency without listing it in `uses` is [E106](/reference/errors#e106). Services may not depend on each other in a circle ([E202](/reference/errors#e202)). `ask ai` and `env.X` are allowed. `go to` is not ([E201](/reference/errors#e201)), and test statements (`expect`, `render`, `request`, `screen`…) are not ([E120](/reference/errors#e120)).

**Calls inside quick functions.** Calls to a dependency cannot go inside `x => ...` ([E108](/reference/errors#e108): `Calls to Orders can't go inside a quick 'x => ...' function.`). Use a `for` loop.

**Folder and naming.** Services live in `services/` ([E301](/reference/errors#e301)). The service name is PascalCase; action, parameter and `let` names are camelCase ([E103](/reference/errors#e103)).

**Suggestions.** An action with more than 25 statements gives W102; a service with more than 8 actions gives W103; a dependency listed but never used, or listed twice, gives W101.

## Errors

| Code | Message (example) | Fix |
|---|---|---|
| [E012](/reference/errors#e012) | `` `state` is not allowed inside a service. `` (hint: `A service can contain: about, uses, action.`) | Services only have `about`, `uses` and actions. |
| [E103](/reference/errors#e103) | `The action "Place_order" should be camelCase (…)` / `The parameter "P_x" should be camelCase (…)` | Rename. |
| [E104](/reference/errors#e104) | `Unknown dependency "Ordrs".` (hint: `Did you mean "Orders"?`) | Fix the name in `uses`. |
| [E105](/reference/errors#e105) | `I don't know what "totl" is.` / `Unknown type "Ordr".` | Fix the spelling or create the value. |
| [E106](/reference/errors#e106) | `OrderService uses Orders but doesn't declare it.` | Add `uses Orders`. |
| [E107](/reference/errors#e107) | `OrderService has no action "plce".` | Fix the action name. |
| [E108](/reference/errors#e108) | `OrderService.place is missing the value for "total".` / `... takes 2 values but got more.` / `... has no parameter "amount".` | Fix the arguments. |
| [E110](/reference/errors#e110) | `"total" doesn't exist yet.` (hint: ``Create it first with `let total = ...`.``) | Use `let` the first time. |
| [E111](/reference/errors#e111) | `"total" was already created in this block.` | Assign with `total = ...` instead of a second `let`. |
| [E115](/reference/errors#e115) | `Action "place" is defined twice in OrderService.` | Rename one action. |
| [E120](/reference/errors#e120) | `` `expect` can only be used inside a `test`. `` | Move it to a test. |
| [E201](/reference/errors#e201) | `A service service (OrderService) can't use the backend layer directly (OrderApi is an api).` / `` `go to` navigates between pages, so it only works in pages and tests. `` | Depend only on stores, clients and services; return a value instead of navigating. |
| [E202](/reference/errors#e202) | `Services depend on each other in a circle: A → B → A.` | Move the shared logic into a third service. |
| [E301](/reference/errors#e301) | `A service belongs in the "services" folder, but "OrderService" is in api/orders.clb.` | Move it. |
| [E401](/reference/errors#e401) | `This looks like a secret key written directly in the code.` | Use `env.MY_KEY`. |

## Examples

**1. A small service over one store.**

```cluub
model Todo
  title: text, required, min 3
  done: bool = false

store Todos holds Todo

service TodoService
  about "Managing todos"
  uses Todos

  action list() -> list of Todo
    return Todos.all()

  action add(title: text) -> Todo
    require title is not empty, "Give the todo a title"
    return Todos.add(Todo(title: title))

  action toggle(id: text) -> Todo
    let todo = Todos.get(id)
    return Todos.update(id, {done: not todo.done})
```

**2. Rules, statuses and helper actions.**

```cluub
model Account
  email: email, required
  plan: text = "free", one of ["free", "pro"]
  credits: number = 0, min 0

store Accounts holds Account

service BillingService
  about "Credits and plans"
  uses Accounts

  action spend(accountId: text, amount: number) -> Account
    about "Use credits for a paid feature"
    require amount > 0, "Amount must be positive"
    let account = Accounts.get(accountId)
    if account.plan is "free"
      fail "Upgrade to pro to use credits" status 403
    require account.credits >= amount, "Not enough credits"
    return Accounts.update(accountId, {credits: account.credits - amount})

  action topUp(accountId: text, amount: number = 100) -> Account
    let account = Accounts.get(accountId)
    return Accounts.update(accountId, {credits: account.credits + amount})

  action spendAll(accountId: text) -> Account
    let account = Accounts.get(accountId)
    return spend(accountId, account.credits)

test "free accounts cannot spend credits"
  let a = Accounts.add(Account(email: "ada@example.com"))
  expect BillingService.spend(a.id, 5) fails with "Upgrade to pro"

test "spending lowers the balance"
  let a = Accounts.add(Account(email: "ada@example.com", plan: "pro", credits: 10))
  let after = BillingService.spend(a.id, 4)
  expect after.credits is 6
```

**3. A service that combines AI, another service and error handling.**

```cluub
model Ticket
  subject: text, required
  body: text, required
  kind: text = "question", one of ["bug", "feature", "question"]
  summary: text?

store Tickets holds Ticket

service NotifyService
  about "Telling the team about new tickets"
  action send(message: text)
    log message

service TicketService
  about "Support tickets, sorted by AI"
  uses Tickets, NotifyService

  action open(subject: text, body: text) -> Ticket
    about "Open a ticket and let AI classify it"
    require subject is not empty, "Subject is required"
    let kind = ask ai "Is this a bug, a feature request or a question? {body}" as one of ["bug", "feature", "question"]
    let summary = ""
    try
      summary = ask ai "Summarize in one sentence: {body}"
    catch problem
      log "AI summary failed: {problem.message}"
    let ticket = Tickets.add(Ticket(subject: subject, body: body, kind: kind, summary: summary))
    if kind is "bug"
      NotifyService.send("New bug: {subject}")
    return ticket

  action byKind(kind: text) -> list of Ticket
    return Tickets.where(t => t.kind is kind)

test "tickets are classified"
  let t = TicketService.open("Login broken", "I can't sign in")
  expect t.kind is "bug"
  expect TicketService.byKind("bug").count is 1
```

In tests the AI is fake: `as one of [...]` returns the first option, so the ticket is classified as `"bug"`.

## Edge cases & limits

* **Parameter types and `-> type` are not enforced at runtime.** Only api parameters and model creation validate values.
* **No visibility control.** Every action can be called by any api or service that `uses` the service.
* **A later action with the same name** is reported as E115, but if you ignore that, the last definition is the one that runs.
* **No background jobs, schedules or events.** Actions run only when called.
* **No transactions.** If an action adds to one store and then fails, the first change stays.
* **Each `fail` or `require` stops the action** at once; there is no way to collect several messages.
* **Fields of `nothing`** (`customer.name` when `customer` is `nothing`) throw a JavaScript error that becomes a 500. Use `find` and check `is nothing`, or `get` to get a clean 404.

## See also

* [api](/reference/api): exposing actions over HTTP
* [store](/reference/store) and [client](/reference/client)
* [Services & APIs guide](/guide/backend)
* [AI guide](/guide/ai)
* [Error codes](/reference/errors)
