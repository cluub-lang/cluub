---
name: cluub-naming
description: Nomenclature standards for Cluub projects - names of declarations, files, folders, fields, actions, routes, states, tests, branches and commits. Use when naming anything new or reviewing names.
---

# Cluub naming standards

The compiler enforces some rules (E102, E103, E301); the rest keep every project consistent.

| Thing | Rule | Good | Bad |
|---|---|---|---|
| Declarations | PascalCase (E102) | `OrderService`, `Home` | `order_service` |
| Model | singular noun | `Order` | `Orders`, `OrderModel` |
| Store | plural noun of its model | `Orders holds Order` | `OrderStore` |
| Service | `<Domain>Service` | `BillingService` | `Helpers` |
| Api | `<Domain>Api`, base `/api/<plural>` | `OrderApi at "/api/orders"` | `Api1` |
| Client | name of the outside system | `Weather`, `Stripe` | `HttpClient` |
| Page | screen name, no suffix | `Checkout` | `CheckoutPage` |
| Component | what it shows | `OrderCard` | `Box2` |
| Layout | role | `Main`, `Admin` | `Wrapper` |
| Fields, states, params | camelCase nouns (E103) | `dueDate`, `isPaid` | `DueDate`, `due_date` |
| Booleans | `is`/`has`/`can` prefix | `isDone`, `hasStock` | `done2` |
| Actions | camelCase verb phrase | `placeOrder`, `markDone` | `order`, `doIt` |
| Routes | CRUD verbs | `list`, `one`, `create`, `update`, `remove` | `getAllTheThings` |
| Files | kebab-case, folder by kind (E301) | `services/order-service.clb` | `Services/OrderService.CLB` |
| Tests | sentence describing behaviour | `test "a paid order can't be cancelled"` | `test "test1"` |
| Branches | `type/short-summary` | `feat/order-refunds` | `rushi-branch` |
| Commits | Conventional Commits | `feat(orders): allow refunds` | `changes` |

When renaming, update every reference and run `cluub check`; generated tests regenerate on the next `cluub test`.
