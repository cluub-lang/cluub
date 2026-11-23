# Models & data

## Models

A model describes the **shape and rules** of your data. Models validate themselves every time one is created or changed: in services, APIs, stores and tests.

```cluub
model Customer
  about "Someone who buys from us"
  name: text, required, min 2, max 80
  email: email, required "We need an email to send receipts"
  age: number = 0, min 0, max 130
  plan: text = "free", one of ["free", "pro", "team"]
  tags: list of text = []
  company: text?            # optional, may be nothing
  address: Address?         # nested model
```

**Types:** `text`, `number`, `bool`, `email`, `url`, `date`, `id`, `any`, `list of T`, any model name, and `T?` for optional.
**Rules:** `required`, `min N`, `max N` (length for text and lists, value for numbers), `one of [...]`. Add a custom message after any rule.

Create models with named values:

```cluub
let c = Customer(name: "Ada", email: "ada@example.com")
```

Wrong data fails with a precise, user-ready message:

| Code | Message |
|---|---|
| `Customer(name: "A", email: "ada@example.com")` | name must be at least 2 characters |
| `Customer(name: "Ada")` | We need an email to send receipts *(the custom `required` message)* |
| `Customer(name: "Ada", email: "nope")` | email must be a valid email address *(a custom message only replaces the rule it follows)* |
| `Customer(nme: "Ada")` | Customer has no field "nme". Did you mean "name"? |

## Stores (data layer)

A store keeps models. Swap where it saves without touching any service.

```cluub
store Customers holds Customer                               # in memory
store Orders holds Order saved in "storage/orders.json"      # JSON file
```

| Method | Does |
|---|---|
| `all()` | every item |
| `find(id)` | the item, or `nothing` |
| `get(id)` | the item, or fails with 404 *"Customer "7" was not found"* |
| `add(item)` | saves, assigns an `id`, returns the saved item |
| `update(id, changes)` | merges and re-validates |
| `remove(id)` | deletes (404 if missing) |
| `where(c => c.plan is "pro")` | filter |
| `count()`, `clear()` | |

Stores return **copies**, so you can't accidentally change saved data without `update`.

## Clients (network layer)

Call outside APIs with the same route syntax as your own APIs:

```cluub
client Weather at "https://api.open-meteo.com/v1"
  header "User-Agent" "my-app"
  get forecast at "/forecast" with latitude: number, longitude: number, current: text = "temperature_2m"
```

```cluub
service WeatherService
  uses Weather
  action now(lat: number, lon: number) -> number
    let data = Weather.forecast(lat, lon)
    return data.current.temperature_2m
```

Timeouts (15 s) and HTTP errors become precise `NetworkError`s: *"Weather.forecast failed: GET https://… returned 503 Service Unavailable"*. In tests, clients never touch the network.
