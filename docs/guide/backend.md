# Services & APIs

## Services: where decisions live

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

* `require cond, "message"` stops with a **400** and that message if the condition is false.
* `fail "message"` stops with a 400 (or any `status`).
* Every call to a store, client, service or AI is awaited for you. There's no `async`/`await` to learn.
* `about` lines feed `cluub explain` and the generated docs for POs and BAs.

### Handling problems

```cluub
try
  let rate = Rates.today(currency)
  return total * rate.value
catch problem
  log problem.message
  return total
```

`problem.message`, `problem.status` and `problem.field` describe what went wrong.

## APIs: thin HTTP endpoints

```cluub
api OrderApi at "/api/orders"
  about "Order endpoints"
  uses OrderService

  get list at "/"
    return OrderService.all()

  get one at "/{id}"
    return OrderService.get(id)

  post place at "/" with customerId: text, total: number
    return OrderService.place(customerId, total)

  delete cancel at "/{id}"
    OrderService.cancel(id)
```

| Where values come from | |
|---|---|
| `{id}` in the path | always |
| `with` params on `get` / `delete` | the query string `?total=5` |
| `with` params on `post` / `put` / `patch` | the JSON body |

Cluub checks every parameter **before** your code runs:

```json
POST /api/orders {"total": "abc"}
400 {"error": {"code": "invalid", "field": "total", "message": "total must be a number (got \"abc\")"}}
```

Errors map to status codes automatically: validation → 400, `fail` → 400 (or its status), `get` on a missing item → 404, AI or network problems → 502, and anything unexpected → 500 with the details logged on the server, never leaked to users in production.

## How pages call APIs

![What happens when a user clicks a button: page action, server validation, service rules, store, JSON response, state update, re-render; failures become a toast](/diagrams/request-flow.svg)

The page names the api and the route. Cluub generates a typed client, so a wrong route name or argument is a **compile error**, not a runtime 404:

```cluub
page Orders at "/orders"
  uses OrderApi
  state orders = []
  when loaded
    orders = OrderApi.list()
  view
    for order in orders
      text "Order {order.id}: {order.total}"
```
