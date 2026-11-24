---
name: cluub-security
description: Security review for Cluub apps - secrets and AI keys, input validation, error leakage, auth gaps, data storage and HTTP exposure. Use before releases, for security questions, or when reviewing sensitive features.
---

# Security review

Check each item and report findings with severity and a fix.

- **Secrets**: no keys or tokens in `.clb` files (E401) or in git history; `.env` is git-ignored; production keys come from real environment variables.
- **AI keys**: `aiKeys` mode is intentional. With `"user"`/`"either"`, the app is served over HTTPS and no proxy logs request headers.
- **Input**: every api parameter is typed; model rules bound lengths (`max`) and values (`one of`, `min`); no unbounded lists.
- **Business rules** that protect data (ownership, state transitions) are enforced in services with `require`/`fail`, never only in the UI.
- **Errors**: `fail` messages are user-facing and contain no internals; unexpected errors stay generic in production.
- **Auth**: Cluub 0.1 has no authentication. Flag any feature that assumes a logged-in user, and recommend running behind an authenticating proxy or keeping the app internal.
- **Data**: JSON file stores live in `storage/` (git-ignored, backed up); no personal data in logs.
- **HTTP**: keep the default headers (CSP, X-Frame-Options, nosniff); bodies must be JSON; serve behind HTTPS.
- **Dependencies**: Cluub apps have none; flag any added outside scripts or assets.

Finish with a short risk summary and the top three actions.
