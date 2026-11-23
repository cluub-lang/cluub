# 6. AI features

**Goal:** let AI triage every new ticket (priority, category and a one-line summary), and let agents turn a pasted email into a ticket. Along the way you'll use all three forms of `ask ai`.

## `ask ai` in one minute

AI in Cluub is a single expression:

```text
let reply = ask ai "Any prompt, with {values} inserted"
let kind = ask ai "Bug or feature? {report}" as one of ["bug", "feature"]
let contact = ask ai "Extract the contact from: {email}" as Contact
```

- Plain `ask ai` returns text.
- `as one of [...]` returns **exactly one** of the options, never free text.
- `as SomeModel` returns a real, **validated** model.

`ask ai` is only allowed in services (error **E204** in a page or component), so your API keys stay on the server and the UI stays simple. Every call is awaited for you. See [ask ai](/reference/ask-ai) and the [AI guide](/guide/ai).

## Choose a provider

Replace `app.clb` with:

```cluub
app Helpdesk
  about "Customers submit support tickets, AI triages them, agents resolve them"
  port 3000
  ai "claude"
```

`ai "claude"` picks the default provider. You can also use `"openai"`, `"gemini"` or `"ollama"` (local models, no key), or name a model, like `"claude:claude-sonnet-5-5"`. The `about` line is used by `cluub explain` in chapter 8.

The blank template came with a `.env.example` that lists the keys Cluub understands. Copy it to `.env` and set the one for your provider:

```bash
cp .env.example .env
```

```text
ANTHROPIC_API_KEY=your-key-here
```

`.env` is already in `.gitignore`. Never put a key in a `.clb` file: the compiler recognizes keys that look real and stops with error **E401**.

No key? That's fine. Everything in this chapter still compiles, every test still passes (tests never call a real AI), and you'll see below that the helpdesk keeps working without AI.

## A service for AI

Triage is its own job, so give it its own service. Create `services/triage-service.clb`:

```cluub
service TriageService
  about "Uses AI to sort, summarize and read support tickets"

  action priority(subject: text, message: text) -> text
    about "Decide how urgent a ticket is"
    return ask ai """
      You triage support tickets for a software company.
      How urgent is this ticket? Urgent means customers cannot work or are losing money.
      Subject: {subject}
      Message: {message}
      """ as one of ["low", "normal", "high", "urgent"]

  action category(subject: text, message: text) -> text
    about "Decide which team should handle a ticket"
    return ask ai "Which team should handle this support ticket? Subject: {subject}. Message: {message}" as one of ["billing", "technical", "account", "other"]

  action summarize(subject: text, message: text) -> text
    about "Summarize a ticket in one sentence for busy agents"
    return ask ai """
      Summarize this support ticket in one short sentence for a busy support agent.
      Subject: {subject}
      Message: {message}
      """

  action readEmail(rawEmail: text) -> TicketDraft
    about "Find the customer, subject and problem in a pasted email"
    return ask ai "Read this customer email and extract the customer's name, their email address, a short subject and the problem they describe: {rawEmail}" as TicketDraft
```

### Classification with `as one of`

`priority` and `category` use `as one of [...]`. Cluub tells the model to answer with one of the options and checks the answer. If the model rambles ("I'd say this is probably urgent."), Cluub still finds `urgent`; if it answers something that isn't an option at all, the call fails with an `AIError` instead of letting garbage into your data. The options are exactly the values the `Ticket` model allows, so the result always passes validation.

Long prompts use `"""triple quotes"""`. The indentation inside is removed, and `{subject}` inserts values just like in normal text.

### Text with plain `ask ai`

`summarize` returns whatever the model writes. That's right for a summary, which is free text by nature.

### Structured extraction with `as Model`

`readEmail` returns a `TicketDraft`, a model we haven't written yet. Create `models/ticket-draft.clb`:

```cluub
model TicketDraft
  about "The parts of a customer email that a ticket needs"
  customerName: text, required, min 2, max 80
  customerEmail: email, required
  subject: text, required, min 5, max 120
  message: text, required, min 10, max 2000
```

With `as TicketDraft`, Cluub sends the model the exact JSON shape (field names, types and allowed values), parses the reply, **validates it with the model's rules**, and retries once with the error if it doesn't fit. You get a real `TicketDraft`, or a clear `AIError`. You never parse JSON yourself. (`as list of TicketDraft` works too.)

