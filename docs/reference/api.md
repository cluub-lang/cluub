# api

An `api` declares HTTP endpoints. Each route has a method, a name, a path and typed parameters, followed by a short body that usually calls one service action. Before the body runs, Cluub reads every parameter from the path, query string or JSON body, converts it to its declared type and rejects bad input with a 400. The route's return value is sent back as JSON. Errors become the right HTTP status automatically. Pages call routes by name (`OrderApi.list()`), and the compiler checks those calls.

## Syntax

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

The full shape:

```text
api Name at "/base/path"
  [about "description"]
  [uses Service1, Service2]...
  <method> routeName at "/path/{param}" [with param: type [= default], ...] [-> type]
    statements...
```

`<method>` is one of `get`, `post`, `put`, `patch`, `delete`.

## Members / options

| Member | What it does | Required? | Default |
|---|---|---|---|
| `at "/base"` | Base path for every route. Plain text; may contain `{param}`. | Yes | none |
| `about "text"` | Describes the api (W104 if missing). | No (suggested) | none |
| `uses S1, S2` | Services this api calls. | No | none |
| route `get name at "/path"` | Declares a route. The full path is the base joined with the route path (`"/api/orders"` + `"/{id}"` = `/api/orders/{id}`; `"/"` means the base itself). | No | none |
| `with p: type` | Extra parameters, read from the query string (`get`, `delete`) or the JSON body (`post`, `put`, `patch`). | No | none |
| `= default` / `type?` | Makes a parameter optional. With a default, the default is used when the value is missing; with `?`, `nothing` is used. | No | required |
| `-> type` | Documents the response type. | No | none |
| route body | Statements that run for each request. `return value` sets the response. | No | empty body (204) |

## Behaviour

### Parameters

| Parameter | Read from | Type |
|---|---|---|
| `{name}` in the base or route path | the URL path (URL-decoded) | `text`, unless the same name is listed in `with` with another type |
| `with` parameter on `get` / `delete` | the query string `?total=5` | as declared |
| `with` parameter on `post` / `put` / `patch` | the JSON body `{"total": 5}` | as declared |

For every parameter, in order (path parameters first, then `with` parameters):

1. A value that is missing, `null` or an empty string counts as missing. If the parameter has a default, the default is used; if it is optional (`?`), it becomes `nothing`; otherwise the request fails with 400 `Missing required value "total"`.
2. The value is checked and converted with the same rules as model fields: `"42"` becomes `42` for `number`, `"true"`/`"yes"`/`"false"`/`"no"` become booleans, `email`, `url` and `date` are format-checked, and an object is turned into a model value (with all its rules) when the type is a model name.
3. A wrong value fails with 400, for example `total must be a number (got "abc")`.

Only when every parameter is valid do the services get created and the body run. Inside the body, parameters are available by name.

### Responses

| What happened | Status | Body |
|---|---|---|
| The body returned a value (including `nothing`) | 200 | the value as JSON (model values become plain objects) |
| The body ended without `return` | 204 | empty |
| A parameter was missing or invalid, a `require` failed, or a model rule broke | 400 | `{"error": {"code": "invalid", "field": "...", "message": "..."}}` |
| `fail "msg"` | 400, or the given `status` | `{"error": {"code": "failed", "message": "msg"}}` (`not_found` for 404, `forbidden` for 403) |
| `Store.get` / `update` / `remove` on a missing id | 404 | `{"error": {"code": "not_found", ...}}` |
| `Store.add` with an id that exists | 409 | `{"error": {"code": "failed", ...}}` |
| A client or AI call failed | 502 | code `network` or `ai` |
| Any other error | 500 | code `internal`; in development (`cluub dev`, tests) the message is `Unexpected error in OrderApi.list: …`; with `cluub start` it is `Something went wrong on the server.` |
| No route matches the path | 404 | `No api route matches GET /api/nope` |
| A route matches the path but not the method | 405 | `POST is not allowed on /api/orders/1. Use GET or DELETE.` |

Errors with status 500 or more are also printed on the server console. In production the server additionally answers 413 for bodies over 1 MB and 400 `Request body must be valid JSON.` for broken JSON.

