# 8. Share and ship

**Goal:** give your product owner and QA team an up-to-date description of the app straight from the code, then build the Helpdesk for production and run it.

The code is done. In this chapter you don't change a single `.clb` file.

## Explaining the app to the team

Software teams spend a lot of time keeping documents in sync with code: "what can users do on this screen?", "what are the validation rules?", "what has QA covered?". Cluub answers these questions from the code itself, so the answer is never out of date.

### For the product owner

```bash
cluub explain --for po
```

```text
# Helpdesk — Customers submit support tickets, AI triages them, agents resolve them

## For product owners: what users can do

### Home screen (`/`)
Customers describe their problem and get a ticket number
Users can:
- Send a support ticket

### ImportEmail screen (`/import`)
Agents paste a customer email and AI turns it into a ticket
Users can:
- Create a ticket from a pasted email

### Queue screen (`/queue`)
Agents see every ticket that still needs work, most urgent first
Users can:
- Start working on a ticket

### TicketDetail screen (`/tickets/{id}`)
Everything about one ticket; agents start and resolve it here
Users can:
- Start working on this ticket
- Resolve the ticket and record how


## AI-powered features

- TriageService: Decide how urgent a ticket is
- TriageService: Decide which team should handle a ticket
- TriageService: Summarize a ticket in one sentence for busy agents
- TriageService: Find the customer, subject and problem in a pasted email
```

Look familiar? Every sentence is one of your `about` lines. The app's description comes from `app.clb`, each screen's from its page, each "Users can" bullet from a page action, and the AI features are every service action that contains `ask ai`. This is why the tutorial asked you to write `about` lines all along, and why `cluub check` suggests one when it's missing (W104).

### For QA

```bash
cluub explain --for qa
```

```text
# Helpdesk — Customers submit support tickets, AI triages them, agents resolve them

## For QA: what is tested

- 13 hand-written tests, 48 generated tests (run `cluub test`).

### Hand-written tests
- the api creates a ticket _(tests/api.test.clb:1)_
- the api rejects a bad email address _(tests/api.test.clb:6)_
- the api says when a ticket does not exist _(tests/api.test.clb:11)_
- a new ticket is open and triaged _(tests/tickets.test.clb:1)_
...

### Generated tests
- Ticket: can be created with valid values
...

### Edge cases to explore manually
- TicketService.importEmail: check "Paste the customer's email first" appears when NOT (rawEmail is not empty)
- TicketService.start: check "This ticket is already resolved" appears when the error case happens
- TicketService.resolve: check "Please describe how you solved the problem" appears when NOT (resolution is not empty)
- TicketService.resolve: check "The resolution must be at least 10 characters" appears when NOT (resolution.count is at least 10)
- TicketService.resolve: check "This ticket is already resolved" appears when the error case happens
```

QA gets the list of every test (the generated ones are plain Cluub they can read, as you saw in chapter 7) and a checklist of business rules to try by hand, built from your `require` and `fail` lines. Run `cluub test` before `cluub explain --for qa` so the generated list is current.

### For business analysts and developers

Two more roles are built in. `cluub explain --for ba` lists every model field with its rules, a table of business rules and the api endpoints:

```text
### Business rules
| Where | Rule | Message shown |
|---|---|---|
| TicketService.importEmail | rawEmail is not empty | Paste the customer's email first |
| TicketService.start | (error case) | This ticket is already resolved |
| TicketService.resolve | resolution is not empty | Please describe how you solved the problem |
| TicketService.resolve | resolution.count is at least 10 | The resolution must be at least 10 characters |
| TicketService.resolve | (error case) | This ticket is already resolved |
```

`cluub explain --for dev` shows the architecture: which page uses which api, which api uses which service, and where each store saves. Plain `cluub explain` prints all four sections.

### Sharing the output

The output is Markdown. Write it to a file to put in a wiki, a pull request or a ticket:

```bash
cluub explain --for qa --out QA.md
```

```text
✓ Wrote QA.md
```

A good habit is to regenerate it in CI on every merge, so the team's overview is always the current truth. See [POs, BAs, QAs & AI](/guide/team).

## Build for production

`cluub dev` is for development: it recompiles and reloads on every save. For production, compile once. Stop `cluub dev` (Ctrl+C) and run:

```bash
cluub build
```

```text
✓ Built in 12.4ms → dist/ (4 pages · 1 apis · 2 services · 2 models)
```

`cluub build` refuses to build if there's any compile error, so a broken project never reaches production. It writes plain JavaScript into `dist/`:

