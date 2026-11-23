# Pages & components

## Pages

A page has a URL, **state** (data that changes), **actions** (what users do) and a **view**.

```cluub
page Profile at "/users/{id}"
  about "Shows one user"
  title "Profile"
  layout Main
  uses UserApi
  state user = nothing
  state editing = false

  when loaded
    user = UserApi.get(id)

  action startEditing()
    editing = true

  action save()
    user = UserApi.update(id, name: user.name)
    editing = false

  view
    if user is nothing
      spinner
    else
      heading user.name
      if editing
        input user.name
        button "Save", on click save, style primary
      else
        button "Edit", on click startEditing
```

* Change state and the view updates. There's no `setState` or hooks.
* `when loaded` runs when the page opens. Path parameters (`{id}`) are available by name.
* If any action fails, for example the server says *"name is required"*, the message appears as a toast automatically.
* `go to "/somewhere"` navigates without a page reload.

## View elements

| Element | Example |
|---|---|
| `heading`, `subheading`, `text`, `label`, `badge` | `heading "Hi {name}"` |
| `button` | `button "Save", on click save, style primary, disabled draft is empty` |
| `input` (two-way bound to state) | `input email, placeholder "you@example.com", type "email", on enter save` |
| `input ..., multiline` | a textarea |
| `checkbox` | `checkbox agreed` |
| `select` | `select plan, options ["free", "pro"]` |
| `link` | `link "Pricing" to "/pricing"` |
| `image` | `image product.photo, alt product.name` |
| Containers | `row`, `column`, `card`, `box`, `grid`, `list` + `item`, `header`, `footer`, `nav`, `section`, `form` |
| Other | `divider`, `spinner` |
| Logic | `for x in list`, `if … else` |

Styles: `style primary | danger | ghost | muted`, or `class "my-class"` with your own `theme.css`.

Longer event handlers can be a block:

```cluub
button "Clear"
  on click
    draft = ""
    results = []
```

## Components

Components display what they're given. They have no state and no dependencies, which keeps them reusable and easy to test.

```cluub
component ProductCard
  about "One product in the grid"
  takes product: Product, onBuy: action
  view
    card
      image product.photo, alt product.name
      subheading product.name
      text "{product.price} EUR"
      button "Buy", on click onBuy(product.id), style primary
```

Use it from a page: `ProductCard product: p, onBuy: buy`.

## Layouts

```cluub
layout Main
  view
    header
      link "Shop" to "/"
      nav
        link "Cart" to "/cart"
    slot
    footer
      text "© 2026 Shop"
```

Put `layout Main` in a page. `slot` is where the page goes.

## Look and feel

The built-in theme is clean, responsive and supports dark mode. Override any variable in `theme.css` at the project root:

```css
:root { --primary: #e11d48; --radius: 4px; --font: "Inter", sans-serif; }
```
