# AI: classification with `as one of`

## Problem

Support tickets, feedback and emails arrive as free text, and each one needs a **label**: is it a bug, a billing question, a feature request? How urgent is it? Which team should own it? Free-text AI answers ("This seems to be mostly a billing issue, although…") can't drive code. You need an answer that is always one of your options, plus a way for a person to correct it.

## Solution

`ask ai "…" as one of [...]` returns exactly one of the listed strings. Use it once per decision, then let ordinary code do the routing.

**`models/ticket.clb`**

```cluub
model Ticket
  about "A support request, triaged by AI"
  subject: text, required "Add a subject", max 150
  body: text, required "Describe the problem", max 5000
  category: text = "question", one of ["bug", "billing", "feature", "question"]
  priority: text = "normal", one of ["urgent", "normal", "low"]
  team: text = "support"
  status: text = "open", one of ["open", "closed"]
```

**`data/tickets.clb`**

```cluub
store Tickets holds Ticket
  about "All support tickets"
```

**`services/ticket-service.clb`**

```cluub
service TicketService
  about "Takes in support tickets, labels them with AI and routes them to a team"
  uses Tickets

  action submit(subject: text, body: text) -> Ticket
    about "Classify a new ticket and route it"
    require subject is not empty, "Add a subject"
    require body is not empty, "Describe the problem"
    let category = ask ai """
      Which kind of support ticket is this?
      bug: something is broken. billing: payments, invoices or refunds.
      feature: a request for something new. question: anything else.

      Subject: {subject}
      {body}
      """ as one of ["bug", "billing", "feature", "question"]
    let priority = ask ai """
      How urgent is this ticket? urgent: customers are blocked or losing money.
      normal: it matters but there is a workaround. low: a nice-to-have.

      Subject: {subject}
      {body}
      """ as one of ["urgent", "normal", "low"]
    return Tickets.add(Ticket(subject: subject, body: body, category: category, priority: priority, team: teamFor(category)))

  action teamFor(category: text) -> text
    about "Which team owns each kind of ticket"
    if category is "bug"
      return "engineering"
    if category is "billing"
      return "finance"
    if category is "feature"
      return "product"
    return "support"

  action recategorize(id: text, category: text) -> Ticket
    about "A person corrects the AI's label; the team follows"
    require category is one of ["bug", "billing", "feature", "question"], "Unknown category"
    return Tickets.update(id, {category: category, team: teamFor(category)})

  action close(id: text) -> Ticket
    return Tickets.update(id, {status: "closed"})

  action queue() -> list of Ticket
    about "Open tickets, most urgent first"
    let open = Tickets.where(t => t.status is "open")
    let ordered = []
    for level in ["urgent", "normal", "low"]
      for ticket in open.where(t => t.priority is level)
        ordered.add(ticket)
    return ordered
```

**`api/ticket-api.clb`**

```cluub
api TicketApi at "/api/tickets"
  about "Support tickets"
  uses TicketService

  get queue at "/"
    return TicketService.queue()

  post submit at "/" with subject: text = "", body: text = ""
    return TicketService.submit(subject, body)

  post recategorize at "/{id}/category" with category: text
    return TicketService.recategorize(id, category)

  post close at "/{id}/close"
    return TicketService.close(id)
```

**`ui/pages/triage.clb`**

```cluub
page Triage at "/"
  about "Submit tickets and work through the AI-sorted queue"
  title "Support queue"
  uses TicketApi
  state subject = ""
  state body = ""
  state tickets = []

  when loaded
    tickets = TicketApi.queue()

  action submit()
    about "Send a new ticket"
    TicketApi.submit(subject: subject, body: body)
    subject = ""
    body = ""
    tickets = TicketApi.queue()

  action recategorize(id: text, category: text)
    about "Correct the AI's category"
    TicketApi.recategorize(id, category: category)
    tickets = TicketApi.queue()

  action close(id: text)
    TicketApi.close(id)
    tickets = TicketApi.queue()

  view
    heading "Support queue"
    input subject, placeholder "Subject"
    input body, placeholder "What happened?", multiline
    button "Submit ticket", on click submit, style primary, disabled subject is empty or body is empty
    for ticket in tickets
      card
        row
          subheading ticket.subject
          badge ticket.priority
          badge ticket.team
        text ticket.body, style muted
        row
          select ticket.category, options ["bug", "billing", "feature", "question"], on change recategorize(ticket.id, ticket.category)
          button "Close", on click close(ticket.id), style ghost
    if tickets is empty
      text "Inbox zero. Nice."
```

