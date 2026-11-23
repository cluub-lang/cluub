# page

A `page` is one screen of the frontend, shown at a URL. It owns **state** (values that change), **actions** (what users do), an optional `when loaded` block that runs when the page opens, and a **view** that describes what is on screen. Assigning to state redraws the view, so there is no `setState` or hook to call. Pages reach the backend only through apis, by calling routes by name. Every call is awaited, and any error appears as a toast on the page.

## Syntax

```cluub
page Orders at "/orders"
  about "Lists orders and places new ones"
  title "Orders"
  layout Main
  uses OrderApi
  state orders = []
  state total = 0

  when loaded
    orders = OrderApi.list()

  action place()
    OrderApi.place(customerId: "1", total: total)
    total = 0
    orders = OrderApi.list()

  view
    heading "Orders"
    row
      input total, type "number", placeholder "Total"
      button "Place order", on click place, style primary, disabled total is 0
    for order in orders
      text "Order {order.id}: {order.total}"
    if orders is empty
      text "No orders yet."
```

The full shape:

```text
page Name at "/path/{param}"
  [about "description"]
  [title <text expression>]
  [layout LayoutName]
  [uses Api1, Api2]...
  [state name[: type] = <starting value>]...
  [when loaded
    statements...]
  [action name[(params)] [-> type]
    statements...]...
  view
    view elements...
```

Members can appear in any order.

## Members / options

| Member | What it does | Required? | Default |
|---|---|---|---|
| `at "/path"` | The URL. `{name}` segments become path parameters, readable by name anywhere in the page (as text). | Yes | none |
| `about "text"` | Describes the page (W104 if missing). | No (suggested) | none |
| `title <expr>` | Browser tab title. An expression, so `"Order {id}"` or state can be used. | No | the page name |
| `layout Name` | Wraps the page in a [layout](/reference/layout). | No | no layout |
| `uses Api1, Api2` | Apis this page calls. | No | none |
| `state name = value` | A piece of page state with a starting value. States are set up in the order written, so a starting value can use earlier states (`state total = price * 2`). An optional type (`state user: User = nothing`) documents it. | No | none |
| `when loaded` | Statements run every time the page opens. | No | none |
| `action name(...)` | An async function the view's events call. Same syntax as service actions. | No | none |
| `view` | The elements on screen. See [View elements](/reference/view-elements) and [Properties & events](/reference/properties-events). | No, but W106 without it | blank page |

## Behaviour

