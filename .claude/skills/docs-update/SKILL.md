---
name: docs-update
description: Add or update the Cluub documentation site (VitePress in docs/) correctly - samples that compile, navigation, links, brand palette. Use when writing or changing any docs page.
---

# Update the docs

- Pages live in `docs/` (guide, tutorial, cookbook, reference). New pages must be added to the sidebar in `docs/.vitepress/config.mjs`.
- Every ```cluub block is compiled by `npm test`: blocks starting with a declaration must compile (unknown names are tolerated in snippets); the tutorial must build as one project.
- Use absolute site links (`/guide/ai`), never the old domains; the site is served at https://cluub-lang.github.io/.
- Images and diagrams use the Okabe–Ito palette (see `/brand`) with text contrast of 4.5:1.
- Plain, precise English; explain what happens and what errors look like; keep examples realistic and self-contained.
- Verify with `npm test` and `cd docs && npm run build` (no dead links), and preview with `npm run docs:dev`.
- Publishing is automatic on push to `main` (Docs workflow → cluub-lang/cluub-lang.github.io).
