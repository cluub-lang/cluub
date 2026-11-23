# View elements

A `view` block describes what a page, component or layout shows. Each line starts with an element (`heading`, `button`, `row`, ...), a control word (`for`, `if`, `else`), `slot`, an event block (`on click`), or a capitalized component name. This page lists every element, the HTML it produces, and what it accepts.

## Line shape

```text
element [primary argument] [, property value]... 
  child lines (optional)
```

* The **primary argument** is an expression: text, a number, state, a field. It is optional.
* **Properties** follow, each after a comma: `button "Save", on click save, style primary`. See [Properties & events](/reference/properties-events).
* An indented block under an element holds its **children**. Any element except `input`, `checkbox`, `select` and `image` can have children.

```cluub
page Inbox at "/inbox"
  state messages = []
  state unread = 0
  action refresh()
    unread = 0

  view
    header
      heading "Inbox"
      badge "{unread} new"
    card
      text "You have {messages.count} messages."
      button "Refresh", on click refresh, style primary
```

Every value shown in a view goes through the same text conversion as interpolation: `nothing` shows as an empty string, whole numbers as-is, other numbers rounded to 2 decimal places, lists joined with `, `, objects as JSON.

Member access in views is **null-safe**: `user.name` when `user` is `nothing` shows an empty string instead of failing. (In actions it fails, see [Expressions](/reference/expressions#member-access).)

## Element reference

### Content elements

These take an optional primary argument, which becomes their text (or value, for inputs).

| Element | Renders | Primary argument | Notes |
|---|---|---|---|
| `heading` | `<h1>` | text | Page or section title. |
| `subheading` | `<h2>` | text | |
| `text` | `<p>` | text | A paragraph. |
| `label` | `<label>` | text | Wrap a `checkbox` in it to label the box. |
| `badge` | `<span class="badge">` | text | Small pill for counts and statuses. |
| `item` | `<li>` | text | Meant for use inside `list`. |
| `button` | `<button type="button">` | label | `type "submit"` overrides the type. |
| `link` | `<a href="...">` | label | Target set with `to`. |
| `image` | `<img src="...">` | image URL | Use `alt`. Children are ignored. |
| `input` | `<input>` or `<textarea>` | bound value | Two-way bound. `multiline` makes a textarea. |
| `checkbox` | `<input type="checkbox">` | bound value | Two-way bound to a yes/no value. |
| `select` | `<select>` with `<option>`s | bound value | Choices come from `options`. |

### Containers

Containers take **no** primary argument; put content in child lines.

| Element | Renders | Default class |
|---|---|---|
| `row` | `<div>` | `row` (horizontal) |
| `column` | `<div>` | `col` (vertical) |
| `card` | `<div>` | `card` |
| `box` | `<div>` | none |
| `grid` | `<div>` | `grid` |
| `list` | `<ul>` | none |
| `header` | `<header>` | none |
| `footer` | `<footer>` | none |
| `nav` | `<nav>` | none |
| `section` | `<section>` | none |
| `form` | `<form>` | none; submitting never reloads the page |

### Other elements

| Element | Renders | Notes |
|---|---|---|
| `divider` | `<hr>` | No argument. |
| `spinner` | `<div class="spinner" role="status" aria-label="Loading">` | No argument. Show it while data loads; screen readers announce "Loading" (override with `label`). |
| `slot` | the current page | Layouts only. Takes nothing. |

The classes `row`, `col`, `card`, `grid`, `badge` and `spinner` are styled by the built-in theme. A `style` or `class` property is added after the default class.

## Text elements: `heading`, `subheading`, `text`, `label`, `badge`, `item`

All six put their primary argument in the element as text, followed by any children.

```cluub
page Profile at "/profile"
  state user = {name: "Ada", role: "admin", score: 2.456}
  view
    heading "Hello {user.name}"
    subheading "Account"
    text "Score: {user.score}"
    badge user.role, style muted
    list
      item "First"
      item "Second"
```

`text "Score: {user.score}"` shows `Score: 2.46`.

## `button`

Renders `<button type="button">` with the primary argument as its label. It does nothing until you attach an event.

```cluub
page Counter at "/counter"
  state count = 0
  action increment()
    count = count + 1
  action reset()
    count = 0

  view
    text "Count: {count}"
    row
      button "Add one", on click increment, style primary
      button "Reset", on click reset, style ghost, disabled count is 0
```

* `disabled cond` greys the button out while `cond` is true. In tests, `click` on a disabled button fails.
* The default `type` is `"button"`, so a button inside a `form` does **not** submit it. Write `type "submit"` for a submit button.

## `link`

Renders `<a>`. The primary argument is the label; `to` gives the destination.

```cluub
layout Site
  view
    nav
      link "Home" to "/"
      link "Pricing" to "/pricing"
      link "Docs" to "https://example.com/docs"
    slot
```

* Paths that start with `/` navigate inside the app without reloading the page.
* Addresses starting with `http://` or `https://`, and clicks with Ctrl or Cmd held, are left to the browser.
* Without `to`, the link points to `#`.
* `to` takes any expression, so `link "Open" to "/orders/{order.id}"` works.
* `javascript:` addresses are replaced with `#`.

## `image`

Renders `<img>`. The primary argument is the image address (`src`); add `alt` for screen readers. Child lines are ignored.

```cluub
component ProductPhoto
  takes url: text, name: text
  view
    image url, alt name, class "thumb"
```

## `input`

Renders `<input>` bound **two ways** to the expression in its primary argument: it shows the current value, and every keystroke writes back to it.

```cluub
page Signup at "/signup"
  state email = ""
  state age = 0
  state bio = ""
  action submit()
    email = ""

  view
    input email, placeholder "you@example.com", type "email", on enter submit
    input age, type "number", placeholder "Age"
    input bio, multiline, placeholder "About you"
```

Binding rules:

* Screen readers need a name for each field. An `input` or `select` uses its `placeholder` as its accessible name (`aria-label`) unless you give `label "..."`. A `checkbox` has no placeholder, so give it a `label` property or wrap it in a `label` element.
* The bound expression must start with page **state** or a page loop variable: `input draft`, `input user.name`, `input todo.title` inside `for todo in todos`. Anything else is error **E112**, unless the element has an `on` handler (then it is a display-only field that still runs your handler).
* Components and layouts cannot bind inputs (E112), because they have no state.
* With `type "number"` the typed text is converted with JavaScript `Number`, so an empty field stores `0`. Only the literal `type "number"` triggers this conversion.
* Every other input stores text.
* `multiline` renders `<textarea>` with the same binding.
* Every keystroke re-renders the page, for top-level state (`input draft`) and nested fields (`input user.name`, `input todo.title`) alike.
* If the input also has `on input`, the binding stores the value first and then your handler runs.

## `checkbox`

Renders `<input type="checkbox">`. Checked when the primary argument is truthy; ticking it writes `true` or `false` back. The same binding rules as `input` apply.

```cluub
page Settings at "/settings"
  state agreed = false
  state tasks = [{title: "Write docs", done: false}]
  view
    label "I agree to the terms"
      checkbox agreed
    for task in tasks
      row
        checkbox task.done
        text task.title
```

A checkbox has no text of its own: wrap it in a `label` element (as above), or give it a `label` property, which sets its accessible name without visible text: `checkbox task.done, label "Done: {task.title}"`. If you add `on change`, the binding is updated first and your handler runs after it.

## `select`

Renders `<select>` with one `<option>` per entry in `options`. The selected option is written back as **text**.

```cluub
page Plan at "/plan"
  state plan = "free"
  view
    select plan, options ["free", "pro", "team"]
    text "You picked {plan}"
```

* Each option's value and label are the entry converted to text. A list of objects shows JSON, so pass a list of text.
* A number state bound to a select becomes text once the user picks an option.
* Without `options`, the select is empty.

## Containers: `row`, `column`, `card`, `box`, `grid`, `list`, `header`, `footer`, `nav`, `section`

Containers group child lines. They take no primary argument: `card "Title"` is a syntax error (E010, "Unexpected the text ... at the end of this line"). Put the title in a child: `card` then `heading "Title"`.

```cluub
page Dashboard at "/dashboard"
  state stats = [{label: "Users", value: 12}, {label: "Orders", value: 30}]
  view
    section
      heading "Dashboard"
      grid
        for stat in stats
          card
            subheading stat.label
            text "{stat.value}"
    footer
      text "Updated just now", style muted
```

## `form`

Renders `<form>`. Submitting a form never reloads the page: the browser default is always prevented. Attach the work with `on submit` and give the form a `type "submit"` button. Pressing Enter in a field also submits it.

```cluub
page Contact at "/contact"
  state name = ""
  state sent = false
  action send()
    sent = true

  view
    form, on submit send
      input name, placeholder "Your name"
      button "Send", type "submit", style primary
    if sent
      text "Thanks, {name}!"
```

In tests, `click "Send"` on a `type "submit"` button without its own click handler runs the enclosing form's `on submit`, just as a browser would.

## `divider` and `spinner`

`divider` renders `<hr>` and `spinner` renders `<div class="spinner">`. Neither takes a primary argument; both accept properties such as `class`.

```cluub
page Loading at "/loading"
  state items = nothing
  view
    if items is nothing
      spinner
    else
      divider
```

## `aikey`

Renders the built-in form that lets an **end user add or forget their own AI key** (see [Your own AI keys](/guide/ai-keys)). It takes no argument and no properties.

```cluub
page Settings at "/settings"
  view
    heading "Your AI key"
    aikey
```

| State | What it shows |
|---|---|
| No key saved | A short explanation, a provider choice (Claude, OpenAI, Google Gemini), a password field with the placeholder **Paste your API key**, a **Remember on this device** checkbox and a **Save key** button (disabled until something is typed) |
| Key saved | *"Using your own Claude (Anthropic) key (ending 1a2b)."* and a **Forget my key** button |

The key is kept in the browser only (`sessionStorage`, or `localStorage` when *Remember* is ticked) and sent with the user's api requests in headers. Every control has an accessible name. Use [`hasAiKey()`](/reference/builtins#hasaikey) to react to whether a key is saved. The element only matters when the app sets `aiKeys "user"` or `"either"`; with the default `"server"` the server ignores user keys.

## `slot`

`slot` marks where a layout puts the current page. It is only valid inside a `layout` (anywhere else: E013). The page's view is inserted as `<main class="cluub-page">...</main>` at that spot.

```cluub
layout Main
  view
    header
      link "Home" to "/"
    slot
    footer
      text "Made with Cluub"
```

A layout without `slot` never shows the page, and a layout with two slots shows it twice; both get warning **W107**. Pages without a layout render `<main class="cluub-page">` directly.

## `for` in views

`for name in expression` repeats its child lines once per item. The loop variable is visible to the children, including their event handlers.

```cluub
page Todos at "/todos"
  state todos = [{id: "1", title: "Milk"}]
  action remove(id: text)
    todos = todos.where(t => t.id is not id)

  view
    list
      for todo in todos
        item todo.title
          button "Remove", on click remove(todo.id), style danger
```

* `nothing` gives zero repetitions. A text value repeats once per character. Any other single value repeats once.
* There is no index variable and no keyed diffing: the DOM is patched position by position.

## `if` / `else` in views

`if cond` shows its child lines when `cond` is truthy. `else` and `else if` follow at the same indentation.

```cluub
page Status at "/status"
  state count = 0
  view
    if count is 0
      text "Nothing yet"
    else if count is greater than 99
      text "Lots"
    else
      text "{count} items"
```

Truthiness follows JavaScript: `0`, `""`, `nothing` and `no` are false, but an empty list is **true**. Write `if items is empty` rather than `if items`.

## Using components

A capitalized name renders a component: `Name prop: value, other: value`. Every argument is named.

```cluub
component TodoRow
  takes title: text, done: bool = false, onRemove: action
  view
    row
      text title
      if done
        badge "done"
      button "Remove", on click onRemove(title), style danger

page List at "/list"
  state titles = ["Milk", "Eggs"]
  state removed = 0
  action remove(title: text)
    titles = titles.where(t => t is not title)
  action countRemoval()
    removed = removed + 1
  view
    for t in titles
      TodoRow title: t, onRemove: remove
    text "Removed: {removed}"
    TodoRow title: "Demo", onRemove: countRemoval()
```

* Arguments must match the component's `takes` (E114 for unknown or missing ones). Properties with a default or a `?` type may be left out.
* A component line takes no child lines and no properties such as `class`.
* The component's elements are inserted in place; there is no wrapper element.
* For an `action` property, pass either the **name** of an action or a **call**:
  * `onRemove: removeFirst` forwards whatever arguments the component passes (the component's `on click onRemove(title)` calls `remove(title)`).
  * `onRemove: countRemoval()` runs that exact call when the component triggers it; arguments supplied by the component are ignored. Inside a `for` loop the call can use the loop variable (`onRemove: remove(t)`).

## Edge cases & limits

* **Primary argument vs property.** A property word (`on`, `to`, `placeholder`, `type`, `disabled`, `class`, `alt`, `label`, `style`, `options`) right after an element is read as the element's **value** when it is followed by a comma or the end of the line, so state with those names can be shown and bound: `select style, options ["dark", "light"]`, `text type`. Followed by anything else, it is read as a property: `text style primary` is a paragraph with no value and the class `primary`. `multiline` is always a property.
* **Calls to apis or actions inside a view expression** (`text "{OrderApi.count()}"`, `text "{total()}"`) are error **E117**: `A view can't call an api or an action while it is being drawn.` Load the data into state in `when loaded` or an action, then show the state. Event handlers and action arguments for components are not affected.
* Anything that waits can't run while a view is drawn: an api call, a page action, `sleep(...)`, or calling a component's `action` property (`text "{onPick()}"`). All of these are compile error **E117**; call them from handlers instead.
* An `on ...` line placed directly under `view` (not under an element) is silently ignored.
* Inputs display their value through text conversion, so a number state of `3.14159` shows as `3.14` in the field.
* Unknown element names report E013 with a "Did you mean" hint; the rest of the view is still checked.
* Elements of the same position are reused between renders; a changed tag replaces the element.

## See also

* [Properties & events](/reference/properties-events)
* [Expressions](/reference/expressions)
* [Statements](/reference/statements)
* [Pages & components guide](/guide/frontend)