**Opening a page.** When the URL changes (first load, a `link`, `go to`, or the browser's back and forward buttons):

1. The pages are matched against the path in declaration order; trailing slashes and the query string are ignored. If none match, a built-in "Page not found" screen is shown.
2. A **fresh** page instance is created: every `state` starts again from its starting value, evaluated now, top to bottom.
3. The view is drawn once (inside the layout, if any) and the tab title is set.
4. `when loaded` runs. Each api call in it is awaited; the view redraws when it finishes and after any state change.

State is not kept when you leave a page and come back.

**State and redrawing.** Assigning a state (`orders = ...`) schedules a redraw. Redraws are batched, so several assignments in a row draw once. A redraw also happens after every action and event handler finishes. `input`, `checkbox` and `select` are two-way bound to the state they name: typing updates the state.

**Actions.** An action runs when an event calls it (`on click place`, `on click remove(order.id)`) or when another action or `when loaded` calls it by name. Actions are async and every api call is awaited. An action can take parameters with types and defaults. Inside actions and `when loaded`, you can use `let`, assignment, `if`, `for`, `while`, `try` / `catch`, `require`, `fail`, `log`, `return` and `go to "/path"`.

**The view only draws.** A view shows state, properties and parameters; it cannot call an api route or a page action while it is drawn ([E117](/reference/errors#e117)). Load data into state in `when loaded` or an action, and call actions from events (`on click save`).

**Calling apis.** `OrderApi.list()` sends a request to the route and returns the parsed JSON. Arguments follow the route's parameter order (path parameters first, then `with` parameters) and may be named. The compiler checks route names and arguments. If the server answers with an error status, the call throws an error carrying the server's message.

**Errors.** Any error thrown during an action, an event or `when loaded` is caught and shown as a toast at the bottom of the screen with the error's message (for example *"title must be at least 3 characters"* from a 400). The rest of that action does not run. The toast disappears after 5 seconds or when clicked, and is cleared on navigation. Unexpected JavaScript errors show *"Something went wrong: …"*. An error while drawing the view replaces the page with *"This page hit an error while drawing: …"*.

**Navigation.** `go to "/orders/{id}"` changes the URL without a reload and opens the matching page. `link "Orders" to "/orders"` does the same on click (external `https://` links and Ctrl/Cmd-click behave normally).

**Layer rules.** A page may only use apis ([E201](/reference/errors#e201) for stores, clients and services). `ask ai` ([E204](/reference/errors#e204)) and `env` ([E205](/reference/errors#e205)) are not allowed in the UI. Test statements are not allowed ([E120](/reference/errors#e120)).

**Folder and naming.** Pages live in `ui/pages/` ([E301](/reference/errors#e301)). The page name is PascalCase; state, action and parameter names are camelCase ([E103](/reference/errors#e103)).

**Suggestions.** W105 for a state that is never used, W106 for a page without a view, W101 for an unused api in `uses`.

## Errors

| Code | Message (example) | Fix |
|---|---|---|
| [E010](/reference/errors#e010) | ``Expected `at` but found …`` (hint: ``Pages look like `page Home at "/"`.``) | Give the page a path. |
| [E010](/reference/errors#e010) | ``Expected `=` but found the end of the line.`` (hint: ``State needs a starting value, e.g. `state count = 0`.``) | Give every state a starting value. |
| [E010](/reference/errors#e010) | ``Expected `loaded` but found `opened`.`` | The only `when` block is `when loaded`. |
| [E012](/reference/errors#e012) | `` `takes` is not allowed inside a page. `` (hint lists: about, uses, layout, title, state, when, action, view) | Use a page member. |
| [E013](/reference/errors#e013) | `` `paragraph` is not a view element. `` / `` `slot` only makes sense inside a layout (it marks where the page goes). `` | Use a listed element. |
| [E103](/reference/errors#e103) | `The state "Bad_name" should be camelCase (…)` | Rename. |
| [E105](/reference/errors#e105) | `"OrderCrad" is not a component.` / `I don't know what "ordrs" is.` | Fix the name. |
| [E106](/reference/errors#e106) | `Orders uses OrderApi but doesn't declare it.` | Add `uses OrderApi`. |
| [E107](/reference/errors#e107) | `OrderApi has no route "lst".` | Fix the route name. |
| [E108](/reference/errors#e108) | `OrderApi.place is missing the value for "total".` | Pass every parameter. |
| [E110](/reference/errors#e110) | `"draft" doesn't exist yet.` (hint: ``... or declare `state draft = ...` on the page.``) | Declare the state. |
| [E112](/reference/errors#e112) | `` `input` must be bound to page state so it can store what the user types. `` | Write `input draft` with `state draft = ""`. |
| [E113](/reference/errors#e113) | ``An event must call an action, like `on click save` or `on click remove(todo.id)`.`` | Point the event at an action. |
| [E114](/reference/errors#e114) | `OrderCard needs "order".` / `OrderCard doesn't take "item".` | Pass exactly the component's `takes`. |
| [E116](/reference/errors#e116) | `Unknown layout "Mian".` | Declare the layout or fix the name. |
| [E117](/reference/errors#e117) | `A view can't call an api or an action while it is being drawn.` (hint: ``Load the data into `state` in `when loaded` or in an action, then show the state in the view.``) | Store the result in state and show the state. |
| [E201](/reference/errors#e201) | `A UI page (Orders) can't use the data layer directly (Orders is a store).` | Go through an api. |
| [E204](/reference/errors#e204) | `AI can only be called from a service, not from the UI.` | Move the AI call to a service. |
| [E205](/reference/errors#e205) | `` `env` holds server secrets and cannot be read in the UI. `` | Read it in a service. |

## Examples

**1. A static page with a layout.**

```cluub
page About at "/about"
  about "Who we are"
  title "About us"
  layout Main
  view
    heading "About us"
    text "We make small tools for small teams."
    link "Back home" to "/"
```

**2. A form with state, validation from the server and navigation.**

```cluub
page NewTodo at "/todos/new"
  about "Add a todo"
  uses TodoApi
  state draft = ""
  state saving = false

  action save()
    saving = true
    try
      let todo = TodoApi.add(title: draft)
      go to "/todos/{todo.id}"
    catch problem
      saving = false
      fail problem.message

  view
    heading "New todo"
    form
      input draft, placeholder "What needs doing?", on enter save
      button "Save", on click save, style primary, disabled saving or draft is empty
```

If the server rejects the title, `fail problem.message` re-throws the message so it appears as a toast, after `saving` is reset.

**3. A detail page with a path parameter, loading state and a component.**

```cluub
model Order
  customerId: id, required
  total: number, min 0
  status: text = "open", one of ["open", "shipped", "cancelled"]

component OrderSummary
  takes order: Order, onCancel: action
  view
    card
      subheading "Order {order.id}"
      text "Total: {order.total} EUR"
      badge order.status
      if order.status is "open"
        button "Cancel order", on click onCancel(order.id), style danger

page OrderDetail at "/orders/{id}"
  about "One order"
  title "Order {id}"
  uses OrderApi
  state order: Order = nothing
  state loading = true

  when loaded
    order = OrderApi.one(id)
    loading = false

  action cancel(orderId: text)
    order = OrderApi.cancel(orderId)

  view
    if loading
      spinner
    else if order is nothing
      text "This order does not exist."
    else
      OrderSummary order: order, onCancel: cancel
      link "All orders" to "/orders"
```

## Edge cases & limits

* **Starting values can only use earlier states.** `state b = a + 1` works when `a` is declared above `b`. If `a` is declared below, it is still `nothing` at that point and `b` is computed from `nothing`, without an error.
* **Changing a field of a state value** (`user.name = "Ada"`) does not schedule a redraw by itself; the view still updates after the current action or event finishes.
* **Path parameters are always text.** Convert with `number(id)` if needed. They cannot be typed in the page path.
* **No query string access.** The query string is ignored when matching, and there is no built-in way to read it.
* **Page order matters** when two paths could match the same URL (for example `/orders/new` and `/orders/{id}`): the first declared page wins. Across files, the order depends on the order the compiler reads them, so avoid overlapping paths or keep such pages in one file.
* **No guards, redirects, nested routes or lazy loading.** There is no authentication.
* **`title` sets the tab title in the browser only**; it is not rendered on the page.
* **Concurrent actions are not cancelled.** Clicking twice runs the action twice; use a `saving` state and `disabled` as in Example 2.
* **State types are not enforced** at runtime.
* **One `view` per page.** If you write two, the last one is used.

## See also

* [component](/reference/component) and [layout](/reference/layout)
* [View elements](/reference/view-elements)
* [Properties & events](/reference/properties-events)
* [api](/reference/api)
* [Pages & components guide](/guide/frontend)
