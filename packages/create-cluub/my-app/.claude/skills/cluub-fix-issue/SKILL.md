---
name: cluub-fix-issue
description: Fix a bug or GitHub issue in a Cluub app safely - reproduce with a failing test, fix in the right layer, verify. Use when given an issue number, an error message or a bug description.
---

# Fix an issue

1. **Understand**: read the issue (`gh issue view <n>`) or the error. Restate the expected vs actual behaviour; ask if unclear.
2. **Locate**: find the declaration involved (`grep -rn` over `.clb` files); identify the layer at fault (model rule, service rule, api, page).
3. **Reproduce**: write a test in `tests/` that fails for the reported reason. Run `cluub test` and confirm it fails.
4. **Fix** the smallest correct change in the right layer (e.g. a missing rule belongs on the model or service, not in the page). Don't refactor unrelated code.
5. **Verify**: `cluub check` (no new errors or warnings) and `cluub test` (the new test and all others pass).
6. **Branch and commit** (only when asked): `fix/<short-summary>`, Conventional Commit `fix(<area>): <summary>` with `Fixes #<n>`.
7. **Report**: root cause, the fix, files changed, tests added, anything not verified.
