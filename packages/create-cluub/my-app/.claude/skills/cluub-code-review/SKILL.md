---
name: cluub-code-review
description: Review Cluub (.clb) code changes for correctness, architecture, naming, validation, security, accessibility, tests and performance. Use when asked to review code, a diff, a branch or files in a Cluub project.
---

# Code review for Cluub apps

1. **Get the change**: `git diff` (or the files/branch named). Read every changed `.clb` file fully, plus the declarations it uses.
2. **Run the tools**: `cluub check` and `cluub test`. Report every error and warning with its code.
3. **Review against the checklist** (cite `file:line`):
   - **Correctness**: rules match the requirement; edge cases (empty, nothing, zero, duplicates, missing ids) handled.
   - **Architecture**: page → api → service → store/client/ai; apis thin; components stateless; no logic in views.
   - **Validation**: rules on model fields; `require` for business rules; typed api parameters.
   - **Errors**: correct statuses; no empty `catch`; user-facing `fail` messages contain no internals.
   - **Security**: no secrets (E401); `env` only on the backend; `ask ai` only in services; `aiKeys` mode intended.
   - **Accessibility**: labels/placeholders on controls, `alt` on images, heading order, loading/empty states.
   - **Naming**: follows `cluub-naming`.
   - **Tests**: new rules and fixed bugs have tests; UI flow covered.
   - **Performance**: no repeated api calls per render; large lists filtered/paged in the service.
4. **Report** findings ordered by severity: **Blocker** (wrong behaviour, security), **Should fix**, **Nit**. For each: what, why, a concrete fix. End with what is good about the change.

Do not change code during a review unless asked; offer to apply the fixes.
