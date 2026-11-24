---
name: cluub-debug
description: Diagnose and fix problems in a running Cluub app - compile errors, failing tests, server errors, blank pages, AI and network failures. Use when something is broken and the cause is unknown.
---

# Debugging a Cluub app

1. **Compile first**: `cluub check`. Fix errors top to bottom; each has a code (`cluub errors E201`) and a hint.
2. **Tests**: `cluub test <filter>` narrows to one area; failure output shows got/expected and `file:line`.
3. **Server errors**: run `cluub dev` and read the terminal: every request is logged; 5xx errors print the action and message. Reproduce with `curl` or a test using `request`.
4. **Blank page or crash box**: the browser console shows the error; usually reading a field of `nothing` (guard with `if x is not nothing`) or a missing `when loaded` result.
5. **AI**: `cluub ai` shows which keys are set; `cluub ai test <provider>` checks one; Ollama needs `ollama serve`.
6. **Network clients**: check the base URL and parameters; failures arrive as `NetworkError` (502).
7. **Node version**: Cluub needs Node 18+ (`node --version`).

Write a regression test for the bug before fixing (see `cluub-fix-issue`), then explain the root cause.