## How it works

* **`as one of [...]` always returns one of the options.** Cluub tells the AI to answer with exactly one option, then matches the reply (ignoring case, quotes and a trailing full stop, and accepting an answer that contains an option). If nothing matches, you get an `AIError` (502) instead of a wrong label.
* **Define the labels in the prompt.** One line per option ("billing: payments, invoices or refunds") makes the boundaries clear and the results consistent.
* **One question per decision.** Category and priority are two separate calls. Each is small and easy to check, and you can change one without touching the other.
* **Code does the routing.** `teamFor(category)` is a plain `if` chain, so the mapping is visible, testable and free. The AI only answers the question code can't.
* **The model guards the labels too.** `category` and `priority` have `one of` rules, so even a manual `Tickets.update` can't store an unknown label.
* **People can correct the AI.** `recategorize` updates the category and the team. In the page, `select ticket.category, …, on change recategorize(ticket.id, ticket.category)` writes the chosen option into `ticket.category` first, then calls the action with it.
* **Ordering without a custom sort.** `queue` walks the priority levels in order and collects matching tickets, which reads like the rule it implements.

## Test it

**`tests/tickets.test.clb`**

```cluub
test "a ticket is classified and routed"
  let ticket = TicketService.submit("App crashes on login", "Since today's update the app closes when I log in.")
  expect ticket.category is "bug"
  expect ticket.priority is "urgent"
  expect ticket.team is "engineering"

test "a person can correct the category and the team follows"
  let ticket = TicketService.submit("Charged twice", "My card was charged twice this month.")
  let fixed = TicketService.recategorize(ticket.id, "billing")
  expect fixed.team is "finance"
  expect TicketService.recategorize(ticket.id, "spam") fails with "Unknown category"

test "the queue puts urgent tickets first and hides closed ones"
  Tickets.add(Ticket(subject: "Dark mode?", body: "Would love a dark theme.", priority: "low"))
  let urgent = TicketService.submit("Checkout is down", "Nobody can pay.")
  expect TicketService.queue().first.id is urgent.id
  TicketService.close(urgent.id)
  expect TicketService.queue().count is 1

test "the page submits and closes tickets"
  render Triage
  type "App crashes on login" into "Subject"
  type "It closes right away." into "What happened?"
  click "Submit ticket"
  expect screen has "engineering"
  click "Close"
  expect screen has "Inbox zero"
```

**The fake AI picks the first option.** In tests, `as one of [...]` always returns the **first** item of the list, so the first test gets `"bug"` and `"urgent"`. Order your options so the first one is a sensible test default, and test the other branches by calling `teamFor` or `recategorize` directly, or by adding tickets to the store as in the third test. Real classification quality needs a check with a real key and a handful of sample tickets.

## Variations and pitfalls

* **A cheaper model for labels.** Classification is easy for small models: `ask ai "…" as one of [...] using "ollama:llama3.2"` or `using "claude:<a smaller model>"`.
* **Add an escape hatch** such as `"unsure"` to the options and send those tickets to a person, instead of forcing a guess.
* **Many labels per item?** `as one of` picks exactly one. For tags, ask `as list of text` or extract a model with several bool fields (see [structured extraction](/cookbook/ai-extraction)).
* **Keep option lists in sync.** The options appear in the model rule, the prompt call and `recategorize`. When you add a category, change all three; the generated model tests will catch a mismatch in the rule.
* **Select changes aren't covered by UI tests.** Tests can `type` and `click` but can't pick a `select` option, so test `recategorize` through the service or with `request post "/api/tickets/1/category"`.

## See also

* [AI guide: classification](/guide/ai#classification-as-one-of)
* [AI: structured extraction](/cookbook/ai-extraction)
* [Reusable components](/cookbook/reusable-components) (to move the ticket card out of the page)
* [Properties & events](/reference/properties-events) (`on change`)