Why a separate model instead of `as Ticket`? A `Ticket` also has a status, priority, summary and resolution, and we don't want the AI to invent those from an email. The draft contains exactly what we want extracted.

## Use triage in the ticket service

Now call the triage service when a ticket is submitted, and add an action to import an email. Replace `services/ticket-service.clb` with:

```cluub
service TicketService
  about "Business rules for submitting, working on and resolving tickets"
  uses Tickets, TriageService

  action submit(customerName: text, customerEmail: email, subject: text, message: text) -> Ticket
    about "Submit a new ticket and let AI triage it"
    let ticket = Ticket(customerName: customerName.trim(), customerEmail: customerEmail.lower(), subject: subject.trim(), message: message.trim(), receivedOn: today())
    try
      ticket.priority = TriageService.priority(ticket.subject, ticket.message)
      ticket.category = TriageService.category(ticket.subject, ticket.message)
      ticket.summary = TriageService.summarize(ticket.subject, ticket.message)
    catch problem
      log "AI triage skipped: {problem.message}"
    return Tickets.add(ticket)

  action importEmail(rawEmail: text) -> Ticket
    about "Turn a pasted customer email into a ticket"
    require rawEmail is not empty, "Paste the customer's email first"
    let draft = TriageService.readEmail(rawEmail)
    return submit(draft.customerName, draft.customerEmail, draft.subject, draft.message)

  action queue() -> list of Ticket
    about "Tickets that still need work, most urgent first"
    let open = Tickets.where(t => t.status is not "resolved")
    let sorted = []
    for level in ["urgent", "high", "normal", "low"]
      for ticket in open.where(t => t.priority is level)
        sorted.add(ticket)
    return sorted

  action get(id: text) -> Ticket
    about "Look up one ticket by its number"
    return Tickets.get(id)

  action start(id: text) -> Ticket
    about "An agent starts working on a ticket"
    let ticket = Tickets.get(id)
    if ticket.status is "resolved"
      fail "This ticket is already resolved"
    return Tickets.update(id, {status: "in progress"})

  action resolve(id: text, resolution: text) -> Ticket
    about "Close a ticket and record how the problem was solved"
    require resolution is not empty, "Please describe how you solved the problem"
    require resolution.count >= 10, "The resolution must be at least 10 characters"
    let ticket = Tickets.get(id)
    if ticket.status is "resolved"
      fail "This ticket is already resolved"
    return Tickets.update(id, {status: "resolved", resolution: resolution})
```

Only `uses`, `submit` and the new `importEmail` changed. What's going on:

- **Services can use other services.** `uses Tickets, TriageService`. (They may not depend on each other in a circle, error E202.)
- **Validate first, then spend money.** The `Ticket(...)` line runs before any AI call, so a ticket with a bad email never costs you an AI request.
- **`try ... catch problem`** keeps the helpdesk working when the AI doesn't: no key, a provider outage, a rate limit. If any triage call fails, we log why and save the ticket with its defaults (`normal`, `other`, no summary). A customer should never see "AI error" when they ask for help. `problem.message` and `problem.status` describe what went wrong.
- `ticket.priority = ...` changes a field on the local ticket before it's saved.
- **`importEmail`** reads the email with AI, then calls `submit` (an action can call its sibling actions by name), so imported tickets get the same cleanup and triage as tickets from the form. It does *not* catch AI errors: if the AI can't read the email, there's no ticket to save, and the agent should see why.

## Expose the import

Replace `api/ticket-api.clb` with:

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

  post importEmail at "/import" with rawEmail: text
    return TicketService.importEmail(rawEmail)

  post start at "/{id}/start"
    return TicketService.start(id)

  post resolve at "/{id}/resolve" with resolution: text
    return TicketService.resolve(id, resolution)
