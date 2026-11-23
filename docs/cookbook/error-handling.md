# Error-handling patterns

## Problem

Things go wrong in different ways: the input is invalid, the item doesn't exist, a business rule says no ("sold out"), an outside service is down, or there's a bug. Each case deserves a different HTTP status and a different reaction in the UI. You want a small set of patterns that cover them all without try/catch everywhere.

## Solution

Use the right tool for each kind of problem: `require` for input, model rules for data, `get` for "must exist", `fail … status` for business rules, and `try … catch problem` only where you want to react differently from the default. Here they are together in a small event-booking app.

**`models/event.clb`**

```cluub
model Event
  about "Something people can book seats for"
  name: text, required, max 100
  capacity: number, min 1
  booked: number = 0, min 0
```

**`models/booking.clb`**

```cluub
model Booking
  about "Seats someone booked for an event"
  eventId: text, required
  email: email, required "We need an email for the confirmation"
  seats: number = 1, min 1, max 10
```

**`data/events.clb`**

```cluub
store Events holds Event
  about "Events with their capacity"
```

**`data/bookings.clb`**

```cluub
store Bookings holds Booking
  about "All bookings"
```

**`services/booking-service.clb`**

```cluub
service BookingService
  about "Booking and cancelling seats, with a clear error for every case"
  uses Events, Bookings

  action event(id: text) -> Event
    return Events.get(id)

  action book(eventId: text, email: text, seats: number) -> Booking
    about "Book seats if there are enough left"
    require seats >= 1, "Book at least one seat"
    require seats <= 10, "You can book at most 10 seats at once"
    let event = Events.get(eventId)
    let left = event.capacity - event.booked
    if left is 0
      fail "{event.name} is sold out" status 409
    if seats > left
      fail "Only {left} seats left for {event.name}" status 409
    let booking = Bookings.add(Booking(eventId: eventId, email: email, seats: seats))
    Events.update(eventId, {booked: event.booked + seats})
    return booking

  action cancel(bookingId: text)
    about "Give the seats back"
    let booking = Bookings.find(bookingId)
    if booking is nothing
      fail "That booking doesn't exist or was already cancelled" status 404
    let event = Events.get(booking.eventId)
    Events.update(event.id, {booked: event.booked - booking.seats})
    Bookings.remove(bookingId)

  action availability(eventId: text) -> text
    about "A short availability line that never fails"
    try
      let event = Events.get(eventId)
      return "Seats left: {event.capacity - event.booked}"
    catch problem
      log problem.message
      return "Availability unknown"
```

**`api/booking-api.clb`**

```cluub
api BookingApi at "/api/events"
  about "Events and bookings"
  uses BookingService

  get event at "/{id}"
    return BookingService.event(id)

  post book at "/{id}/bookings" with email: text = "", seats: number = 1
    return BookingService.book(id, email, seats)

  delete cancel at "/bookings/{bookingId}"
    BookingService.cancel(bookingId)
```

**`ui/pages/book-event.clb`**

```cluub
page BookEvent at "/events/{id}"
  about "Book seats; sold-out messages appear on the page, other errors as a toast"
  title "Book seats"
  uses BookingApi
  state event = nothing
  state email = ""
  state seats = 1
  state message = ""
  state problemText = ""

  when loaded
    event = BookingApi.event(id)

  action book()
    about "Try to book and explain what happened"
    message = ""
    problemText = ""
    try
      let booking = BookingApi.book(id, email: email, seats: seats)
      message = "Booked {booking.seats} seat(s). The confirmation goes to {booking.email}."
    catch problem
      if problem.status is 409
        problemText = problem.message
      else
        fail problem.message
    event = BookingApi.event(id)

  view
    if event is nothing
      spinner
    else
      heading event.name
      text "{event.capacity - event.booked} of {event.capacity} seats left", style muted
      row
        input email, placeholder "you@example.com", type "email"
        input seats, placeholder "Seats", type "number"
        button "Book", on click book, style primary, disabled email is empty
      if problemText is not empty
        card
          text problemText
      if message is not empty
        card
          text message
```

## How it works

| Situation | Write | Status | Example message |
|---|---|---|---|
| Bad input to an action | `require cond, "message"` | 400 | *Book at least one seat* |
| Data breaks a model rule | nothing, the model checks it | 400 + `field` | *We need an email for the confirmation* |
| Wrong type at the API | nothing, `with seats: number` checks it | 400 + `field` | *seats must be a number (got "abc")* |
| Item must exist | `Events.get(id)` | 404 | *Event "99" was not found* |
| Business rule says no | `fail "…" status 409` | your status | *Cluub meetup is sold out* |
| Outside API or AI down | nothing | 502 | *Forecast.current failed: …* (dev); a generic message in production |
| A bug | nothing | 500 | *Something went wrong on the server.* |

