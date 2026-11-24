# MyApp: guide for Claude and other AI assistants

This is a Cluub app (`.clb` files). Language reference: https://cluub-lang.github.io/reference/language

## Rules
- Follow the folder layout and layers: page -> api -> service -> store / client / ai.
- Run `cluub check` (no errors) and `cluub test` (all pass) after every change.
- Every business rule and bug fix gets a test in `tests/`; never edit `tests/generated/`.
- Never put API keys in code; use `cluub ai set <provider>`.
- Commit messages follow Conventional Commits; don't push or open PRs without being asked.

## Skills
Use the skills in `.claude/skills/`: cluub-feature, cluub-backend, cluub-frontend, cluub-naming, cluub-tests,
cluub-code-review, cluub-review-pr, cluub-fix-issue, cluub-security, cluub-accessibility, cluub-debug.
