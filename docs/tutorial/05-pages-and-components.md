# 5. Pages, components and a layout

**Goal:** build the user interface: a shared layout, the ticket form for customers, the queue for agents, and a ticket detail page with a path parameter.

You'll create four files and replace one. This is the longest chapter, but every page follows the same pattern, so by the third one you'll be reading it like a recipe.

## A layout for every page

A [layout](/reference/layout) is the frame around your pages: a header, navigation, a footer. Create `ui/layouts/main.clb`:

```cluub
layout Main
  about "The header and footer around every page"
  view
    header
      link "Helpdesk" to "/"
      nav
        link "New ticket" to "/"
        link "Queue" to "/queue"
    slot
    footer
      text "Helpdesk · built with Cluub"
```

- `header`, `nav` and `footer` are **containers**: their indented children go inside them.
- `link "Queue" to "/queue"` navigates to another page without reloading the browser.
- `slot` marks where the page goes. It's only allowed in a layout (error E013 elsewhere).

A page opts in with one line, `layout Main`.

## The ticket form

Replace `ui/pages/home.clb` with:

```cluub
page Home at "/"
  about "Customers describe their problem and get a ticket number"
  title "Contact support"
  layout Main
  uses TicketApi
  state customerName = ""
  state customerEmail = ""
  state subject = ""
  state message = ""
  state sent = nothing

  action submit()
    about "Send a support ticket"
    sent = TicketApi.submit(customerName: customerName, customerEmail: customerEmail, subject: subject, message: message)
    subject = ""
    message = ""

  view
    heading "Contact support"
    text "Tell us what went wrong and we will reply by email."
    if sent is not nothing
      card
        subheading "Thanks, {sent.customerName}!"
        text "Your ticket number is #{sent.id}. We will reply to {sent.customerEmail}."
    form
      input customerName, placeholder "Your name"
      input customerEmail, placeholder "Your email", type "email"
      input subject, placeholder "Subject"
      input message, placeholder "What happened?", multiline
      button "Submit ticket", on click submit, style primary
```

This is the anatomy of every Cluub [page](/reference/page):

**`uses TicketApi`.** Pages may only use apis. Cluub generates a typed client from `TicketApi`, so `TicketApi.submit(...)` is checked at compile time: a wrong route name (E107) or a wrong parameter name (E108) is a compile error, not a 404 at runtime.

**`state`.** Data that can change while the page is open. `state subject = ""` starts as empty text; `state sent = nothing` starts empty and will hold the saved ticket. When state changes, the view updates. There are no hooks, no `setState` and no re-render code.

**`action`.** What the user can do. `submit()` calls the api, stores the result in `sent`, and clears the subject and message (but keeps the name and email, which is friendlier if the customer writes again). The call to the server is awaited automatically. If the server says no, for example *"customerEmail must be a valid email address"*, the action stops and the message appears as a red **toast** at the bottom of the screen. You don't write any error handling.

**`view`.** A few new elements:

- `input customerName` is **two-way bound** to the state with the same name: typing updates `customerName`, and changing `customerName` updates the box. That's why the action can clear the box with `subject = ""`. An input must be bound to state (error E112 otherwise).
- `placeholder "..."`, `type "email"` and `multiline` (a text area) are **properties**, written after a comma.
- `button "Submit ticket", on click submit, style primary` runs the `submit` action on click. Events are `on click`, `on change`, `on enter` and others. Styles are `primary`, `danger`, `ghost` and `muted`. See [Properties & events](/reference/properties-events).
- `if sent is not nothing` shows the thank-you card only after a ticket was sent. Inside text, `{sent.id}` inserts a value.
- `form` and `card` are containers. A `form` never reloads the page.

## A component for the queue

The queue shows one card per ticket. Instead of writing that card inside the page, make it a [component](/reference/component). Create `ui/components/ticket-row.clb`:

```cluub
component TicketRow
  about "One ticket in the queue"
  takes ticket: Ticket, onStart: action
  view
    card
      row
        badge ticket.priority
        badge ticket.category
        badge ticket.status
      subheading "#{ticket.id} {ticket.subject}"
      text "From {ticket.customerName} on {ticket.receivedOn}"
      if ticket.summary is not empty
        text ticket.summary, style muted
      row
        link "Open" to "/tickets/{ticket.id}"
        if ticket.status is "open"
          button "Start", on click onStart(ticket.id), style ghost
```

`takes ticket: Ticket, onStart: action` lists what the component needs: a ticket to show, and an action to call when someone clicks **Start**. Components have **no state and no dependencies** (error E203 if you add `uses`). They display what they're given, and the page that uses them owns the data. This "smart page, simple component" split keeps components reusable and easy to test.

`onStart(ticket.id)` calls the action the page passed in, with the ticket's id. `row` lays its children out side by side, and `badge` is a small label.

## The queue page

Create `ui/pages/queue.clb`:

```cluub
page Queue at "/queue"
  about "Agents see every ticket that still needs work, most urgent first"
  title "Ticket queue"
  layout Main
  uses TicketApi
  state tickets = []

  when loaded
    tickets = TicketApi.queue()

  action start(id: text)
    about "Start working on a ticket"
    TicketApi.start(id)
    tickets = TicketApi.queue()

  view
    heading "Ticket queue"
    text "{tickets.count} waiting"
    for ticket in tickets
      TicketRow ticket: ticket, onStart: start
    if tickets is empty
      text "No open tickets. Time for a coffee!"
```

