# component

A `component` is a reusable piece of view. It receives everything it shows through `takes` properties, including `action` properties for what should happen when the user clicks. It has no state, no actions of its own and no dependencies. Pages own the data and pass it down; components only display it. This "smart page, simple component" split keeps components easy to reuse and test, and the compiler enforces it.

## Syntax

```cluub
component OrderCard
  about "One order in a list"
  takes order: Order, onCancel: action
  view
    card
      text "Order {order.id}: {order.total}"
      button "Cancel", on click onCancel(order.id), style danger
```

The full shape:

```text
component Name
  [about "description"]
  [takes prop: type [= default], prop2: type?, onSomething: action, ...]...
  view
    view elements...
```

Using it, in a page, a layout or another component's view:

```text
Name prop: value, onSomething: pageAction
```

## Members / options

| Member | What it does | Required? | Default |
|---|---|---|---|
| `about "text"` | Describes the component. | No | none |
| `takes p: type, ...` | Declares properties. The line can repeat; all lines add up. | No | no properties |
| property `p: type` | A required property. Any type: built-in, a model, a list, or `action`. | | |
| property `p: type = value` | Optional property with a default, used when the caller leaves it out. | No | |
| property `p: type?` | Optional property; `nothing` when left out. | No | |
| property `p: action` | A callback. The caller passes the name of one of its actions. Required unless written `action?`. | | |
| `view` | What the component draws. See [View elements](/reference/view-elements). | No | draws nothing |

## Behaviour

**Using a component.** In any view, a line that starts with a capital letter is a component: `OrderCard order: o, onCancel: cancel`. Properties are always named (`name: value`) and separated by commas. The compiler checks that:

