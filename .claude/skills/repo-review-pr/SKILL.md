---
name: repo-review-pr
description: Review a pull request to cluub-lang/cluub - check CI, run the self-test locally, review against project standards, draft a review. Use when given a PR number or URL for this repository.
---

# Review a Cluub pull request

1. `gh pr view <n>` and `gh pr diff <n>`; read the linked issue.
2. `gh pr checks <n>`; then `gh pr checkout <n>` in a clean tree and run `npm test` (and `cd docs && npm run build` for docs changes).
3. Review with the `repo-code-review` checklist; confirm the PR template is complete, the scope matches the description, and commits follow Conventional Commits.
4. Draft the review (summary, blockers, suggestions with code, questions, verdict). Never comment, approve, request changes or merge without the user's explicit go-ahead.
