# POs, BAs, QAs & AI

Cluub code is meant to be read by the whole team, and the compiler can explain it for each role.

## `cluub explain`

```bash
cluub explain --for po      # product owner: screens and what users can do, AI features
cluub explain --for ba      # business analyst: data fields + rules, business rules, API table
cluub explain --for qa      # QA: hand-written and generated tests, edge cases to try manually
cluub explain --for dev     # developer: architecture and dependencies
cluub explain --out OVERVIEW.md
```

Because it comes **from the code**, it's never out of date. Example (`--for ba`):

| Where | Rule | Message shown |
|---|---|---|
| TodoService.add | title is not empty | Title is required |
| TodoService.add | title.count is at least 3 | Title must be at least 3 characters |

`about` lines on pages, services, apis and actions become the descriptions. Cluub suggests adding them when they're missing (W104).

## Reading Cluub without being a developer

A BA can review business rules directly in the code:

```cluub
action approveLoan(amount: number, score: number) -> Loan
  about "Approve a loan request"
  require amount is at least 1000, "Minimum loan is 1000"
  require score is greater than 650, "Credit score too low"
```

A QA engineer can read and extend generated tests, which are plain Cluub too. See [Automatic tests](/guide/testing).

## Asking AI to build features

Anyone with a terminal can describe a change:

```bash
cluub make "add a due date to todos and show overdue ones in red"
```

The AI gets the full language reference and your current project. Cluub **compiles its answer**, sends the errors back until it compiles (up to 3 tries), and only then writes files. Then `cluub test` regenerates and runs every test. The structure rules mean AI output follows the same layers and naming as human code, so reviews stay easy.

## Working with AI coding assistants

Point Claude, ChatGPT or any assistant at `LANGUAGE.md` (the complete reference, about 250 lines). The language is small and consistent, so assistants rarely guess wrong, and when they do, the compiler explains what to fix.