* the component exists ([E105](/reference/errors#e105): `"OrderCrad" is not a component.`),
* every property passed is one it takes ([E114](/reference/errors#e114): `OrderCard doesn't take "item".`),
* every property without a default or `?` is passed ([E114](/reference/errors#e114): `OrderCard needs "order".`),
* an `action` property is given an action of the caller ([E113](/reference/errors#e113)).

**Drawing.** A component is a function of its properties. Each time the page redraws, the component is drawn again with the current values. Defaults are applied when a property is missing. Reading a field of `nothing` inside a component view gives an empty value instead of an error (`{order.total}` shows nothing while `order` is `nothing`).

**Action properties.** Inside the component, call the property like an action in an event: `on click onCancel(order.id)` or `on click onSave`. The call goes to the page's action. It runs like any page action, so it is awaited, can call apis, and its errors become a toast. The caller can pass an action in two ways:

* **By name**, `onCancel: cancel`: the arguments come from the component (`onCancel(order.id)` calls `cancel(order.id)`).
* **As a call**, `onPick: pick(item.id)`: the arguments are fixed by the caller. Nothing runs while drawing; the call runs each time the component fires the callback, and any arguments the component passes are ignored.

**What a component cannot do.**

| Not allowed | Error |
|---|---|
| `uses` | [E203](/reference/errors#e203) `Components cannot use dependencies.` (hint: ``Pass data in with `takes` (pages own data, components display it).``) |
| `state`, `action`, `when loaded`, `title`, `layout` | [E012](/reference/errors#e012) |
| `input`, `checkbox` or `select` without an `on` handler | [E112](/reference/errors#e112), since there is no state to bind to |
| `go to` in an event block | [E201](/reference/errors#e201) |
| `ask ai`, `env` | [E204](/reference/errors#e204), [E205](/reference/errors#e205) |
| `slot` | [E013](/reference/errors#e013) |

Components may use other components and models (as property types, or `Model(...)` values in the view).

**Folder and naming.** Components live in `ui/components/` ([E301](/reference/errors#e301)). The name is PascalCase (it must start with a capital letter to be recognised in a view); property names are camelCase ([E103](/reference/errors#e103)).

## Errors

| Code | Message (example) | Fix |
|---|---|---|
| [E010](/reference/errors#e010) | ``Expected `:` but found …`` (hint: ``Pass properties as `order: value`.``) | Name every property when using a component. |
| [E012](/reference/errors#e012) | `` `state` is not allowed inside a component. `` | Move state to the page and pass it in. |
| [E103](/reference/errors#e103) | `The property "On_cancel" should be camelCase (…)` | Rename. |
| [E105](/reference/errors#e105) | `"OrderCrad" is not a component.` / `Unknown type "Ordr".` | Fix the name. |
| [E112](/reference/errors#e112) | `` `input` must be bound to page state so it can store what the user types. `` | Put inputs in the page, or give the input an `on change` handler that calls an action property. |
| [E113](/reference/errors#e113) | ``An event must call an action, like `on click save` or `on click remove(todo.id)`.`` | Call an action property. |
| [E114](/reference/errors#e114) | `OrderCard needs "order".` / `OrderCard doesn't take "item".` (hint: `Did you mean "order"?`) | Match the `takes` list. |
| [E201](/reference/errors#e201) | `` `go to` navigates between pages, so it only works in pages and tests. `` | Use a `link`, or an action property that navigates in the page. |
| [E203](/reference/errors#e203) | `Components cannot use dependencies.` | Remove `uses`; let the page load the data and pass it in with `takes`. |
| [E301](/reference/errors#e301) | `A component belongs in the "ui/components" folder, but "OrderCard" is in ui/pages/orders.clb.` | Move it. |

## Examples

**1. A display-only component.**

```cluub
component PriceTag
  about "A price with its currency"
  takes amount: number, currency: text = "EUR"
  view
    badge "{round(amount, 2)} {currency}"
```

Use it as `PriceTag amount: product.price` or `PriceTag amount: 10, currency: "USD"`.

**2. A component with action properties, used in a list.**

```cluub
model Todo
  title: text, required
  done: bool = false

component TodoRow
  about "One todo with its buttons"
  takes todo: Todo, onToggle: action, onRemove: action
  view
    row
      checkbox todo.done, on change onToggle(todo.id)
      text todo.title, class "grow"
      button "Remove", on click onRemove(todo.id), style ghost

page Todos at "/"
  about "All todos"
  uses TodoApi
  state todos = []

  when loaded
    todos = TodoApi.list()

  action toggle(id: text)
    TodoApi.toggle(id)
    todos = TodoApi.list()

  action remove(id: text)
    TodoApi.remove(id)
    todos = TodoApi.list()

  view
    for todo in todos
      TodoRow todo: todo, onToggle: toggle, onRemove: remove
```

The checkbox in `TodoRow` is allowed because it has an `on change` handler; it shows `todo.done` and reports clicks to the page.

**3. Components inside components, optional properties and both ways of passing an action, tested through a page.**

```cluub
component Avatar
  takes name: text, photo: url?
  view
    if photo is nothing
      badge name.first
    else
      image photo, alt name

component UserCard
  about "A user with an avatar and an optional note"
  takes name: text, photo: url?, note: text = "No note", onOpen: action
  view
    card
      row
        Avatar name: name, photo: photo
        subheading name
      text note, style muted
      button "Open", on click onOpen(name)

page Team at "/team"
  about "The team"
  state opened = ""

  action open(name: text)
    opened = name

  view
    UserCard name: "Ada", onOpen: open
    UserCard name: "Linus", note: "On holiday", onOpen: open("Linus T.")
    if opened is not empty
      text "You opened {opened}"

test "the team page shows defaults and handles clicks"
  render Team
  expect screen has "No note"
  expect screen has "On holiday"
  click "Open"
  expect screen has "You opened Ada"
```

The first card passes `open` by name, so the component's `onOpen(name)` calls `open("Ada")`. The second passes a call, so clicking its button always runs `open("Linus T.")`.

## Edge cases & limits

* **No local state.** A component cannot remember anything (an open/closed toggle, a draft). Keep it in the page and pass it down with an action property to change it.
* **Property types are not checked at runtime.** `takes amount: number` documents intent; passing text is not caught.
* **No children or slots.** A component cannot wrap content passed by the caller; only layouts have `slot`.
* **Required properties are checked only by name.** Passing `nothing` to a required property is allowed.
* **A component cannot call apis** directly. It can only ask the page to do so through an action property.
* **Recursion** (a component that uses itself) is not detected and would loop forever if the data does not end.

## See also

* [page](/reference/page)
* [layout](/reference/layout)
* [View elements](/reference/view-elements)
* [Properties & events](/reference/properties-events)
* [Pages & components guide](/guide/frontend)
