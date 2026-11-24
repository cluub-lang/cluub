---
name: cluub-accessibility
description: Accessibility review for Cluub app UIs against WCAG 2.2 AA - labels, alt text, headings, focus, colour contrast, states. Use when building or reviewing pages and components.
---

# Accessibility review

For every page and component in the change:

- **Names**: each `input`, `select`, `checkbox` and icon-like `button` has a `label` or a meaningful `placeholder`; button text says what happens ("Save order", not "OK").
- **Images**: `image` has `alt` (empty only if purely decorative).
- **Structure**: one `heading` per page, `subheading` for sections; lists use `list`/`item`; forms use `form` with `on submit`.
- **Keyboard**: everything is reachable with Tab and works with Enter/Space (use `button`/`link`, not clickable `text`).
- **States**: loading (`spinner`, announced as status), empty and error states are visible as text, not just colour.
- **Contrast**: custom colours in `theme.css` keep 4.5:1 for text and 3:1 for controls; stay within the Okabe–Ito palette.
- **Motion and timing**: no auto-advancing content.

Test the main flow with a UI test, and manually with a keyboard and a screen reader (VoiceOver: Cmd+F5). Report issues with the WCAG criterion and a fix.
