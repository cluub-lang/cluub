# Cluub repository guide for Claude

Cluub is a zero-dependency language and framework (compiler + runtime + CLI) that compiles `.clb` files into a frontend, a backend and tests.

## Layout
- `compiler/` lexer → parser → checker → codegen, plus testgen and explain. Browser-safe.
- `runtime/` core (models, stores, dispatcher), client (virtual DOM), node (HTTP server), ai (providers, bring your own key), testing.
- `cli/` the `cluub` command (`cli/cluub.js` checks the Node version, `cli/main.js` does the work, `cli/new.js` creates projects).
- `packages/create-cluub/` the `npm create cluub` package. `templates/` starter projects. `skills/` Claude skills copied into every new project.
- `docs/` VitePress site, published to https://cluub-lang.github.io/. `tests/run.js` self-test, `tests/regressions.js` one case per fixed bug.

## Rules
- No runtime dependencies. Node built-ins only in `runtime/node.js` and `cli/`.
- Every behaviour change needs a regression test, docs and a changelog line.
- `npm test` must print "All good" before anything is committed. Use Node 18+ (`nvm use 22`).
- Never commit secrets; never log AI keys or request headers.
- Commits follow Conventional Commits; never push, publish or post to GitHub without explicit approval.

## Skills
Use the skills in `.claude/skills/` for this repository (compiler-change, repo-code-review, repo-review-pr, repo-fix-issue, release, docs-update). The app-level skills in `skills/` (for projects built with Cluub) are the ones shipped to users; keep them accurate when the language changes.
