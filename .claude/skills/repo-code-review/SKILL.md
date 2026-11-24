---
name: repo-code-review
description: Review changes to the Cluub repository itself (compiler, runtime, CLI, templates, docs, skills). Use when reviewing a diff, branch or PR of cluub-lang/cluub.
---

# Review a change to Cluub

1. Read the diff (`git diff main...HEAD` or `gh pr diff <n>`) and every touched file in full.
2. Run `npm test` (Node 18+) and, for docs changes, `cd docs && npm run build`.
3. Check:
   - **Correctness**: parser/checker/codegen agree; generated JS is valid in the browser and Node; edge cases (nothing, empty lists, reserved names, trailing commas).
   - **Errors**: new diagnostics have a code, precise message, hint, docs row and a regression test.
   - **Zero dependencies**: no new npm dependencies in `cluub` or `create-cluub`; browser-safe modules stay free of Node imports.
   - **Security**: no secrets; user input validated at boundaries; nothing logs AI keys or request headers; CSP-compatible output (no inline scripts, no eval in served pages).
   - **Compatibility**: existing `.clb` programs still compile; templates and tutorial still pass.
   - **Docs**: reference, grammar, `LANGUAGE.md`, changelog updated; samples compile.
   - **Accessibility and palette**: UI/runtime changes keep labels, contrast and the Okabe–Ito palette.
4. Report Blocker / Should fix / Nit with `file:line` and a concrete fix. Don't post to GitHub without explicit approval.