### Which requests reach the api

The Node server (`cluub dev`, `cluub start`) sends a request to the api dispatcher when its path matches the path of any api route, whatever the method; every other path serves the frontend. So an api `at "/hooks"` works just like one under `/api`. Starting api paths with `/api` is still the convention, because it keeps them apart from page URLs.

### Routing

* Trailing slashes are ignored: `/api/orders/` and `/api/orders` are the same.
* **Fixed segments win over parameters**, whatever the declaration order. With `get one at "/{id}"` and `get stats at "/stats"`, a request for `/api/orders/stats` goes to `stats`, and `/api/orders/7` goes to `one`. This holds across all apis: when several routes match a path, the one with fixed text earliest in the path wins.
* A path parameter matches one path segment (no `/`).
* Two routes with the same method and the same path shape (parameter names ignored, so `/{id}` and `/{key}` are the same) are a compile error ([E115](/reference/errors#e115)), even when they are in different apis.
* When the path matches a route but the method does not, the answer is 405 and lists the methods that would work: `POST is not allowed on /api/orders/stats. Use GET.`

### Calling from pages

A page lists the api in `uses` and calls `OrderApi.place(customerId: "1", total: 20)`. Arguments are matched to the route's parameters in the same order (path parameters, then `with` parameters), checked at compile time ([E107](/reference/errors#e107), [E108](/reference/errors#e108)), sent as path, query or body values, and awaited. An error response is thrown as an error on the page and shown as a toast with the server's message.

### Rules

**Layer rules.** An api may only use services ([E201](/reference/errors#e201) for stores, clients, apis or pages). Using a service without `uses` is [E106](/reference/errors#e106). Keep bodies thin: the logic belongs in the service. `go to` is not allowed ([E201](/reference/errors#e201)); test statements are not allowed ([E120](/reference/errors#e120)). `env.X` and `ask ai` compile in an api, but the convention is to keep them in services.

**Folder and naming.** Apis live in `api/` ([E301](/reference/errors#e301)). The api name is PascalCase; route names are camelCase ([E103](/reference/errors#e103)) and unique within the api ([E115](/reference/errors#e115)).

## Errors

| Code | Message (example) | Fix |
|---|---|---|
| [E010](/reference/errors#e010) | ``Expected `at` but found …`` (hint: ``APIs look like `api TodoApi at "/api/todos"`.``) | Add `at "/api/..."`. |
| [E010](/reference/errors#e010) | `A path must be plain text like "/todos/{id}".` | Use plain text paths; `{name}` only for parameters. |
| [E012](/reference/errors#e012) | `` `fetch` is not allowed inside a api. `` (hint: ``Did you mean `patch`?``) | Use `get`, `post`, `put`, `patch`, `delete`, `about` or `uses`. |
| [E103](/reference/errors#e103) | `The route "List_all" should be camelCase (…)` | Rename. |
| [E104](/reference/errors#e104) | `Unknown dependency "OrderServce".` | Fix the name. |
| [E106](/reference/errors#e106) | `OrderApi uses OrderService but doesn't declare it.` | Add `uses OrderService`. |
| [E107](/reference/errors#e107) | `OrderApi has no route "lst".` (from a page call) | Fix the route name. |
| [E108](/reference/errors#e108) | `OrderApi.place is missing the value for "total".` | Pass every required parameter. |
| [E115](/reference/errors#e115) | `Route "list" is defined twice in OrderApi.` | Rename one route. |
| [E115](/reference/errors#e115) | `AdminApi.find has the same method and path as OrderApi.one (GET /api/orders/{}).` (hint: `Only one route can answer a request; change the path or the method.`) | Change the path or the method of one route. |
| [E201](/reference/errors#e201) | `A backend api (OrderApi) can't use the data layer directly (Orders is a store).` | Call a service instead. |
| [E301](/reference/errors#e301) | `An api belongs in the "api" folder, but "OrderApi" is in services/orders.clb.` | Move it. |

## Examples

**1. A read-only api.**

```cluub
api ProductApi at "/api/products"
  about "Browsing the catalog"
  uses ProductService

  get list at "/" with search: text?
    return ProductService.search(search)

  get one at "/{id}"
    return ProductService.get(id)
```

**2. A full CRUD api with typed parameters and defaults.**

```cluub
model Todo
  title: text, required, min 3
  done: bool = false

store Todos holds Todo

service TodoService
  about "Managing todos"
  uses Todos
  action list(onlyOpen: bool) -> list of Todo
    if onlyOpen
      return Todos.where(t => not t.done)
    return Todos.all()
  action add(title: text) -> Todo
    return Todos.add(Todo(title: title))
  action setDone(id: text, done: bool) -> Todo
    return Todos.update(id, {done: done})
  action remove(id: text)
    Todos.remove(id)

api TodoApi at "/api/todos"
  about "Todo endpoints"
  uses TodoService

  get list at "/" with onlyOpen: bool = false
    return TodoService.list(onlyOpen)

  post add at "/" with title: text
    return TodoService.add(title)

  patch setDone at "/{id}" with done: bool
    return TodoService.setDone(id, done)

  delete remove at "/{id}"
    TodoService.remove(id)

test "adding validates the title"
  let response = request post "/api/todos" with {title: "ab"}
  expect response.status is 400
  expect response.body.error.field is "title"

test "a full round trip"
  let created = request post "/api/todos" with {title: "Buy milk"}
  expect created.status is 200
  let done = request patch "/api/todos/{created.body.id}" with {done: true}
  expect done.body.done is true
  let open = request get "/api/todos?onlyOpen=yes"
  expect open.body is []
  let removed = request delete "/api/todos/{created.body.id}"
  expect removed.status is 204
  let missing = request delete "/api/todos/{created.body.id}"
  expect missing.status is 404
```

**3. Fixed paths, numeric path parameters and model bodies.**

```cluub
model Review
  stars: number, required, min 1, max 5
  comment: text, max 500

store Reviews holds Review

service ReviewService
  about "Product reviews"
  uses Reviews
  action stats() -> any
    let all = Reviews.all()
    return {total: all.count}
  action one(id: number) -> Review
    return Reviews.get(id)
  action add(review: Review) -> Review
    return Reviews.add(review)

api ReviewApi at "/api/reviews"
  about "Reviews"
  uses ReviewService

  get one at "/{id}" with id: number
    return ReviewService.one(id)

  get stats at "/stats"
    return ReviewService.stats()

  post add at "/" with review: Review
    return ReviewService.add(review)

test "fixed paths win over parameters, even when declared later"
  let response = request get "/api/reviews/stats"
  expect response.body.total is 0

test "path parameters can be numbers"
  let response = request get "/api/reviews/abc"
  expect response.status is 400
  expect response.body.error.message is "id must be a number (got \"abc\")"

test "a model body is validated"
  let response = request post "/api/reviews" with {review: {stars: 9, comment: "Great"}}
  expect response.status is 400
  expect response.body.error.message is "stars must be at most 5"
```

## Edge cases & limits

* **An api route hides a page with the same path.** If an api route matches `/orders` and a page is `at "/orders"`, opening `/orders` in the browser gets the api's answer (or a 405) instead of the page. Keep api paths under `/api` to avoid this.
* **The JSON body must be an object.** Parameters are read as `body.name`; a top-level array cannot be received.
* **Lists in the query string are not parsed.** `with tags: list of text` on a `get` fails with `tags must be a list (got "a")`. Use `post` for lists.
* **No headers, cookies, status codes or files** are available to route code: no authentication, no custom response status for success, no file upload or download yet. `fail "..." status N` is the only way to choose a status.
* **No CORS headers** are sent; the frontend is served from the same origin.
* **`-> type` is not enforced.** The returned value is serialised as it is.
* **Tests can call routes by name** (`TodoApi.list()`), with the same parameter checks as HTTP; see [test](/reference/test).

## See also

* [service](/reference/service)
* [page](/reference/page): calling routes from the UI
* [test](/reference/test): `request` in tests
* [Services & APIs guide](/guide/backend)
* [Error codes](/reference/errors)
