# Properties & events

Properties adjust a view element: where a link goes, what an input shows when empty, which action a click runs. They follow the element's primary argument, each after a comma. Events are properties too (`on click save`), and can also be written as an indented block of statements.

```cluub
page Search at "/search"
  state query = ""
  state results = []
  action search()
    results = []

  view
    input query, placeholder "Search...", on enter search
    button "Go", on click search, style primary, disabled query is empty
```

## Property reference

| Property | Value | Applies to | Effect |
|---|---|---|---|
| `on` | `on EVENT handler` | any element | Runs an action when the event fires. See [Events](#events). |
| `to` | expression | `link` | Destination address (`href`). Ignored on other elements. |
| `placeholder` | expression | any (useful on `input`) | Sets the `placeholder` attribute. Tests find inputs by it. |
| `type` | expression | `input`, `button` (any element) | Sets the `type` attribute. `type "number"` on an input stores numbers. |
| `disabled` | condition | any (useful on `button`, `input`) | Disabled while the condition is truthy. |
| `class` | expression | any | Adds CSS classes. |
| `alt` | expression | any (useful on `image`) | Sets the `alt` attribute. |
| `label` | expression | any (useful on `checkbox`, `input`, `select`, icon buttons) | Sets the accessible name (`aria-label`) read by screen readers. |
| `style` | a word, or an expression | any | Adds a class from the theme: `primary`, `danger`, `ghost`, `muted`. |
| `multiline` | none | `input` | Renders a `<textarea>` instead of `<input>`. |
| `options` | list expression | `select` | The choices shown in the select. |

Properties can come in any order. A property name may not repeat in a useful way: for `to`, `placeholder`, `type`, `alt`, `label`, `class`, `style`, `disabled` and `options`, the first occurrence wins.

A property word written directly after the element and followed by a comma or the end of the line is the element's value, not a property. This lets you bind state named like a property: `select style, options ["dark", "light"]`.

### `to`

```cluub
page Orders at "/orders"
  state orders = [{id: "7", total: 20}]
  view
    for order in orders
      link "Order {order.id}" to "/orders/{order.id}"
```

Internal paths (starting with `/`) navigate without a reload. `http://` and `https://` addresses open normally. A link without `to` points to `#`.

### `placeholder`

Shown inside an empty field. Test statements locate fields by placeholder: `type "Milk" into "New todo"` matches the first input or textarea whose placeholder contains `New todo`, ignoring case. An input without a placeholder cannot be targeted by `type ... into`.

### `type`

Sets the HTML `type` attribute.

* On `input`: `"number"`, `"email"`, `"password"`, `"date"`, and other HTML input types. Only the literal text `type "number"` makes the binding convert typed text to a number (an empty field becomes `0`). Other types store text.
* On `button`: the default is `"button"`. Use `type "submit"` inside a `form`.
* On `checkbox`: always `"checkbox"`; a `type` property is overridden.

### `disabled`

`disabled cond` evaluates `cond` on every render and sets the element's `disabled` flag to its truthiness.

```cluub
page Checkout at "/checkout"
  state total = 0
  state agreed = false
  action pay()
    total = 0
  view
    label "I agree"
      checkbox agreed
    button "Pay {total}", on click pay, disabled not agreed or total is 0
```

`click` in a test fails with `The "Pay" button is disabled.` when it targets a disabled button.

### `class` and `style`

Both add CSS classes to the element's `class` attribute, after the element's default class (`row`, `col`, `card`, `grid`, `badge`, `spinner`). `style` comes first, then `class`.

* `style primary` takes a bare **word** and uses it literally as a class name. The built-in theme defines `primary`, `danger`, `ghost` and `muted`. Any other word is accepted and becomes a class with no styling unless your `theme.css` defines it.
* Because `style` treats a bare word literally, `style kind` adds the class `kind`, not the value of a variable named `kind`. For a dynamic style use text: `style "{kind}"`.
* `class` always takes an expression: `class "wide shadow"` or `class someState`.

### `alt`

Alternative text for images. It is set as an attribute on whatever element carries it.

### `label`

Sets the element's accessible name, written as the `aria-label` attribute. It is not visible; screen readers announce it.

```cluub
page Todos at "/todos"
  state todos = [{title: "Milk", done: false}]
  state query = ""
  view
    input query, placeholder "Search"
    for todo in todos
      row
        checkbox todo.done, label "Done: {todo.title}"
        text todo.title
    spinner, label "Loading todos"
```

* `input` and `select` without `label` use their `placeholder` as the accessible name, so `input query, placeholder "Search"` is announced as "Search".
* `spinner` is announced as "Loading" unless it has a `label`.
* The `label` **property** is different from the `label` **element**, which renders visible `<label>` text.

### `multiline`

Takes no value. On `input` it renders a `<textarea>` with the same two-way binding. On other elements it has no effect.

### `options`

The list of choices for a `select`. Each entry is converted to text for both the option's value and its label.

```cluub
page Filter at "/filter"
  state sizes = ["S", "M", "L"]
  state size = "M"
  view
    select size, options sizes
```

## Events

`on EVENT handler` attaches a handler. Seven event names have special handling:

| Event | DOM handler | Fires when |
|---|---|---|
| `click` | `onclick` | The element is clicked. |
| `change` | `onchange` | The value is committed (checkbox ticked, select picked, text field left after editing). |
| `input` | `oninput` | Every keystroke in a field. On a bound input it runs after the value is stored. |
| `enter` | `onkeydown` | The Enter key is pressed in the element. The default action is prevented. |
| `submit` | `onsubmit` | A form is submitted. The page reload is always prevented. |
| `blur` | `onblur` | The element loses focus. |
| `focus` | `onfocus` | The element gains focus. |

Any other name is passed through as `on` + name, so `on mouseover hint` sets `onmouseover`. Only the seven above are supported and tested.

### Inline handlers

An inline handler is an action name or a call to one:

```cluub
page Cart at "/cart"
  state items = [{id: "1", name: "Tea"}]
  state last = ""
  action clear()
    items = []
  action remove(id: text)
    items = items.where(i => i.id is not id)
    last = id

  view
    for item in items
      row
        text item.name
        button "Remove", on click remove(item.id)
    button "Clear", on click clear, style danger
```

Rules for inline handlers (error **E113** otherwise):

* The handler must be a name, or a call whose callee is a name.
* That name must be one of the page's own actions, a component property of type `action`, or a local name.
* `on click clear` calls `clear()` with no arguments. The DOM event is not passed.
* `on click remove(item.id)` evaluates the arguments when the click happens, using the loop variable of that row. Arguments may be named: `remove(id: item.id)`.
* Calling an api or a service directly (`on click CartApi.clear()`) is E113. Use an action or an event block.

### Event blocks

Put `on EVENT` on its own line, indented under the element, and write statements under it:

```cluub
page Notes at "/notes"
  state note = ""
  state saved = []
  view
    input note, placeholder "Note"
    button "Save"
      on click
        saved.add(note)
        note = ""
    for s in saved
      text s
```

An event block can contain any statement allowed in a page action: `let`, assignment, `if`, `for`, `require`, `fail`, `try`, `log`, `go to`, and calls to apis listed in the page's `uses`. Loop variables of enclosing `for` lines are in scope. If the same event is given both inline and as a block on one element, the block wins.

### What handlers may call

| From a handler you can call | Example |
|---|---|
| The page's own actions | `on click save` |
| Action properties of a component | `on click onRemove(item.id)` |
| Apis declared with `uses` (event blocks or actions only) | `TodoApi.remove(id)` |
| Built-ins and methods | `count = round(count, 0)` |

Calls to page actions, apis, component action properties and `sleep` are awaited automatically, in order.

### Error toast and re-render

Every handler created by `on` runs through one wrapper:

1. The handler runs (and awaits any calls).
2. If it throws, the page shows a **toast**: `<div class="cluub-toast" role="alert">` after the page content. Known Cluub errors (`fail`, `require`, validation errors, api errors with the server's message) show their message as-is. Other errors show `Something went wrong: <message>` and are logged to the browser console.
3. Whether it succeeded or failed, the page re-renders.

The toast disappears after 5 seconds, when clicked, or when the user navigates. A new error replaces the current toast. `when loaded` runs through the same wrapper.

State assignments (`count = count + 1`) also schedule a re-render on their own, batched so several assignments in one handler cause one render.

Handlers run when an event fires, so they may call apis and actions. Calling them while the view is being drawn (inside a view expression such as `text "{total()}"`) is error **E117**.

## Binding and events together

`input`, `checkbox` and `select` bind their primary argument to state. How your own events combine with the binding:

| Element | Binding uses | Your `on change` | Your `on input` |
|---|---|---|---|
| `input` | `input` event | runs normally | runs after the value is stored |
| `checkbox` | `change` event | runs after the value is stored | runs normally |
| `select` | `change` event | runs after the value is stored | runs normally |

Because the binding always runs first, a handler can read the new value from state:

```cluub
page Live at "/live"
  state query = ""
  state length = 0
  action measure()
    length = query.count
  view
    input query, placeholder "Type", on input measure
    text "{length} characters"
```

Every keystroke also re-renders the page, including for nested bindings such as `input user.name`.

## Edge cases & limits

* Only the literal `type "number"` turns on number conversion; `type kind` where `kind` is `"number"` does not.
* `style` with a bare word never reads a variable. Use `style "{word}"` for dynamic styles.
* An inline handler cannot be an assignment (`on click count = 0` is a syntax error). Use an event block.
* Handlers do not receive the DOM event object; there is no `event.target` in Cluub.
* `on enter` checks `key == "Enter"` on keydown, so it fires on any focusable element, not just inputs.
* Unknown event names are not checked. A typo like `on clik save` compiles and never fires.
* In tests, `click` fires `onclick`, or, for a `type "submit"` button without one, the enclosing form's `on submit`. `type ... into` fires the field's `oninput` (the binding, then any `on input` handler). `change`, `blur`, `focus` and `enter` handlers cannot be triggered from a test.

## See also

* [View elements](/reference/view-elements)
* [Statements](/reference/statements)
* [Runtime errors](/reference/runtime-errors)
* [Testing guide](/guide/testing)
