---
name: cluub-feature
description: Build a full-stack feature in a Cluub app (model, store, service, api, page, components, tests) in the standard order. Use when asked to add or change a feature, screen, endpoint or business rule in a .clb project.
---

# Build a feature in Cluub

Cluub enforces one structure; follow it exactly so every feature looks the same.

## Order of work

1. **Clarify** the feature in one sentence and list its business rules and screens. Ask if a rule is ambiguous.
2. **Model** (`models/<thing>.clb`): fields, types and rules (`required`, `min`, `max`, `one of`) with user-friendly custom messages.
3. **Store** (`data/<things>.clb`): `store Things holds Thing` (add `saved in "storage/things.json"` to persist).
4. **Network client** (`network/`) only if an outside API is needed.
5. **Service** (`services/<thing>-service.clb`): business rules as `require ...`, failures as `fail "..." status N`, `about` on every action. AI calls (`ask ai`) live only here.
6. **Api** (`api/<thing>-api.clb`): thin routes that call the service; typed `with` parameters.
7. **UI** (`ui/pages`, `ui/components`, `ui/layouts`): pages own state and call apis; components only `takes` data and action callbacks.
8. **Tests** (`tests/<thing>.test.clb`): at least one service rule test, one api test and one UI test (see the `cluub-tests` skill).
9. **Verify**: run `cluub check` (zero errors, review suggestions) and `cluub test` (all pass). Run `cluub explain --for po` and confirm it describes the feature correctly.

## Rules that must hold

- Layers: page → api → service → store/client/ai. Never skip a layer (E201).
- Declare every dependency with `uses` (E106); remove unused ones (W101).
- Naming follows the `cluub-naming` skill.
- No secrets in code (E401); keys come from `cluub ai set` / `.env`.
- Keep actions small (W102) and services focused (W103); split instead of growing.

## Done when

`cluub check` and `cluub test` pass, generated tests are green, and the change is summarized as: what users can now do, the business rules, files added/changed.
