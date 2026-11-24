---
name: compiler-change
description: Add or change a language feature in the Cluub repository (syntax, view element, built-in, diagnostic, runtime behaviour) end to end with tests and docs. Use for any change under compiler/ or runtime/.
---

# Change the Cluub language or runtime

Pipeline: `compiler/lexer.js` → `parser.js` → `checker.js` (names, layers, diagnostics) → `codegen.js` → `runtime/` (core, client, node, ai, testing). `testgen.js` writes generated tests, `explain.js` the role summaries.

1. **Write the failing case first** in `tests/regressions.js` (a small `.clb` program whose `test` blocks must pass, or a diagnostic-code expectation).
2. **Implement** in the right stage. Keep the zero-dependency rule: Node built-ins only in `runtime/node.js` and `cli/`; `compiler/` and the rest of `runtime/` must stay browser-safe (the playground imports them).
3. **Diagnostics**: new codes go in `compiler/diagnostics.js` `CODES`, with a precise message and a hint that says how to fix it, and a row in `docs/reference/errors.md`.
4. **Keywords**: new elements, properties, built-ins or types must be added to the TextMate grammar (`editors/cluub.tmLanguage.json`), `LANGUAGE.md`, and the matching reference page (the coverage check in `tests/run.js` enforces this).
5. **Docs**: update the reference page and any guide that mentions the behaviour; every ```cluub sample is compiled by the self-test.
6. **Verify**: `npm test` must print "All good" (templates, playground examples, docs samples, tutorial project, coverage, regressions, theme).
7. **Changelog**: add a line under `[Unreleased]` in `docs/changelog.md`.

Use Node 18+ (`nvm use 22`); Node 14 fails with syntax errors.
