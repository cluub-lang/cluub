# Claude skills & AI assistants

Cluub is built so that every developer **and every AI coding assistant** writes code the same way. Each project comes with ready-made [Claude Code](https://code.claude.com) skills and a `CLAUDE.md` file of project rules, so Claude (or any assistant that reads them) follows Cluub's structure, naming, testing and review standards automatically.

## What every new project gets

`cluub new` and `npm create cluub` add:

```text
my-app/
├── CLAUDE.md               # project rules for AI assistants
└── .claude/skills/         # one folder per skill, each with a SKILL.md
```

| Skill | Use it to |
|---|---|
| `cluub-feature` | Build a full-stack feature in the standard order: model, store, service, api, page, components, tests |
| `cluub-backend` | Apply backend standards: models, stores, clients, services, apis, validation, errors, AI keys |
| `cluub-frontend` | Apply frontend standards: pages own state, stateless components, layouts, loading/empty/error states, accessibility |
| `cluub-naming` | Name declarations, files, fields, actions, routes, tests, branches and commits consistently |
| `cluub-tests` | Write service, api and UI tests on top of the generated ones |
| `cluub-code-review` | Review a change for correctness, layers, validation, security, accessibility, naming and tests |
| `cluub-review-pr` | Review a GitHub pull request end to end and draft comments (never posts without approval) |
| `cluub-fix-issue` | Fix a bug safely: reproduce with a failing test, fix in the right layer, verify |
| `cluub-security` | Review secrets and AI keys, input validation, error leakage, auth gaps and HTTP exposure |
| `cluub-accessibility` | Check UIs against WCAG 2.2 AA: labels, alt text, headings, keyboard, contrast |
| `cluub-debug` | Diagnose compile errors, failing tests, server errors, blank pages, AI and network failures |

## Using them

In [Claude Code](https://code.claude.com), open your project folder and ask in plain English. Claude picks the matching skill:

```text
Add a "due date" to todos and show overdue ones first
Review my changes before I commit
Review PR #12
Fix issue #7
Check the new checkout page for accessibility
```

You can also name a skill directly, for example "use the cluub-naming skill to check these names". Skills never push code, post on GitHub or publish anything without asking you first.

## Customizing

Skills are plain Markdown files: edit them to add your team's own rules (for example a ticket format or extra review items), or add new folders under `.claude/skills/`. Keep `CLAUDE.md` short; it's read at the start of every session.

## For contributors to Cluub itself

The Cluub repository has its own skills in `.claude/skills/` (`compiler-change`, `repo-code-review`, `repo-review-pr`, `repo-fix-issue`, `release`, `docs-update`) and a repository `CLAUDE.md`. See [Contributing](/contributing).

## See also

* [POs, BAs, QAs & AI](/guide/team): `cluub explain` and `cluub make`
* [Project structure & layers](/guide/structure)
* [Automatic tests](/guide/testing)
