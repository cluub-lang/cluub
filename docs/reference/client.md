# client

A `client` is the network layer: a typed description of an outside HTTP API that your services call by name. You list the base address, any headers, and one line per endpoint. Cluub generates a function for each endpoint that builds the URL, sends the request with `fetch`, parses the JSON answer and turns timeouts and HTTP errors into clear `NetworkError`s. Clients have no body code of their own. In tests they never touch the network.

## Syntax

```cluub
client Weather at "https://api.open-meteo.com/v1"
  about "Free weather forecasts"
  header "User-Agent" "my-app"
  get forecast at "/forecast" with latitude: number, longitude: number, current: text = "temperature_2m"
```

The full shape:

```text
client Name at <base address expression>
  [about "description"]
  [header <name expression> <value expression>]...
  <method> routeName at "/path/{param}" [with param: type [= default], ...] [-> type]
```

`<method>` is one of `get`, `post`, `put`, `patch`, `delete`.

## Members / options

| Member | What it does | Required? | Default |
|---|---|---|---|
| `at <expression>` | Base address. Any text expression, so `env.WEATHER_URL` or `"https://{env.HOST}/v2"` work. A trailing `/` is removed. | Yes | none |
| `about "text"` | Describes the client. | No | none |
| `header <name> <value>` | Adds a header to every request. Both parts are expressions, evaluated on **every** request, so `"Bearer {env.TOKEN}"` reads the current environment. Repeat the line for more headers. | No | none |
| `get` / `post` / `put` / `patch` / `delete` route | Declares one endpoint the service can call as `Client.routeName(...)`. | At least one, in practice | none |
| `at "/path"` on a route | Path added to the base. `{name}` marks a path parameter. Must be plain text. | Yes | none |
| `with p: type, ...` | Extra parameters. A parameter can have a default (`= value`) or be optional (`type?`). | No | no extra parameters |
| `-> type` | Documents what the endpoint returns. | No | none |

## Behaviour

