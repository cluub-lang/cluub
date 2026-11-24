---
name: cluub-frontend
description: Frontend standards for Cluub apps - pages, components, layouts, state, events, accessibility, loading/empty/error states and theming. Use when writing or reviewing anything in ui/pages, ui/components or ui/layouts.
---

# Cluub frontend standards

## Pages (`ui/pages/`)
- A page owns its state (`state ...`) and actions, and talks to the backend only through apis (`uses SomeApi`).
- Load data in `when loaded`; never call an api inside a view expression (E117).
- Every page has `about` and a `title`, and uses the shared `layout`.

## Components (`ui/components/`)
- Stateless and reusable: data comes in with `takes`, behaviour goes out with `action` callbacks (`takes onSave: action`).
- Name them by what they show (`OrderCard`, `PriceTag`), not where they are used.

## Layouts (`ui/layouts/`)
- Exactly one `slot` (W107). Navigation lives in the layout, not in each page.

## States every screen needs
- **Loading**: `spinner` while data is on its way.
- **Empty**: `if items is empty` with a helpful message and next step.
- **Error**: rely on the automatic toast for server messages; add inline text for field-level guidance.
- **Disabled**: `disabled draft is empty` on buttons that can't act yet.

## Accessibility (WCAG 2.2 AA)
- Every `input`/`select` has a meaningful `placeholder` or `label`; every `checkbox` and icon-like button has a `label`.
- Every `image` has an `alt`.
- Use `heading` once per page, then `subheading`; don't fake headings with `text`.
- Don't convey meaning with colour alone; the default theme already meets contrast, keep custom `theme.css` colours at 4.5:1 for text.

## Styling
- Use `style primary|danger|ghost|muted` and the theme variables; override colours only in `theme.css` and keep to the Okabe–Ito palette.

## Checklist before finishing
UI test for the main flow (`render`, `type`, `click`, `expect screen has`) · loading, empty and error states · labels on all controls · no E117/E112/E113.
