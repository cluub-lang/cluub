---
name: cluub-tests
description: Write and maintain tests for Cluub apps (service rules, api contracts, UI flows) on top of the generated tests. Use when adding tests, when a feature lacks tests, or when tests fail.
---

# Testing Cluub apps

`cluub test` regenerates `tests/generated/` (model rules, `require` rules, api validation, page render, buttons) and runs everything with a fresh in-memory store, fake AI and no network. Never edit generated files; add your own in `tests/<area>.test.clb`.

## What to write

- **Service rules**: one test per business rule and per `fail` path.
  `expect OrderService.cancel("1") fails with "already shipped"`
- **Api contracts**: status codes and messages.
  `let r = request post "/api/orders" with {total: 0}` then `expect r.status is 400`
- **UI flows**: the main happy path per page.
  `render Checkout` → `type "..." into "<placeholder>"` → `click "Pay"` → `expect screen has "Thank you"`
- **Regression**: when fixing a bug, first write a test that fails, then fix.

## Rules

- Test names describe behaviour in a sentence.
- One behaviour per test; arrange data inside the test (stores start empty).
- AI is fake: plain prompts return `AI reply to: ...`, `as one of` returns the first option, `as Model` a valid sample. Assert on structure, not on wording.
- Clients return nothing in tests; test the fallback path, not the outside API.

## Done when

`cluub test` passes with no skipped areas, and every new rule or bug fix has its own test.
