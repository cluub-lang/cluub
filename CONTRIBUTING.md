# Contributing to Cluub

Thanks for helping! The full guide (how the compiler works, adding a view element, built-in or diagnostic, publishing) is at **https://cluub-lang.github.io/contributing**.

## Quick start

```bash
git clone https://github.com/cluub-lang/cluub.git && cd cluub
nvm use 22            # Node 18+ is required
npm test              # must print "All good"
npm run docs:dev      # docs with live playground
```

## Ground rules

- **Zero dependencies** for `cluub` and `create-cluub`.
- **Every change has a test**: a regression case in `tests/regressions.js` for bugs, samples that compile for docs.
- **Docs and changelog** (`docs/changelog.md`, `[Unreleased]`) are part of the change.
- **Conventional Commits**: `feat(parser): ...`, `fix(runtime): ...`, `docs: ...`.
- One topic per pull request; fill in the PR template.

AI assistants: this repo ships Claude skills in `.claude/skills/` and rules in `CLAUDE.md`.
By contributing you agree to the [Code of Conduct](CODE_OF_CONDUCT.md) and to license your work under the [MIT License](LICENSE).
