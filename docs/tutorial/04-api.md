# 4. The api

**Goal:** give the ticket service HTTP endpoints, so the browser (and anything else) can submit, list, start and resolve tickets.

## Why a separate api?

You could imagine pages calling `TicketService` directly. Cluub doesn't allow it, for good reasons:

- The browser and the server are different machines. Something has to turn a click into an HTTP request, and an HTTP request back into a service call, and check the input on the way.
- The api is the **public surface** of your backend. Keeping it thin (one line per route, calling a service) means all decisions stay in the service, where they're easy to test.

So the rule is: pages use apis, apis use services. An [api](/reference/api) does nothing but map HTTP routes to service actions.

## Create the api

Create `api/ticket-api.clb`:

```cluub
api TicketApi at "/api/tickets"
  about "HTTP endpoints for the helpdesk"
  uses TicketService

  get queue at "/"
    return TicketService.queue()

  get one at "/{id}"
    return TicketService.get(id)

  post submit at "/" with customerName: text, customerEmail: email, subject: text, message: text
    return TicketService.submit(customerName, customerEmail, subject, message)

  post start at "/{id}/start"
    return TicketService.start(id)

  post resolve at "/{id}/resolve" with resolution: text
    return TicketService.resolve(id, resolution)
```

## Reading an api

`api TicketApi at "/api/tickets"` sets the **base path**. Every route below it is relative to that.

Each route has the shape:

```text
method name at "path" [with param: type, ...]
  statements
```

- The **method** is `get`, `post`, `put`, `patch` or `delete`.
- The **name** (`queue`, `one`, `submit`, ...) is how pages will call this route in chapter 5, for example `TicketApi.submit(...)`.
- The **path** is joined to the base path. `post resolve at "/{id}/resolve"` answers `POST /api/tickets/7/resolve`.
- `return` sends the value back as JSON. A route that returns nothing answers `204 No Content`.

So the api has these endpoints:

| Method | Path | Does |
|---|---|---|
| GET | `/api/tickets` | the queue |
| GET | `/api/tickets/{id}` | one ticket |
| POST | `/api/tickets` | submit a ticket |
| POST | `/api/tickets/{id}/start` | start working on it |
| POST | `/api/tickets/{id}/resolve` | resolve it |

### Where parameters come from

| Parameter | Comes from |
|---|---|
| `{id}` in the path | the URL. It's always `text` and available by name, as `id` |
| `with` params on `get` and `delete` | the query string, like `?status=open` |
| `with` params on `post`, `put` and `patch` | the JSON body |

Every parameter is **type-checked before your code runs**. If `customerEmail` is missing, or isn't an email address, the request is rejected with `400` and a message that names the field. `TicketService.submit` never sees the bad request.

### Errors become status codes

You didn't write any error handling, and you don't need to. Cluub maps problems to HTTP status codes:

| Problem | Status |
|---|---|
| a missing or wrongly typed parameter, a model rule, `require`, `fail` | 400 (or the status you gave `fail`) |
| `get` on a missing ticket | 404 |
| AI or network problems (chapter 6) | 502 |
| anything unexpected | 500, with details logged on the server and never shown to users in production |

The response body always has the same shape: `{"error": {"message": "...", "code": "...", "field": "..."}}`. See [Services & APIs](/guide/backend).

## Try it

Make sure `cluub dev` is running (start it again if you stopped it). The terminal now says:

```text
✓ Started in 4.8ms (1 pages · 1 apis · 1 services · 1 models)
  http://localhost:3000  · watching for changes · Ctrl+C to stop
```

In a second terminal, submit a ticket with `curl`:

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H 'content-type: application/json' \
  -d '{"customerName":"Ada Lovelace","customerEmail":"Ada@Example.com","subject":"Cannot log in","message":"The login button does nothing when I click it."}'
