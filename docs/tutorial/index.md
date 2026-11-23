# Tutorial: build an AI helpdesk

In this tutorial you build a complete, working **Helpdesk** app in Cluub, from an empty folder to a production build. It takes about an hour and a half if you follow every step, and every line of code is shown.

You don't need to know Cluub yet. If you've written a little JavaScript, Python or similar, you know enough. Each new idea is explained the first time it shows up, with a link to the reference page if you want the details.

## What you'll build

A small support desk for a software company. It has two kinds of users:

- **Customers** fill in a form to send a support ticket and get a ticket number back.
- **Agents** work through a queue of open tickets, start working on one, and resolve it with a note that says how they fixed it.

AI does the boring parts:

- When a ticket arrives, AI decides its **priority** (`low`, `normal`, `high`, `urgent`) and **category** (`billing`, `technical`, `account`, `other`), and writes a one-sentence **summary** for the agents.
- Agents can paste a raw customer **email**, and AI pulls out the name, email address, subject and problem to create a ticket from it.
- If the AI is unavailable, tickets still come in. They just aren't triaged.

When you're done, the app has:

| Part | What it is |
|---|---|
| 2 models | `Ticket` and `TicketDraft`, with validation rules |
| 1 store | `Tickets`, saved to `storage/tickets.json` |
| 2 services | `TicketService` (business rules) and `TriageService` (AI) |
| 1 api | `TicketApi`, six HTTP endpoints under `/api/tickets` |
| 4 pages | the ticket form, the queue, a ticket detail page and an email import page |
| 1 component, 1 layout | `TicketRow` and `Main` |
| 61 tests | 13 you write yourself, 48 that Cluub writes for you |

Along the way you'll use most of the language: models and rules, stores, services with `require` and `fail`, apis with path parameters, pages with state and actions, components, layouts, `ask ai` in all three forms, generated and hand-written tests, `cluub explain`, `cluub build` and `cluub start`.

## The final result

Open the app in a browser and you see a header with **Helpdesk · New ticket · Queue · Import email**.

- **New ticket** (`/`): a "Contact support" form with name, email, subject and a message box. Submitting shows "Thanks, Ada Lovelace! Your ticket number is #1."
- **Queue** (`/queue`): one card per open ticket, most urgent first. Each card shows badges for priority, category and status, the subject, who sent it, the AI summary, and **Open** / **Start** buttons.
- **Ticket detail** (`/tickets/1`): the whole ticket, the AI summary, a **Start working** button, and a box to write the resolution and **Resolve ticket**.
- **Import email** (`/import`): paste an email, click **Create ticket**, and get a link to the new ticket.

Bad input never slips through. Try to submit a ticket with the email `nope` and a red message says *"customerEmail must be a valid email address"*. You don't write any code for that message.

## Before you start

You need:

- **Node.js 18 or newer.**
- **The `cluub` command.** See [Install & first app](/guide/install). Check it with `cluub version`, which prints `cluub 0.1.0`.
- **A terminal and a text editor.** Syntax highlighting for `.clb` files is in `editors/cluub.tmLanguage.json`.
- **Optional: an AI key** for chapter 6, such as an `ANTHROPIC_API_KEY` for Claude. Everything else, including all the tests, works without one.

It helps to have read the [10-minute tour](/guide/tour), but it isn't required.

## Chapters

1. [Create the project](/tutorial/01-setup): `cluub new`, `cluub dev`, your first page and your first compile error.
2. [The Ticket model](/tutorial/02-ticket-model): describe the data and its validation rules.
3. [A store and a service](/tutorial/03-store-and-service): save tickets and write the business rules.
4. [The api](/tutorial/04-api): HTTP endpoints, path parameters and automatic input checks.
5. [Pages, components and a layout](/tutorial/05-pages-and-components): the ticket form, the queue and the ticket detail page.
6. [AI features](/tutorial/06-ai-features): classify with `as one of`, summarize with `ask ai`, extract with `as Model`.
7. [Testing](/tutorial/07-testing): read the generated tests, then write your own UI, api and service tests.
8. [Share and ship](/tutorial/08-share-and-ship): `cluub explain` for the team, `cluub build`, `cluub start`, and what to try next.

## How to follow along

Every code block says which file it belongs to, for example "Create `models/ticket.clb`". When a later chapter changes a file, it shows the **whole** new version of that file, so you can replace the contents rather than hunt for the changed lines.

Each chapter ends with a **Checkpoint** that says what you should see in the terminal and the browser. Timings like `checked in 2.4ms` differ from machine to machine; everything else should match. If something doesn't, run `cluub check`. It names the file, the line and usually the fix.

Ready? Start with [chapter 1: Create the project](/tutorial/01-setup).