- `when loaded` runs when the page opens. Here it fetches the queue.
- `for ticket in tickets` repeats its children once per ticket.
- `TicketRow ticket: ticket, onStart: start` uses the component (components start with a capital letter) and passes the page's `start` action as `onStart`.
- After starting a ticket, the action reloads the queue so the **Start** button disappears and the badge says `in progress`.

## The ticket detail page

The last page shows one ticket. Its URL contains the ticket number, like `/tickets/1`. Create `ui/pages/ticket-detail.clb`:

```cluub
page TicketDetail at "/tickets/{id}"
  about "Everything about one ticket; agents start and resolve it here"
  title "Ticket #{id}"
  layout Main
  uses TicketApi
  state ticket = nothing
  state resolution = ""

  when loaded
    ticket = TicketApi.one(id)

  action start()
    about "Start working on this ticket"
    ticket = TicketApi.start(id)

  action resolve()
    about "Resolve the ticket and record how"
    ticket = TicketApi.resolve(id, resolution: resolution)
    resolution = ""

  view
    if ticket is nothing
      spinner
    else
      link "Back to the queue" to "/queue"
      heading "#{ticket.id} {ticket.subject}"
      row
        badge ticket.priority
        badge ticket.category
        badge ticket.status
      text "From {ticket.customerName} ({ticket.customerEmail}) on {ticket.receivedOn}"
      if ticket.summary is not empty
        card
          label "AI summary"
          text ticket.summary
      card
        text ticket.message
      if ticket.status is "open"
        button "Start working", on click start, style primary
      if ticket.status is "resolved"
        card
          label "Resolution"
          text ticket.resolution
      else
        input resolution, placeholder "How did you solve it?", multiline
        button "Resolve ticket", on click resolve, style primary, disabled resolution is empty
```

New ideas:

- **Path parameters.** `at "/tickets/{id}"` matches `/tickets/1`, `/tickets/42` and so on. Inside the page, `id` is available by name: in the `title`, in `when loaded` and in actions.
- **Loading state.** `ticket` starts as `nothing`, so the page shows a `spinner` until `TicketApi.one(id)` returns. `if ... else` works in views just like in code.
- **Updating from the response.** `start` and `resolve` return the updated ticket, so the actions simply replace `ticket` with the answer and the view follows.
- `disabled resolution is empty` greys out the button until the agent has typed something.
- The **AI summary** card only appears when `ticket.summary` isn't empty. For now it always is; chapter 6 fills it in.

If someone opens `/tickets/99`, `TicketApi.one` fails with 404 and the toast says *Ticket "99" was not found*. The spinner keeps spinning, which is good enough for an internal tool.

## The layer rule in action

Try something that isn't allowed. In `ui/pages/queue.clb`, change `uses TicketApi` to `uses TicketService` and `TicketApi.queue()` in `when loaded` to `TicketService.queue()`. Save:

```text
error E201 ui/pages/queue.clb:5:8
  A UI page (Queue) can't use the service layer directly (TicketService is a service).
   4 |   layout Main
   5 |   uses TicketService
     |        ^^^^^^^^^^^^^
  hint: Pages talk to the backend only through an `api`. Flow: page → api → service → store/client.
```

Pages run in the browser; services run on the server. The compiler won't let you blur that line. Undo the change.

## Checkpoint

`cluub check` prints `✓ No errors`, and `cluub test` prints `28 passed`. The new generated UI tests render each page, and for every button, type sample text into every input, click the button and check that the page didn't crash:

```text
tests/generated/ui.test.clb
  ✓ Home page: renders 1ms
  ✓ Home page: the Submit ticket button works 8ms
  ✓ Queue page: renders 2ms
```

(Pages with path parameters, like `TicketDetail`, aren't generated because Cluub can't know which ticket to show. You'll test it yourself in chapter 7.)

In the browser:

1. <http://localhost:3000> shows the header **Helpdesk · New ticket · Queue**, the heading **Contact support**, four fields and a **Submit ticket** button. The tab is titled "Contact support".
2. Fill in the name `Ada Lovelace`, the email `nope`, the subject `Cannot log in` and a message of at least 10 characters, then click **Submit ticket**. A red toast says *customerEmail must be a valid email address*. (Leave a field empty instead and the toast names that field, for example *Missing required value "subject"*.)
3. Change the email to `ada@example.com` and submit again. A card says **Thanks, Ada Lovelace!** and *Your ticket number is #1. We will reply to ada@example.com.* (If you kept tickets from chapter 4, your number is higher. Delete `storage/` to start over.)
4. Click **Queue**. You see **1 waiting** and a card with the badges `normal`, `other` and `open`, the title **#1 Cannot log in**, *From Ada Lovelace on* today's date, and **Open** and **Start**.
5. Click **Start**. The badge changes to `in progress` and the **Start** button disappears.
6. Click **Open**. The address is `/tickets/1` and the tab says "Ticket #1". Type a resolution such as `Cleared the session cookie` and click **Resolve ticket**. A **Resolution** card replaces the text box, and the badge says `resolved`.
7. Go back to **Queue**: it says **0 waiting** and *No open tickets. Time for a coffee!*

## Recap

- A **layout** wraps pages; `slot` is where the page goes; a page opts in with `layout Main`.
- A **page** has a URL, `uses` apis, `state`, `when loaded`, `action`s and a `view`. Changing state updates the view.
- `input x` is two-way bound to state `x`. Events (`on click save`) call actions. Server errors appear as toasts automatically.
- A **component** `takes` data and actions, and has no state or dependencies.
- Path parameters (`at "/tickets/{id}"`) are available by name.
- Pages can only reach the backend through an api (E201).

Next: [6. AI features](/tutorial/06-ai-features), where AI triages every ticket.