**Calling a route.** A service lists the client in `uses` and calls a route like an action: `Weather.forecast(52.37, 4.89)` or with named values `Weather.forecast(latitude: 52.37, longitude: 4.89)`. The compiler checks the route name ([E107](/reference/errors#e107)) and the arguments ([E108](/reference/errors#e108)). The call is awaited automatically.

**Parameter order.** Path parameters come first, in the order they appear in the path, then the `with` parameters in the order written. A path parameter not listed in `with` has type `text`.

**Where each value goes:**

| Parameter | `get`, `delete` | `post`, `put`, `patch` |
|---|---|---|
| Named in the path (`{id}`) | replaced in the path (URL-encoded) | replaced in the path (URL-encoded) |
| Other `with` parameters | query string `?latitude=52.37` | JSON body `{"latitude": 52.37}` |

**Request.** At runtime, for each call:

1. Each missing argument takes its default. If it is still missing (or `nothing`) and the parameter is not optional, the call fails with a `ValidationError`: `Missing required value "latitude"` (status 400). Optional parameters that are missing are left out of the URL or body.
2. Every given argument is checked against its type with the same rules as model fields, and converted where that is safe (`"52.3"` becomes `52.3` for a `number`). A wrong value fails with a `ValidationError` before anything is sent, for example `latitude must be a number (got "north")`.
3. The URL is `base + path + query`.
4. Headers sent: `accept: application/json`, `content-type: application/json` when there is a body, then your `header` lines (which can override the first two).
5. The request times out after 15 seconds.

**Response.**

* A 2xx answer is parsed as JSON. If it is not JSON, the raw text is returned.
* A non-2xx answer throws a `NetworkError` (status 502, code `network`): `Weather.forecast failed: GET https://api.open-meteo.com/v1/forecast?... returned 503 Service Unavailable (first 120 characters of the body)`.
* A connection failure or timeout throws `Weather.forecast could not reach https://...: timed out after 15s` (or the underlying error message), also status 502.

Inside an api route these errors become a 502 response unless your service catches them with `try` / `catch`.

**In tests,** arguments are still checked (steps 1 and 2), so a wrong argument fails the same way it would in production. Then the call returns `nothing` without sending anything. Tests are fast and offline, so code that reads fields from a client answer must handle `nothing` (see Example 3).

**Layer rules.** Only a `service` may list a client in `uses` ([E201](/reference/errors#e201) for pages and apis). Clients cannot use anything. `env.X` is allowed in clients; `ask ai` has no place in them because clients have no code.

**Folder and naming.** Clients live in `network/` ([E301](/reference/errors#e301)). The client name is PascalCase; route names are camelCase ([E103](/reference/errors#e103)) and unique within the client ([E115](/reference/errors#e115)).

## Errors

| Code | Message (example) | Fix |
|---|---|---|
| [E010](/reference/errors#e010) | ``Expected `at` but found the text "https://…".`` (hint: ``Clients look like `client Weather at "https://api.example.com"`.``) | Write `client Name at "https://..."`. |
| [E010](/reference/errors#e010) | `A path must be plain text like "/todos/{id}".` | Route paths cannot contain expressions other than `{param}`. |
| [E012](/reference/errors#e012) | `` `query` is not allowed inside a client. `` (hint: `A client can contain: about, header, get, post, put, patch, delete.`) | Use one of the listed members. |
| [E012](/reference/errors#e012) | `` `an indented block` is not allowed inside a client. `` | Client routes have no body. Remove the indented code and put logic in a service. |
| [E103](/reference/errors#e103) | `The route "Get_forecast" should be camelCase (…)` | Rename the route. |
| [E105](/reference/errors#e105) | `Unknown type "nmber".` | Fix the parameter type. |
| [E107](/reference/errors#e107) | `Weather has no route "forcast".` (hint: `Did you mean "forecast"?`) | Fix the route name in the call. |
| [E108](/reference/errors#e108) | `Weather.forecast is missing the value for "longitude".` | Pass every required parameter. |
| [E115](/reference/errors#e115) | `Route "forecast" is defined twice in Weather.` | Give each route its own name. |
| [E201](/reference/errors#e201) | `A UI page (Home) can't use the network layer directly (Weather is a client).` | Call the client from a service, expose it with an api. |
| [E301](/reference/errors#e301) | `A client belongs in the "network" folder, but "Weather" is in services/weather.clb.` | Move it to `network/`. |
| [E401](/reference/errors#e401) | `This looks like a secret key written directly in the code.` | Put the key in `.env` and use `env.MY_KEY`. |

## Examples

**1. A public API with query parameters.**

```cluub
client Weather at "https://api.open-meteo.com/v1"
  about "Free weather forecasts"
  header "User-Agent" "cluub-docs"
  get forecast at "/forecast" with latitude: number, longitude: number, current: text = "temperature_2m"

service WeatherService
  about "Current temperature"
  uses Weather

  action now(lat: number, lon: number) -> number
    let data = Weather.forecast(lat, lon)
    return data.current.temperature_2m
```

**2. An authenticated API with path parameters, a body and secrets from `.env`.**

```cluub
client GitHub at "https://api.github.com"
  about "Issues on GitHub"
  header "Authorization" "Bearer {env.GITHUB_TOKEN}"
  header "Accept" "application/vnd.github+json"
  get repo at "/repos/{owner}/{name}"
  get issues at "/repos/{owner}/{name}/issues" with state: text = "open", page: number = 1
  post createIssue at "/repos/{owner}/{name}/issues" with title: text, body: text?

service IssueService
  about "Reporting bugs to GitHub"
  uses GitHub

  action report(title: text, details: text) -> any
    require title is not empty, "A bug report needs a title"
    return GitHub.createIssue(owner: "acme", name: "shop", title: title, body: details)
```

**3. Handling failures and the offline test client.**

```cluub
client Rates at env.RATES_URL
  about "Exchange rates"
  get latest at "/latest" with base: text

service PriceService
  about "Prices in other currencies"
  uses Rates

  action convert(amount: number, currency: text) -> number
    try
      let data = Rates.latest("EUR")
      if data is nothing
        return amount
      return round(amount * data.rates[currency], 2)
    catch problem
      log "Rates unavailable: {problem.message}"
      return amount

test "conversion falls back when there is no rate data"
  expect PriceService.convert(10, "USD") is 10

test "client arguments are checked even in tests"
  expect Rates.latest(nothing) fails with "Missing required value"
```

In the test, `Rates.latest` returns `nothing`, so the service returns the amount unchanged. In production a 503 from the rates API is caught and logged instead of becoming a 502.

## Edge cases & limits

* **`-> type` is not checked or enforced.** The parsed JSON is returned as plain data, not as a model value. Wrap it yourself (`Forecast(...)`) if you want validation.
* **Query values are sent with plain text conversion.** Lists and objects in a query string are not encoded as JSON.
* **Fixed 15-second timeout, no retries, no caching.** Retry in the service with a `while` loop if you need to.
* **JSON only.** There is no form encoding, file upload or streaming.
* **Headers apply to every route** of the client; there are no per-route headers. Make two clients if you need different ones.
* **Tests cannot fake a client answer.** Calls always return `nothing` in tests; there is no way to provide a canned response yet.
* **No authentication helpers** (OAuth flows, signed requests). Pass tokens in headers from `env`.

## See also

* [service](/reference/service): where clients are called
* [api](/reference/api): the same route syntax for your own endpoints
* [Models & data guide](/guide/data#clients-network-layer)
* [Project structure & layers](/guide/structure)