```

The only new route is `post importEmail at "/import"`.

## The import page

Create `ui/pages/import-email.clb`:

```cluub
page ImportEmail at "/import"
  about "Agents paste a customer email and AI turns it into a ticket"
  title "Import an email"
  layout Main
  uses TicketApi
  state rawEmail = ""
  state created = nothing

  action importEmail()
    about "Create a ticket from a pasted email"
    created = TicketApi.importEmail(rawEmail: rawEmail)
    rawEmail = ""

  view
    heading "Import an email"
    text "Paste an email from a customer. AI finds the name, address, subject and problem."
    input rawEmail, placeholder "Paste the email here", multiline
    button "Create ticket", on click importEmail, style primary, disabled rawEmail is empty
    if created is not nothing
      card
        subheading "Created ticket #{created.id}: {created.subject}"
        text created.summary, style muted
        link "Open the ticket" to "/tickets/{created.id}"
```

Nothing new here: it's the same pattern as the ticket form. Notice that the page has no idea AI is involved; it just calls an api.

Add the page to the navigation. Replace `ui/layouts/main.clb` with:

```cluub
layout Main
  about "The header and footer around every page"
  view
    header
      link "Helpdesk" to "/"
      nav
        link "New ticket" to "/"
        link "Queue" to "/queue"
        link "Import email" to "/import"
    slot
    footer
      text "Helpdesk · built with Cluub"
```

You don't need to touch the queue or the detail page: they already show the priority, category and summary.

## Checkpoint

`cluub check` prints `✓ No errors`, and `cluub test` now prints `48 passed`. Among the new generated tests:

```text
tests/generated/services.test.clb
  ✓ TicketService.submit: works with valid input 0ms
  ✓ TicketService.importEmail: rejects rawEmail = '' 0ms
  ✓ TicketService.importEmail: works with valid input 0ms
  ...
  ✓ TriageService.priority: works with valid input 0ms
  ✓ TriageService.category: works with valid input 0ms
  ✓ TriageService.summarize: works with valid input 0ms
  ✓ TriageService.readEmail: works with valid input 0ms

tests/generated/ui.test.clb
  ...
  ✓ ImportEmail page: renders 2ms
  ✓ Queue page: renders 1ms
```

There's no generated test for the **Create ticket** button: it has a `disabled` rule, so Cluub can't know what makes it clickable, and leaves that test to you.

These run offline in milliseconds because tests use a **fake AI**. Chapter 7 explains exactly what it returns.

In the browser, the header now reads **Helpdesk · New ticket · Queue · Import email**.

**With a key in `.env`** (`cluub dev` notices the new `.env` and rebuilds by itself): submit a ticket such as *"Charged twice: I was charged twice for my March invoice."* In the queue, its badges show the priority and category the AI chose (probably `billing` here), and a grey line under the title shows the AI's one-sentence summary. Open it and the **AI summary** card appears. Urgent tickets now jump to the top of the queue. On **Import email**, paste an email like *"Hi, this is Alan Turing (alan@example.com). Since this morning the export button crashes every time I click it."* and click **Create ticket**: a card shows the new ticket's number, subject and summary, with a link to open it. The exact words depend on the model.

**Without a key**, submit a ticket anyway. It's saved as `normal` / `other` with no summary, and the `cluub dev` terminal explains why:

```text
[log] AI triage skipped: No API key for claude. Run "cluub ai set claude" (or add ANTHROPIC_API_KEY=... to .env). Never put keys in code.
POST /api/tickets 200 3ms
```

Import an email without a key and the page shows a toast with the same message, while the server logs:

```text
✗ TicketApi.importEmail: No API key for claude. Run "cluub ai set claude" (or add ANTHROPIC_API_KEY=... to .env). Never put keys in code.
POST /api/tickets/import 502 1ms
```

That's the "AI or network problem" status from chapter 4. Under `cluub dev` the toast shows the full message so you can fix it; in production (chapter 8) users see a neutral message instead.

## Recap

- `ask ai "..."` returns text; `as one of [...]` returns one of the options; `as Model` returns a validated model (Cluub describes the shape, parses, validates and retries once).
- `ask ai` is only allowed in services; keys live in `.env` and never in code (E401).
- Pick a provider in `app.clb` with `ai "claude"` (or `openai`, `gemini`, `ollama`).
- Put AI in its own service and use it from others with `uses`.
- Validate before calling AI, and use `try ... catch` where the app should keep working without it.

Next: [7. Testing](/tutorial/07-testing), where you write your own tests and learn how the fake AI behaves.
