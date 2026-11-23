# Runtime errors

When something goes wrong while a Cluub app runs, the error carries an HTTP status, a short code and a plain-English message. The same error travels from a store or service, through the api as JSON, into the page, where it appears as a toast. This page describes every error kind and every place it shows up.

Compile-time errors (E001 to E401) are listed in [Error codes](/reference/errors).

## Error kinds

| Kind | Status | `code` | Raised by |
|---|---|---|---|
| Validation error | 400 | `invalid` | `require`, model and parameter validation, `number(x)` |
| Fail | given (default 400) | `not_found` (404), `forbidden` (403), otherwise `failed` | `fail "..." status N`, adding a store item whose id exists (409) |
| Not found | 404 | `not_found` | store `get`, `update`, `remove` with an unknown id |
| Network error | 502 | `network` | `client` routes that cannot connect, time out, or get an error status |
| AI error | 502 | `ai` | `ask ai` (see [Ask AI](/reference/ask-ai#ai-errors)) |
| AI key required | 401 | `ai_key_required` | `ask ai` when the app sets `aiKeys "user"` and the request carries no end-user key. Always shown to the user (see [Your own AI keys](/guide/ai-keys)). |
| Api error | the response status | the server's `code`, else `api` | pages, when an api call answers 400 or above |
| Program error | 500 | `internal` | anything else: reading a field of `nothing`, calling a method that doesn't exist |

Validation errors also carry `field`: the field or parameter that failed (absent for `require`).

## The JSON error body

Every api error response has the same shape:

```json
{
  "error": {
    "message": "title is required",
    "code": "invalid",
    "field": "title"
  }
}
```

`field` is only present when known. Successful responses are the returned value as JSON (status 200), or an empty **204** when the route returns nothing.

### Examples

```cluub
model Todo
  title: text, required, min 2

store Todos holds Todo

service TodoService
  uses Todos
  action get(id: text) -> Todo
    return Todos.get(id)
  action rename(id: text, title: text) -> Todo
    require title is not "admin", "That title is reserved"
    return Todos.update(id, {title: title})
  action archive(id: text)
    fail "Archiving is not available yet" status 501

api TodoApi at "/api/todos"
  uses TodoService
  get one at "/{id}"
    return TodoService.get(id)
  put rename at "/{id}" with title: text
    return TodoService.rename(id, title)
  post archive at "/{id}/archive"
    TodoService.archive(id)
```

With one stored todo whose id is `"1"`:

| Request | Status | Body `error` |
|---|---|---|
| `GET /api/todos/9` (no such todo) | 404 | `{"message": "Todo \"9\" was not found", "code": "not_found"}` |
| `PUT /api/todos/1` with `{}` | 400 | `{"message": "Missing required value \"title\"", "code": "invalid", "field": "title"}` |
| `PUT /api/todos/1` with `{"title": "a"}` | 400 | `{"message": "title must be at least 2 characters", "code": "invalid", "field": "title"}` |
| `PUT /api/todos/1` with `{"title": "admin"}` | 400 | `{"message": "That title is reserved", "code": "invalid"}` |
| `POST /api/todos/1/archive` | 501 | `{"message": "Archiving is not available yet", "code": "failed"}` |

## Development vs production messages

Messages you wrote yourself are meant for users and are always sent as written, in every mode and at every status: validation errors, `require`, not found, and every `fail` (codes `failed`, `not_found`, `forbidden`), including `fail "..." status 503`. Errors Cluub raises automatically on the server's side may contain details from outside services or from your code, so under `cluub start` they stay in the server log and the browser gets a generic message:

| Error | `cluub dev`, `cluub test` | `cluub start` (production) |
|---|---|---|
| Program error (code `internal`) | `Unexpected error in TodoApi.one: Cannot read properties of null (reading 'title')` | `Something went wrong on the server.` |
| AI error (code `ai`) | the full AI error message | `The AI service is not available right now. Please try again.` |
| Network error (code `network`) | the full client error message | `An outside service is not available right now. Please try again.` |
| `fail ... status 5xx` (code `failed`) | your message | your message (unchanged) |

The status and `code` are the same in both modes; for the three replaced kinds only `message` changes. To give users a specific message for an AI or network failure in production, catch it in a service and `fail` with your own text, for example `fail "Translation is busy, try again in a minute" status 503`.

The server terminal logs each api request as `METHOD /path STATUS 12ms` (coloured unless `NO_COLOR` is set or the output is not a terminal). Errors with status 500 or above, and program errors, are also logged as `✗ TodoApi.one: <message>`; in development, program errors include three lines of stack trace. Errors below 500 are not logged as failures.

## Routing errors

The server treats a request as an api request when its path matches the path of any api route, whatever the api's base path (`/api/...`, `/v1/...`, ...). A trailing slash is ignored (`/api/todos/1/` matches `/api/todos/{id}`). Static path segments are matched before `{param}` segments, so `get stats at "/stats"` wins over `get one at "/{id}"` for `/api/todos/stats`.

| Situation | Status | Body |
|---|---|---|
| The path matches, the method doesn't | 405 | `{"error": {"code": "method", "message": "DELETE is not allowed on /api/todos/1. Use GET or PUT."}}` |
| The address cannot be decoded (bad `%` escapes) | 400 | `{"error": {"code": "bad_url", "message": "The request address is not valid."}}` |

The 405 message lists every method that is allowed on that path.

A path that matches no api route is not an api request: it serves a static file from the build, or falls back to the app's `index.html`. The browser router then shows the matching page, or a built-in **Page not found** screen: `Nothing lives at /path.` with a **Go home** link. The JSON 404 `{"error": {"code": "not_found", "message": "No api route matches GET /api/nope"}}` is what `request` returns in tests for an unknown path.

## Startup errors

JSON file stores (`store X holds Y saved in "storage/x.json"`) are loaded when the server starts. If a data file cannot be read or parsed, the server does not start and prints:

```text
Could not load storage/x.json for store X: <JSON parse error>. Fix the file, or move it away to start empty.
```

A missing file is not an error: the store starts empty.

## Request body errors

For `POST`, `PUT` and `PATCH` api requests (bodies of `GET`, `HEAD` and `DELETE` are not read):

| Situation | Status | Body |
|---|---|---|
| Body larger than 1,000,000 bytes | 413 | `{"error": {"code": "too_large", "message": "Request body is larger than 1 MB."}}` |
| Non-empty body without `Content-Type: application/json` | 415 | `{"error": {"code": "bad_content_type", "message": "Send the request body as JSON with the header Content-Type: application/json."}}` |
| Body is not valid JSON | 400 | `{"error": {"code": "bad_json", "message": "Request body must be valid JSON."}}` |
| Empty body | (no error) | treated as no values; required parameters then report `Missing required value "..."` |

Requiring the JSON content type also protects against cross-site request forgery: browsers cannot send it from another site without permission. Pages built with Cluub always send it.

## Network errors (clients)

Calls to a `client` route fail with a network error (502, code `network`) when:

| Situation | Message |
|---|---|
| Connection fails | `Weather.forecast could not reach https://api.example.com/forecast?...: <reason>` |
| No answer within 15 seconds | `Weather.forecast could not reach <url>: timed out after 15s` |
| The service answers with an error status | `Weather.forecast failed: GET <url> returned 503 Service Unavailable (<first 120 characters of the body>)` |
| A required parameter is `nothing` | `Missing required value "latitude"` (validation error, 400) |
| A parameter has the wrong type | `latitude must be a number (got "abc")` (validation error, 400; numeric and yes/no text is converted first) |

A successful response is parsed as JSON when possible, otherwise returned as text. In tests, client routes never touch the network and return `nothing`.

## `catch problem`

`try` / `catch` catches every error. The caught value has:

| Field | Value |
|---|---|
| `problem.message` | the message text |
| `problem.status` | the HTTP status (`400`, `404`, `502`, ...; `500` for program errors) |
| `problem.code` | `invalid`, `failed`, `not_found`, `forbidden`, `network`, `ai`, `internal`, or the code from an api response |
| `problem.field` | the failing field for validation errors, else `nothing` |

```cluub
service Lookup
  uses Todos
  action titleOf(id: text) -> text
    try
      let todo = Todos.get(id)
      return todo.title
    catch problem
      if problem.status is 404
        return "(deleted)"
      fail problem.message status problem.status
```

In a page, errors from api calls arrive with the server's status, code, field and message:

```cluub
page Rename at "/rename/{id}"
  uses TodoApi
  state title = ""
  state warning = ""
  action save()
    try
      TodoApi.rename(id, title)
      warning = ""
    catch problem
      if problem.field is "title"
        warning = problem.message
      else
        fail problem.message
  view
    input title, placeholder "Title"
    button "Save", on click save
    if warning is not empty
      text warning, style danger
```

## How the UI shows errors

Every event handler and `when loaded` runs in a wrapper. If it throws:

* **Cluub errors** (including api errors) show their message in a toast: `<div class="cluub-toast" role="alert">title is required</div>`, placed after the page.
* **Program errors** in the browser show `Something went wrong: <message>` and are logged to the browser console.
* An api error without a message shows `Request failed (<status>)`.

The toast disappears after 5 seconds, when clicked, or on navigation; a new error replaces it. The page re-renders after every handler, whether it failed or not.

If drawing the view itself throws, the page content is replaced with `This page hit an error while drawing: <message>` (class `cluub-crash`) and the error is logged. Member access in views is null-safe, so this is rare.

## Errors in tests

* `expect X fails with "text"` passes for any Cluub error whose message contains the text (ignoring case). A program error fails the expectation: `It failed, but with an unexpected program error instead of a Cluub error: ...`.
* An error not caught by the test fails it with `Unexpected error: <message>`.
* Pages rendered in tests are strict: a program error in a handler, in `when loaded` or while drawing fails the test with `The page crashed: <message>`. Cluub errors only show a toast, which `screen` includes, so `expect screen has "title is required"` works.
* `request` returns error responses as values (`{status, body}`), it does not throw.

## Edge cases & limits

* `fail` accepts any status, including 2xx and 3xx; the response is still an error body. Its message is shown in production at any status, so never put secrets in it.
* A `fail` with status 401 gets code `failed`; only 403 and 404 have dedicated codes.
* Nested model errors name the inner field (`city is required`), not the path (`home.city`).
* Program error messages in development come from JavaScript (`Cannot read properties of null (reading 'title')`).

## See also

* [Statements](/reference/statements) (`require`, `fail`, `try`)
* [Types](/reference/types) (validation messages)
* [Ask AI](/reference/ask-ai)
* [Error codes](/reference/errors)
* [Errors guide](/guide/errors)
