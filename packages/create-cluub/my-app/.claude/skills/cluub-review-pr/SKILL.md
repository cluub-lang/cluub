---
name: cluub-review-pr
description: Review a GitHub pull request of a Cluub project end to end (checkout, run checks and tests, review the diff, draft comments). Use when given a PR number or URL to review.
---

# Review a pull request

1. **Read the PR**: `gh pr view <n>` (title, description, linked issue) and `gh pr diff <n>`. Note what the PR claims to do.
2. **Check it out safely**: `gh pr checkout <n>` in a clean working tree (stash or commit your work first).
3. **Run**: `cluub check` and `cluub test`; look at the PR's CI with `gh pr checks <n>`.
4. **Review** with the `cluub-code-review` checklist, and also:
   - Does the change do what the description and linked issue say, and nothing unrelated?
   - Is the PR small enough to review? Suggest splitting if not.
   - Are docs, `about` lines and tests updated with the behaviour?
   - Commit messages follow Conventional Commits.
5. **Draft** the review: summary, blockers, suggestions (with `file:line` and proposed code), questions, and a verdict (approve / request changes / comment).
6. **Never post** comments, approve, request changes or merge without the user's explicit go-ahead. Show the draft first.
