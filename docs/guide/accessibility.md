# Accessibility

Cluub views compile to plain, mostly semantic HTML, and the runtime handles a few accessibility basics for you: accessible names, loading and error announcements, and focus after navigation. Some things you still have to do yourself. This page describes exactly what the 0.1 compiler (`compiler/codegen.js`), UI runtime (`runtime/client.js`) and theme (`runtime/theme.css`) emit, checked in a browser against the `app` template, then gives practical rules for accessible Cluub screens.

## What the compiler emits

| Cluub element | HTML | Notes |
|---|---|---|
| `heading` | `<h1>` | every `heading` is an `h1` |
| `subheading` | `<h2>` | there is no `h3`–`h6` |
| `text` | `<p>` | |
| `label` | `<label>` | wraps its children, see [Labels](#give-every-control-a-name) |
| `button` | `<button type="button">` | real button: focusable, Enter/Space activate it |
| `link "x" to "/path"` | `<a href="/path">` | real link: middle-click, Ctrl/Cmd-click and "copy link" work |
| `image src` | `<img src>` | `alt` only if you write `alt "..."` |
| `input` | `<input>`, or `<textarea>` with `multiline` | `type` passes through (`"email"`, `"number"`, ...) |
| `checkbox` | `<input type="checkbox">` | |
| `select` | `<select>` with one `<option>` per value | |
| `list` / `item` | `<ul>` / `<li>` | |
| `header`, `footer`, `nav`, `section`, `form` | the same HTML elements | `header`, `footer` and `nav` act as landmarks |
| `row`, `column`, `card`, `box`, `grid` | `<div>` (with a class) | no semantics, layout only |
| `badge` | `<span class="badge">` | |
| `divider` | `<hr>` | |
| `spinner` | `<div class="spinner" role="status" aria-label="Loading">` | announced as "Loading" |

### Accessible names: the `label` property

Any element accepts a `label "..."` property, which becomes `aria-label`. If an `input` or `select` has no `label` property, its `placeholder` is used as its `aria-label`. This is what the `app` template renders, as seen in the browser:

```text
<input placeholder="Add a todo and press Enter" aria-label="Add a todo and press Enter">
<select aria-label="Priority">…</select>
<input aria-label="Done: Buy milk" type="checkbox">
<button aria-label="Delete Buy milk" type="button" class="ghost">Delete</button>
```

The `label` **element** (`label "Email"` followed by indented children) is different: it renders a visible `<label>` that wraps its fields.

### Landmarks, language and title

The runtime wraps every page in `<main class="cluub-page">`. With a layout, the layout's `header` and `footer` sit outside `<main>`, so screen reader users get banner, navigation, main and contentinfo landmarks. `<html lang>` comes from the `lang` setting in `app.clb` (default `en`):

```cluub
app Shop
  lang "de"
```

The page's `title` sets `document.title` on every render, so each route gets its own tab title.

### Events and keyboard

* `on click` on a `button` or `link` works with the keyboard for free.
* `on enter` listens for the Enter key on that element (typically an `input`).
* `on submit` on a `form` calls your action and prevents the page reload. Every `button` is `type="button"`, so pressing Enter in a field doesn't submit the form on its own. Add `on enter save` to the input for that.
* `on click` on a **container** (`card`, `row`, `box`) compiles to a `<div onclick>`. Keyboard users can't reach or activate it.

### Errors and the toast

When an action fails, the runtime shows the message in a toast: `<div class="cluub-toast" role="alert">`. The `alert` role makes screen readers announce it right away. The toast disappears after 5 seconds or when clicked, and a new error replaces the previous one. A page that throws while drawing shows `This page hit an error while drawing: …` in a `role="alert"` box, which is announced too.

### Focus

The virtual DOM patches the page in place after each action, so an `input` keeps focus and the cursor while the page re-renders. After a client-side navigation (clicking a `link`, or `go to`), the runtime moves focus to the new page's `<main>` (with `tabindex="-1"`). Screen readers then start reading the new content, and keyboard users continue from there. We confirmed this in a browser: after clicking "About", `document.activeElement` was `MAIN`. The first page load and the browser's back and forward buttons don't move focus.

### Theme

The built-in theme supports light and dark mode (`prefers-color-scheme`). We measured its color pairs against WCAG 2.2:

| Pair | Contrast | WCAG AA (4.5:1 text, 3:1 UI) |
|---|---|---|
| Body text on background (light / dark) | 16.7:1 / 18.1:1 | passes |
| Muted text (`style muted`, footer) on background (light / dark) | 4.6:1 / 6.9:1 | passes |
| Link / primary on background (light / dark) | 6.0:1 / 6.6:1 | passes |
| Primary button text (light / dark) | 6.3:1 / 6.6:1 | passes |
| White on danger (danger button, toast) | 4.8:1 | passes |
| Form-control border `--control-border` on surface (light / dark) | 3.7:1 / 3.7:1 | passes 3:1 |

Inputs show a 3px colored ring on focus. Buttons and links keep the browser's default focus outline. Disabled buttons use the native `disabled` attribute, so they drop out of the tab order.

## Practical guidance

### Give every control a name

For a field, the best name is a visible label. Wrap the field in a `label` element (no `id`s needed):

```cluub
page Signup at "/signup"
  state email = ""
  state agreed = false
  action join()
    agreed = true
  view
    form, on submit join
      label "Email address"
        input email, type "email", placeholder "you@example.com", on enter join
      label "I agree to the terms"
        checkbox agreed
      button "Join", on click join, style primary
```

When a visible label doesn't fit the design, use the `label` property:

```cluub
component TodoRow
  takes todo: Todo, onToggle: action, onRemove: action
  view
    row
      checkbox todo.done, label "Done: {todo.title}", on change onToggle(todo.id)
      text todo.title
      button "Delete", label "Delete {todo.title}", on click onRemove(todo.id), style ghost
```

Relying on the placeholder alone works for screen readers (it becomes `aria-label`), but the placeholder disappears as soon as someone types, so sighted users lose the hint. Keep placeholders anyway: Cluub UI tests find fields by placeholder (`type "x" into "you@example.com"`).

### Images need `alt`

Write `alt` for every meaningful image, and an empty `alt ""` for decorative ones:

```cluub
component Avatar
  takes name: text, photo: url
  view
    image photo, alt "Photo of {name}"
```

Without `alt`, the `<img>` has no alt attribute at all, and screen readers may read out the file name.

### Use buttons for actions, links for navigation

Put `on click` on a `button`, not on a `card` or `row`. For a clickable card, put a real button or link inside it. Make names specific: five buttons that all say "Delete" are hard to tell apart in a screen reader's list of controls, so add `label "Delete {todo.title}"`, as the `app` template does.

### Loading states

`spinner` is announced as "Loading". For a more specific message, give it a label, or add visible text next to it:

```cluub
page Ask at "/ask"
  state thinking = false
  view
    if thinking
      row
        spinner, label "Waiting for the AI reply"
        text "Thinking…"
```

### Headings

Every `heading` is an `h1`. Use one `heading` per page for the page's main title, and `subheading` (`h2`) for sections. Don't use `heading` in a layout or component that appears on every page, or each page ends up with two `h1`s.

### Keep conditional content below inputs

The renderer matches old and new elements by position. If an `if` block above an input appears or disappears while the user types, every later element shifts one position, and focus or a half-typed value can end up in the wrong field. Put conditional messages after the inputs they relate to:

```cluub
page Notes at "/notes"
  state draft = ""
  state error = ""
  action add()
    error = "Title must be at least 3 characters"
  view
    row
      input draft, placeholder "Title"
      button "Add", on click add
    if error is not empty
      text error
```

### Errors: rely on the toast, and say what to fix

Validation messages from models, `require` and `fail` reach the toast automatically, and the toast is announced. Write messages that name the field and the fix: `require title.count >= 3, "Title must be at least 3 characters"` beats `"Invalid input"`.

### Custom colors

If you override colors in `theme.css`, re-check contrast, including `--control-border` (form-field edges need 3:1 against `--surface`).

## Known gaps

| Gap | Workaround today |
|---|---|
| Focus isn't moved on the first load or on back/forward navigation | keep the `heading` first in the view, and give each page a clear `title` |
| No other ARIA attributes (`aria-live`, `aria-describedby`, `role`) can be set | use `label`, visible text, and the toast for errors |
| The toast auto-hides after 5 s and is dismissed only by clicking | keep important errors visible in the page, for example with `state error` and `text error` |
| `on click` on containers isn't keyboard accessible | use `button` or `link` |
| No `h3`–`h6` | structure pages with `section` + `subheading` |
| No `prefers-reduced-motion` rule for the spinner and button press effect | add one in `theme.css` |
| UI tests find fields only by placeholder and can't pick a `select` option or tick a `checkbox` | test those paths through the api with `request` |

## See also

* [Pages & components](/guide/frontend)
* [View elements](/reference/view-elements)
* [Properties & events](/reference/properties-events)
* [Testing strategy](/guide/testing-strategy)
* [Glossary](/glossary)
