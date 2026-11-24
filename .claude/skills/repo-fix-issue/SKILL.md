---
name: repo-fix-issue
description: Fix a reported bug in the Cluub compiler, runtime, CLI or docs - reproduce with a regression test, fix, verify, document. Use when given an issue of cluub-lang/cluub or a Cluub bug report.
---

# Fix a Cluub bug

1. Read the issue (`gh issue view <n> -R cluub-lang/cluub`); restate expected vs actual.
2. Reproduce with the smallest `.clb` program; add it to `tests/regressions.js` and confirm it fails.
3. Find the stage at fault (lexer, parser, checker, codegen, runtime, CLI) and make the smallest correct fix.
4. `npm test` must print "All good"; if docs describe the old behaviour, update them (and the changelog under `[Unreleased]`).
5. When asked to commit: branch `fix/<summary>`, message `fix(<area>): <summary>` with `Fixes #<n>`, then open a PR with the template filled in.
6. Report root cause, fix, tests and anything unverified.
