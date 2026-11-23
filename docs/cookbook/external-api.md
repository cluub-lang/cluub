# Calling an external REST API

## Problem

Your app needs data from someone else's service: weather, exchange rates, a CRM. Outside services are slow, go down, and return shapes you don't control. You want typed calls, a friendly message when the service is unreachable (not a raw URL in a toast), and tests that don't depend on the internet.

## Solution

Describe the outside API with a **client** in `network/`, call it only from a **service**, catch network problems there, and keep the JSON-to-model mapping in its own action so you can test it with hand-made data. This recipe uses the free [Open-Meteo](https://open-meteo.com) APIs, which need no key.

**`network/geocoding.clb`**

```cluub
client Geocoding at "https://geocoding-api.open-meteo.com/v1"
  about "Finds coordinates for a place name"
  header "User-Agent" "cluub-weather-recipe"
  get search at "/search" with name: text, count: number = 1
```

**`network/forecast.clb`**

```cluub
client Forecast at "https://api.open-meteo.com/v1"
  about "Current weather by coordinates"
  header "User-Agent" "cluub-weather-recipe"
  get current at "/forecast" with latitude: number, longitude: number, current: text = "temperature_2m,wind_speed_10m"
```

**`models/reading.clb`**

```cluub
model Reading
  about "The weather right now in one place"
  place: text, required
  temperature: number
  windSpeed: number
  observedAt: text = ""
  stale: bool = false
```

**`data/readings.clb`**

```cluub
store Readings holds Reading
  about "The last good reading for each place, used when the forecast service is down"
```

**`services/weather-service.clb`**

```cluub
service WeatherService
  about "Current weather for a city, from Open-Meteo, with a fallback"
  uses Geocoding, Forecast, Readings

  action current(city: text) -> Reading
    about "Look up a city and return its current weather"
    require city is not empty, "Type a city name"
    let places = Geocoding.search(city.trim())
    if places is nothing
      fail "The weather service sent no data" status 502
    if places.results is empty
      fail "I couldn't find a city called {city}" status 404
    let place = places.results.first
    let placeName = "{place.name}, {place.country}"
    try
      let reading = toReading(placeName, Forecast.current(place.latitude, place.longitude))
      remember(reading)
      return reading
    catch problem
      log "Forecast for {placeName} failed: {problem.message}"
      return lastKnown(placeName)

  action toReading(place: text, data: any) -> Reading
    about "Turn Open-Meteo's JSON into a Reading"
    if data is nothing or data.current is nothing
      fail "The weather service sent no data" status 502
    return Reading(place: place, temperature: data.current.temperature_2m, windSpeed: data.current.wind_speed_10m, observedAt: data.current.time)

  action remember(reading: Reading)
    about "Keep only the latest good reading per place"
    for old in Readings.where(r => r.place is reading.place)
      Readings.remove(old.id)
    Readings.add(reading)

  action lastKnown(place: text) -> Reading
    about "The last good reading for a place, marked as stale"
    let cached = Readings.where(r => r.place is place)
    if cached is empty
      fail "Weather for {place} is unavailable right now" status 503
    return Reading(place: place, temperature: cached.first.temperature, windSpeed: cached.first.windSpeed, observedAt: cached.first.observedAt, stale: true)
```

**`api/weather-api.clb`**

```cluub
api WeatherApi at "/api/weather"
  about "Current weather"
  uses WeatherService

  get current at "/" with city: text = ""
    return WeatherService.current(city)
```

**`ui/pages/weather.clb`**

```cluub
page Weather at "/"
  about "Type a city, see the weather right now"
  title "Weather"
  uses WeatherApi
  state city = ""
  state reading = nothing
  state loading = false
  state problemText = ""

  action look()
    about "Fetch the weather for the typed city"
    loading = true
    problemText = ""
    reading = nothing
    try
      reading = WeatherApi.current(city: city)
    catch problem
      problemText = problem.message
    loading = false

  view
    heading "Weather now"
    row
      input city, placeholder "City, e.g. Lisbon", on enter look
      button "Look up", on click look, style primary, disabled city is empty or loading
    if loading
      spinner
    if problemText is not empty
      card
        text problemText
    if reading is not nothing
      card
        row
          subheading reading.place
          if reading.stale
            badge "last known reading"
        text "{reading.temperature} °C, wind {reading.windSpeed} km/h"
        text "Observed {reading.observedAt}", style muted
```

## How it works

* **A client is a typed description of someone else's API.** `get search at "/search" with name: text, count: number = 1` becomes `GET https://geocoding-api.open-meteo.com/v1/search?name=…&count=1`. On `get` and `delete`, `with` values go into the query string; on `post`/`put`/`patch` they're sent as a JSON body. Defaults such as `count: number = 1` are filled in when you leave them out.
* **Only services may use clients.** The layer rule (page → api → service → client) keeps network code out of the UI and makes it replaceable.
* **Failures become `NetworkError`s.** A timeout (15 s), a refused connection or an HTTP error status turns into a `NetworkError` with status 502 and a message like *"Forecast.current failed: GET https://… returned 503 …"*. If you don't catch it (as with `Geocoding.search` here), Cluub logs that message on the server and answers 502. With `cluub dev` the browser sees the full message; in production it sees *"An outside service is not available right now. Please try again."*
* **Catch where you have a better answer.** If the forecast call fails, the service logs the problem with context (`log "Forecast for … failed: …"`) and returns `lastKnown(placeName)`: the last good reading, marked `stale: true`, which the page shows with a "last known reading" badge. Every good reading is kept by `remember`, one per place.
* **Your own messages reach users; automatic details stay in the log.** Messages you write with `fail` ("I couldn't find a city called …", "The weather service sent no data", "Weather for … is unavailable right now") are always shown, whatever their status. Only automatic problems (a `NetworkError`, an `AIError`, or an unexpected bug) are replaced by a generic message in production, with the details in the server log. So when you want users to read something specific, catch the problem and `fail` with your own words.
* **Check what came back.** Open-Meteo omits `results` when nothing matches; `places.results is empty` is true for a missing field too, so the user gets a 404 *"I couldn't find a city called …"*.
* **Keep the mapping separate.** `toReading(place, data)` turns raw JSON (`data.current.temperature_2m`) into a validated `Reading`. Field names from outside APIs don't have to be camelCase; you read them as they are. Because it doesn't touch the network, you can test it with a hand-written object.
* **The page catches the problem** and shows it in a card instead of a toast, and shows a `spinner` while `loading` is true.

## Test it

**`tests/weather.test.clb`**

```cluub
test "Open-Meteo's JSON becomes a Reading"
  let reading = WeatherService.toReading("Berlin, Germany", {current: {temperature_2m: 21.5, wind_speed_10m: 12, time: "2026-11-23T10:00"}})
  expect reading.temperature is 21.5
  expect reading.windSpeed is 12
  expect reading.stale is false

test "missing data is a clear 502, not a crash"
  expect WeatherService.toReading("Berlin", nothing) fails with "sent no data"
  expect WeatherService.current("Berlin") fails with "sent no data"

test "the last good reading is the fallback"
  WeatherService.remember(Reading(place: "Lisbon, Portugal", temperature: 15.8, windSpeed: 7.1))
  let fallback = WeatherService.lastKnown("Lisbon, Portugal")
  expect fallback.stale is true
  expect fallback.temperature is 15.8
  expect WeatherService.lastKnown("Oslo, Norway") fails with "unavailable right now"

test "the api asks for a city"
  let response = request get "/api/weather"
  expect response.status is 400
  expect response.body.error.message is "Type a city name"

test "the page shows the problem instead of crashing"
  render Weather
  type "Berlin" into "City"
  click "Look up"
  expect screen has "sent no data"
```

**Tests never touch the network.** Inside `cluub test`, every client call returns `nothing`. That's why `WeatherService.current("Berlin")` fails with *"sent no data"* in the test above: it exercises the "no data" branch. The success path is covered by testing `toReading` with a hand-made response, and the fallback by testing `remember` and `lastKnown` directly. There is currently no way to make a client return fake data or throw a `NetworkError` in a test, so the `catch` itself only runs against the real service. Tests run like `cluub dev`, so they see full error messages.

## Variations and pitfalls

* **API keys go in `.env`**, never in code (hard-coded keys are error E401). Read them in the client's header with `env`:

```cluub
client Crm at "https://api.example-crm.com/v2"
  header "Authorization" "Bearer {env.CRM_API_KEY}"
  get contact at "/contacts/{id}"
  post createContact at "/contacts" with name: text, email: text
```

* **Path parameters** work like in your own APIs: `get contact at "/contacts/{id}"` is called as `Crm.contact("42")`.
* **Stale is a choice.** Returning an old reading is right for weather; for prices or stock levels you may prefer to fail. Say which in the `about` line.
* **No retries or caching built in.** If you need a retry, wrap the call in a `while` loop with a counter and `sleep(500)` between attempts, and keep the attempts low: each one can take up to 15 s.
* **Don't call clients in a `.map(x => ...)`.** Calls to dependencies aren't allowed inside quick functions (error E108); use a `for` loop.

## See also

* [Client reference](/reference/client)
* [Models & data: clients](/guide/data#clients-network-layer)
* [Error handling patterns](/cookbook/error-handling)
* [Loading and empty states](/cookbook/loading-empty-states)