```text
dist/
├── server.js                  # your backend: api, services, stores, AI
├── start.mjs                  # runs the built app with plain Node
├── runtime/                   # the server side of the Cluub runtime
├── compiler/diagnostics.js
└── public/
    ├── index.html
    └── _cluub/
        ├── app.client.js      # your pages, components and layout
        ├── boot.js
        ├── theme.css
        ├── compiler/diagnostics.js
        └── runtime/           # the browser side of the runtime (ai, client, core, errors, messages)
```

There are no third-party packages anywhere in that folder, and it doesn't need Cluub installed to run. See the [CLI reference](/reference/cli#what-cluub-build-produces).

## Run it

```bash
cluub start
```

```text
✓ Running at http://localhost:3000
```

Open <http://localhost:3000>. It's the same app, without live reload. `cluub start` picks its port from `--port`, then the `PORT` environment variable, then the `port` in `app.clb`, and finally 3000:

```bash
cluub start --port 8080
PORT=8080 cluub start
```

Because `dist/` is self-contained, a server doesn't need the `cluub` command at all. Plain Node runs it:

```bash
node dist/start.mjs
```

```text
Running at http://localhost:3000
```

A few things to know before you put it on a real server:

- **Data.** The `Tickets` store still saves to `storage/tickets.json` in the project folder, so tickets survive restarts. Back that file up. A JSON file is fine for a small team; for more, the store is the one place you'd change.
- **Secrets.** Put `ANTHROPIC_API_KEY` (or your provider's key) in `.env` on the server or in the environment. It's never part of `dist/`, and never sent to the browser.
- **Errors.** In production, users never see internal details. Unexpected errors return *"Something went wrong on the server."*, and AI problems, such as a missing key or a provider outage, return *"The AI service is not available right now. Please try again."* The details go to the server log:

  ```text
  ✗ TicketApi.importEmail: No API key for claude. Run "cluub ai set claude" (or add ANTHROPIC_API_KEY=... to .env). Never put keys in code.
  POST /api/tickets/import 502 5ms
  ```

  Ticket triage still degrades quietly thanks to the `try ... catch` from chapter 6.
- **Deploying.** Anywhere Node 18+ runs: run `cluub build`, then copy the project (or at least `dist/`, `.env` and `storage/`) to the server and run `node dist/start.mjs` or `cluub start`.

## Checkpoint

- `cluub explain --for po` lists four screens and four AI-powered features, using your `about` lines.
- `cluub explain --for qa` reports 13 hand-written and 48 generated tests.
- `cluub build` prints `✓ Built ... → dist/ (4 pages · 1 apis · 2 services · 2 models)`.
- `cluub start` prints `✓ Running at http://localhost:3000` (and `node dist/start.mjs` prints `Running at http://localhost:3000`), and the app works as before, with your saved tickets.
- `cluub check` prints `✓ No errors` and `cluub test` prints `61 passed`.

## What you built

In about 240 lines of Cluub (not counting tests) you have a full-stack app with:

- a validated data model and a persisted store,
- business rules with clear error messages,
- six HTTP endpoints with automatic input checking,
- four pages, a component and a layout, with no frontend plumbing,
- AI classification, summarization and structured extraction that degrade gracefully,
- 61 tests and team documentation that can't go out of date.

## Where to go next

Some ideas to keep going, using only what you've learned:

- **Reopen tickets.** Add `action reopen(id: text)` to `TicketService` that sets a resolved ticket back to `open`, a `post reopen` route, and a **Reopen** button on the detail page. Then write a UI test for it.
- **Filter the queue.** Add `state category = "all"` and a `select category, options [...]` to the queue page, and a `get` route with a `with category: text` query parameter.
- **Suggest a reply.** Add a `suggestReply` action to `TriageService` with plain `ask ai`, and show the draft on the detail page with a **Suggest a reply** button.
- **Restyle it.** Add a `theme.css` with your colors (see [Pages & components](/guide/frontend#look-and-feel)).
- **Let AI do it.** Try `cluub make "add a reopen button to the ticket detail page"`. The AI gets the language reference and your project, and Cluub only writes the files if the whole project still compiles. Then run `cluub test`.

A few things are deliberately not in this tutorial because Cluub 0.1 doesn't have them yet: user accounts and login (anyone who can open the queue can resolve tickets, so keep it on an internal network), a database other than JSON files, and file uploads such as screenshots on tickets. Check the [roadmap](/reference/roadmap) for what's coming.

To go deeper, read the [language reference](/reference/language), the guides on [models & data](/guide/data), [services & APIs](/guide/backend), [pages & components](/guide/frontend) and [AI](/guide/ai), or start a new project with `cluub new my-app` and see how the `app` template does things.

Congratulations, you've built and shipped a Cluub app.
