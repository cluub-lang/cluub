---
name: cluub-backend
description: Backend standards for Cluub apps - models, stores, clients, services, apis, validation, errors and AI (bring your own key). Use when writing or reviewing anything in models/, data/, network/, services/ or api/.
---

# Cluub backend standards

## Models (`models/`)
- One concept per model, singular PascalCase noun (`Order`, not `Orders` or `OrderData`).
- Put every rule the data must obey on the field: `required`, `min`, `max`, `one of`, with a custom message users can act on.
- Use precise types: `email`, `url`, `date`, `number`, `bool`, `list of T`, `T?` for optional.

## Stores (`data/`) and clients (`network/`)
- Store names are plural (`Orders holds Order`). Persist with `saved in "storage/<name>.json"` when data must survive restarts.
- Use `get(id)` when a missing item is an error (404), `find(id)` when it is normal.
- Clients wrap outside APIs only; never call `fetch`-like logic from services directly. Handle `NetworkError` in the service (`try ... catch problem`) when a fallback makes sense.

## Services (`services/`)
- All business rules live here. Express them as `require <condition>, "<message>"` at the top of the action.
- Use `fail "<message>" status 403|404|409` for rule violations that are not input validation. These messages are shown to users, even in production: never include secrets or internals.
- One responsibility per service; split when it passes ~8 actions (W103) or an action passes ~25 statements (W102).
- AI: `ask ai` only in services. Prefer structured output (`as Model`, `as one of [...]`). Never hard-code keys; developers use `cluub ai set <provider>`, apps that bill users set `aiKeys "user"`.

## Apis (`api/`)
- Thin: validate shape with typed `with` parameters, then call one service action. No business logic.
- REST naming: `get list at "/"`, `get one at "/{id}"`, `post create at "/"`, `put update at "/{id}"`, `delete remove at "/{id}"`.
- Static paths are matched before `{params}`; do not declare two routes with the same method and path (E115).

## Errors
- Validation → 400, `fail` → its status, missing item → 404, AI/network → 502 (generic message in production), bugs → 500.
- Don't swallow errors with an empty `catch`; log context with `log` and fail or fall back deliberately.

## Checklist before finishing
`cluub check` clean · every rule has a test · `about` on services, apis and actions · no `env` reads outside services/clients.
