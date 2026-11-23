# Project structure & layers

Every Cluub project has the **same shape**. The compiler enforces it (error **E301**), so anyone (a teammate, a reviewer, an AI) knows where everything is.

```
my-app/
├── app.clb            # name, port, AI provider
├── models/              # data shapes + validation rules
├── data/                # stores: where models are saved      (data layer)
├── network/             # clients: outside APIs               (network layer)
├── services/            # business logic and AI
├── api/                 # HTTP endpoints over services
├── ui/
│   ├── pages/           # screens with state and actions      (UI layer)
│   ├── components/      # reusable display pieces
│   └── layouts/         # header/footer around pages
├── tests/               # your tests
│   └── generated/       # tests Cluub writes (rewritten on every `cluub test`)
├── .env                 # secrets (never committed)
└── theme.css            # optional: override colors and fonts
```

## The layer rule

![Cluub layers: page uses api, api uses service, service uses store, client and AI](/diagrams/layers.svg)


| A… | may use… | because |
|---|---|---|
| page | apis | the browser only talks to the server through HTTP |
| api | services | endpoints stay thin; logic is reusable and testable |
| service | stores, clients, other services, AI | this is where decisions live |
| component, layout | nothing (data comes in via `takes`) | easy to reuse and to test |

Break the rule and you get a clear error:

```text
error E201 ui/pages/shop.clb:9:13
  A UI page (Shop) can't use the data layer directly (Products is a store).
   9 |     items = Products.all()
     |             ^^^^^^^^
  hint: Pages talk to the backend only through an `api`. Flow: page → api → service → store/client.
```

## Declaring dependencies

Every dependency is named with `uses`. That is **dependency injection**: Cluub builds each service with exactly what it asked for, and tests replace stores with empty in-memory ones and the AI with a fake.

```cluub
service InvoiceService
  uses Invoices, Customers, PaymentsGateway
```

Using something you didn't declare is error **E106**; declaring something you don't use is warning **W101**.

## Naming

* Declarations: `PascalCase` (`TodoService`, `Home`). Error **E102**.
* Everything else: `camelCase` (`dueDate`, `markDone`). Error **E103**.
* File names are up to you; the convention is kebab-case (`todo-service.clb`).