```

```text
{"id":"1","customerName":"Ada Lovelace","customerEmail":"ada@example.com","subject":"Cannot log in","message":"The login button does nothing when I click it.","priority":"normal","category":"other","status":"open","summary":"","resolution":"","receivedOn":"2026-11-23"}
```

The store gave the ticket `id` `"1"`, the defaults from the model are filled in, the email is lower case and `receivedOn` is today's date (yours will differ). Open <http://localhost:3000/api/tickets> in the browser to see the queue as JSON.

Now send bad input:

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H 'content-type: application/json' \
  -d '{"customerName":"Ada","customerEmail":"nope","subject":"Help","message":"Broken"}'
```

```text
{"error":{"message":"customerEmail must be a valid email address","code":"invalid","field":"customerEmail"}}
```

The api checked the `email` parameter type before calling the service. Fix the email and send it again, and the next rule complains:

```text
{"error":{"message":"subject must be at least 5 characters","code":"invalid","field":"subject"}}
```

That message comes from the `Ticket` model, through the service, out of the api, without a line of glue code.

Now walk ticket 1 through its life:

```bash
curl -X POST http://localhost:3000/api/tickets/1/start
```

```text
{"id":"1", ... ,"status":"in progress", ...}
```

```bash
curl -X POST http://localhost:3000/api/tickets/1/resolve \
  -H 'content-type: application/json' -d '{"resolution":"short"}'
```

```text
{"error":{"message":"The resolution must be at least 10 characters","code":"invalid"}}
```

```bash
curl -X POST http://localhost:3000/api/tickets/1/resolve \
  -H 'content-type: application/json' -d '{"resolution":"Cleared the session cookie"}'
```

```text
{"id":"1", ... ,"status":"resolved","resolution":"Cleared the session cookie", ...}
```

Try to start it again, and ask for a ticket that doesn't exist:

```bash
curl -X POST http://localhost:3000/api/tickets/1/start
curl -i http://localhost:3000/api/tickets/42
```

```text
{"error":{"message":"This ticket is already resolved","code":"failed"}}
HTTP/1.1 404 Not Found
...
{"error":{"message":"Ticket \"42\" was not found","code":"not_found"}}
```

Meanwhile, the `cluub dev` terminal logs every request with its status and time:

```text
POST /api/tickets 200 5ms
GET /api/tickets 200 1ms
POST /api/tickets 400 0ms
POST /api/tickets 400 0ms
POST /api/tickets/1/start 200 1ms
POST /api/tickets/1/resolve 400 1ms
POST /api/tickets/1/resolve 200 1ms
POST /api/tickets/1/start 400 0ms
GET /api/tickets/42 404 0ms
```

Because the store is `saved in "storage/tickets.json"`, open that file and you'll see ticket 1, resolved. Restart `cluub dev` and it's still there. Delete the `storage/` folder whenever you want a clean slate.

## Checkpoint

- `cluub check` prints `✓ No errors`.
- `cluub test` prints `26 passed`. The six new ones are in `tests/generated/api.test.clb`:

```text
tests/generated/api.test.clb
  ✓ TicketApi.queue: responds 0ms
  ✓ TicketApi.submit: says when customerName is missing 0ms
  ✓ TicketApi.submit: says when customerEmail is missing 0ms
  ✓ TicketApi.submit: says when subject is missing 0ms
  ✓ TicketApi.submit: says when message is missing 0ms
  ✓ TicketApi.resolve: says when resolution is missing 0ms
```

  For every route, Cluub sends a request with each required parameter left out and checks for a `400` whose message names that parameter. GET routes without parameters get a "responds with 200" test.
- The `curl` commands above give the responses shown.
- `storage/tickets.json` contains your test ticket.

## Recap

- An **api** maps HTTP routes to service actions: `post submit at "/" with ...`. Keep routes to one line where you can.
- Path parameters like `{id}` are available by name. `with` parameters come from the query string (`get`, `delete`) or the JSON body (`post`, `put`, `patch`).
- Parameters are type-checked before your code runs. Validation, `require` and `fail` give 400, missing items 404, AI and network problems 502.
- Error responses always look like `{"error": {"message", "code", "field"}}`.
- `cluub dev` logs every request; `saved in` stores survive restarts.

Next: [5. Pages, components and a layout](/tutorial/05-pages-and-components), where customers and agents get a real UI.