* **Validate before side effects.** `book` checks the seat count, the event and the seats left, then creates the booking (which validates the email), and only then updates `booked`. If the email is invalid, nothing has changed yet.
* **`find` vs. `get`.** `get` fails with a generic 404 for you. `cancel` uses `find`, which returns `nothing`, so it can fail with its own message.
* **`try … catch problem` for fallbacks.** `availability` should never break a page, so it catches any problem, logs `problem.message` for the developer, and returns a neutral text. `problem.status`, `problem.message` and `problem.field` describe what went wrong.
* **The UI default is a toast.** Any error from an API call that you don't catch appears as a toast with the server's message. In `when loaded`, a missing event (404) simply shows that toast.
* **Catch only what you expect.** `book` catches the 409 and shows it in a card, because "sold out" is a normal outcome, not an error. For everything else, `fail problem.message` re-raises it as the usual toast.
* **Statuses are stable.** Tests and other clients can rely on them: 400 means "fix your input", 404 "doesn't exist", 409 "conflicts with the current state".

## Test it

**`tests/booking.test.clb`**

```cluub
test "booking reduces the seats left"
  let event = Events.add(Event(name: "Cluub meetup", capacity: 3))
  BookingService.book(event.id, "ada@example.com", 2)
  expect BookingService.availability(event.id) is "Seats left: 1"

test "each kind of problem has its own status"
  let event = Events.add(Event(name: "Cluub meetup", capacity: 2))
  let tooFew = request post "/api/events/{event.id}/bookings" with {email: "ada@example.com", seats: 0}
  expect tooFew.status is 400
  let badEmail = request post "/api/events/{event.id}/bookings" with {email: "nope", seats: 1}
  expect badEmail.status is 400
  expect badEmail.body.error.field is "email"
  let missing = request post "/api/events/99/bookings" with {email: "ada@example.com", seats: 1}
  expect missing.status is 404
  let tooMany = request post "/api/events/{event.id}/bookings" with {email: "ada@example.com", seats: 3}
  expect tooMany.status is 409
  expect tooMany.body.error.message is "Only 2 seats left for Cluub meetup"

test "a failed booking changes nothing"
  let event = Events.add(Event(name: "Cluub meetup", capacity: 2))
  expect BookingService.book(event.id, "nope", 1) fails with "valid email"
  expect BookingService.availability(event.id) is "Seats left: 2"

test "cancelling twice says so"
  let event = Events.add(Event(name: "Cluub meetup", capacity: 2))
  let booking = BookingService.book(event.id, "ada@example.com", 2)
  BookingService.cancel(booking.id)
  expect BookingService.cancel(booking.id) fails with "already cancelled"
  expect BookingService.availability(event.id) is "Seats left: 2"

test "availability falls back instead of failing"
  expect BookingService.availability("99") is "Availability unknown"

test "sold out is shown on the page, not as a toast"
  Events.add(Event(name: "Cluub meetup", capacity: 1, booked: 1))
  render BookEvent
  type "ada@example.com" into "you@example.com"
  click "Book"
  expect screen has "Cluub meetup is sold out"
```

`expect … fails with "text"` passes when the call fails with a message *containing* that text. `request` returns `status` and `body`, so you can check the exact status and `body.error.field`.

## Variations and pitfalls

* **Re-raise with the same status:** `fail problem.message status problem.status` passes a problem on unchanged after logging it.
* **`fail` stops the action.** Reset loading flags *before* `fail` in a page, or the button stays disabled (see [Loading and empty states](/cookbook/loading-empty-states)).
* **Don't catch and ignore.** An empty `catch` hides bugs. At least `log problem.message`.
* **Your own messages reach users; automatic details stay in the log.** Everything you write yourself (`require`, model rule messages, `fail "…"` with any status, including 503) is shown to users as written. Automatic problems are different: in production, an outside API failure shows *"An outside service is not available right now. Please try again."*, an AI failure *"The AI service is not available right now. Please try again."*, and a bug *"Something went wrong on the server."*, with the full details in the server log. With `cluub dev` and in tests you see the real message.
* **No transactions.** JSON and memory stores don't roll back. If two writes must happen together, do every check first and write last, as `book` does.
* **Runtime errors point at generated JavaScript**, not your `.clb` line, for now; source maps are on the [roadmap](/reference/roadmap).

## See also

* [Errors & suggestions](/guide/errors)
* [Services & APIs: handling problems](/guide/backend#handling-problems)
* [Forms with validation](/cookbook/forms-validation) (`problem.field` next to inputs)
* [Calling an external REST API](/cookbook/external-api) (network errors)
* [Error code reference](/reference/errors)
