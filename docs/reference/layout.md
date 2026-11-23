# layout

A `layout` is the frame around pages: the header, navigation and footer that stay the same while the page in the middle changes. It is a view with one special element, `slot`, which marks where the page goes. A page opts in with `layout Name`. Layouts have no properties, state, actions or dependencies, so they show the same thing on every page that uses them.

## Syntax

```cluub
layout Main
  about "Header and footer for every page"
  view
    header
      link "Home" to "/"
      nav
        link "Orders" to "/orders"
        link "About" to "/about"
    slot
    footer
      text "© 2026 Shop"
```

The full shape:

```text
layout Name
  [about "description"]
  view
    view elements...
    slot
    view elements...
```

Using it from a page:

```text
page Orders at "/orders"
  layout Main
  ...
```

## Members / options

| Member | What it does | Required? | Default |
|---|---|---|---|
| `about "text"` | Describes the layout. | No | none |
| `view` | The frame. Any [view elements](/reference/view-elements), components, `for` and `if`, plus `slot`. | No | draws nothing, so the page disappears (W107) |
| `slot` (inside the view) | Where the page's content is placed. Exactly one is expected (W107 otherwise). | In practice, yes | none |

## Behaviour

**Drawing.** When a page with `layout Main` is drawn, Cluub draws the page's view inside a `<main class="cluub-page">` element, then draws the layout's view with that element in place of `slot`. Without a layout, the `<main>` element is drawn on its own. The layout is drawn again on every redraw of the page, so it is always current.

**Where `slot` can go.** Anywhere in the layout's view, including inside containers (`section`, `row`, `column`, `box`…) and inside `if` blocks. `slot` anywhere other than a layout is [E013](/reference/errors#e013): `` `slot` only makes sense inside a layout (it marks where the page goes). ``

**Exactly one `slot`.** A layout without `slot` would hide every page that uses it, and a layout with two would show each page twice. Both compile, but give warning [W107](/reference/errors#w107): ``Layout Main has no `slot`, so pages that use it will not appear.`` or `Layout Main has 2 slots, so pages that use it will appear 2 times.`

**Links.** `link "Orders" to "/orders"` in a layout navigates without reloading, like everywhere else. When the page changes, the layout is drawn again around the new page.

**What a layout can use.** View elements, components (with literal values, since a layout has nothing else to pass), models, and built-ins such as `today()` or `round(...)`. It cannot have `takes`, `state`, `action`, `uses` or `when loaded` ([E012](/reference/errors#e012): `` `takes` is not allowed inside a layout. `` with hint `A layout can contain: about, view.`). `input`, `checkbox` and `select` without an `on` handler are [E112](/reference/errors#e112). Event handlers must call an action ([E113](/reference/errors#e113)), and a layout has none, so in practice layouts use `link` for interaction. `ask ai` and `env` are [E204](/reference/errors#e204) and [E205](/reference/errors#e205).

**Choosing a layout.** Each page names at most one layout. Pages without `layout` have no frame. An unknown layout name is [E116](/reference/errors#e116): `Unknown layout "Mian".` with a "Did you mean" hint when a close name exists.

**Folder and naming.** Layouts live in `ui/layouts/` ([E301](/reference/errors#e301)). The name is PascalCase ([E102](/reference/errors#e102)); `Main` is the convention for the default frame.

## Errors

| Code | Message (example) | Fix |
|---|---|---|
| [E012](/reference/errors#e012) | `` `takes` is not allowed inside a layout. `` (hint: `A layout can contain: about, view.`) | Layouts take no data. Move data-driven parts into the page. |
| [E013](/reference/errors#e013) | `` `slot` only makes sense inside a layout (it marks where the page goes). `` | Remove `slot` from pages and components. |
| [E013](/reference/errors#e013) | `` `sidebar` is not a view element. `` | Use a listed element (for example `nav` or `section`). |
| [E101](/reference/errors#e101) | `"Main" is declared twice (…)` | Rename one layout. |
| [E102](/reference/errors#e102) | `"main" should be PascalCase (…)` | Rename. |
| [E112](/reference/errors#e112) | `` `input` must be bound to page state so it can store what the user types. `` | Put inputs in pages. |
| [E113](/reference/errors#e113) | ``An event must call an action, like `on click save` or `on click remove(todo.id)`.`` | Use `link` instead of a button handler. |
| [E116](/reference/errors#e116) | `Unknown layout "Mian".` (reported on the page) | Fix the page's `layout` line or declare the layout. |
| [W107](/reference/errors#w107) | ``Layout Main has no `slot`, so pages that use it will not appear.`` / `Layout Main has 2 slots, so pages that use it will appear 2 times.` (hint: ``Keep exactly one `slot`.``) | Keep exactly one `slot`. |
| [E301](/reference/errors#e301) | `A layout belongs in the "ui/layouts" folder, but "Main" is in ui/pages/main.clb.` | Move it. |

## Examples

**1. The minimum.**

```cluub
layout Plain
  view
    slot
```

**2. A site frame with navigation and a component.**

```cluub
component Logo
  takes size: text = "small"
  view
    badge "Shop", class "logo-{size}"

layout Main
  about "The standard frame"
  view
    header
      row
        Logo size: "large"
        nav
          link "Products" to "/"
          link "Cart" to "/cart"
          link "Help" to "https://example.com/help"
    section
      slot
    footer
      text "© 2026 Shop · All prices include VAT", style muted
```

**3. Two layouts, tested through pages.**

```cluub
layout Main
  view
    header
      link "Home" to "/"
    slot
    footer
      text "Made with Cluub"

layout Focus
  about "No navigation, for checkout"
  view
    column
      subheading "Checkout"
      slot

page Home at "/"
  about "Landing page"
  layout Main
  view
    heading "Welcome"
    link "Check out" to "/checkout"

page Checkout at "/checkout"
  about "Paying"
  layout Focus
  view
    text "Review your order"

test "pages are wrapped in their layouts"
  render Home
  expect screen has "Made with Cluub"
  expect screen has "Welcome"
  click "Check out"
  expect screen has "Review your order"
  expect screen has "Checkout"
  expect not (screen has "Made with Cluub")
```

## Edge cases & limits

* **The `slot` count is a warning, not an error.** A layout without `slot` (W107) still builds, and every page that uses it shows only the frame. With two `slot`s each page is drawn twice.
* **No data in layouts.** A layout cannot show the signed-in user, a cart count or the current page's title, because it has no properties or state. Put such parts in each page, or in a component the page uses.
* **No active-link styling.** There is no built-in way to highlight the link of the current page.
* **No nested layouts.** A layout cannot use another layout, and a page has at most one.
* **Event handlers are effectively unusable**, since a layout has no actions to call. Use `link`.
* **The whole layout is redrawn with the page.** That is cheap, but it means nothing in a layout keeps its own state between pages.

## See also

* [page](/reference/page)
* [component](/reference/component)
* [View elements](/reference/view-elements)
* [Pages & components guide](/guide/frontend#layouts)
