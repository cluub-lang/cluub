# store

A `store` is the data layer. It holds values of one model, gives each one an `id`, and lets services list, find, add, change and remove them. A store keeps its items in memory. With `saved in "file.json"` it also writes them to a JSON file, so they survive a restart. Stores always hand out **copies**, so changing a value you got from a store does not change what is saved. To save a change, call `update`. Only services (and tests) can use stores.

## Syntax

```cluub
model Order
  customerId: id, required
  total: number, min 0

store Orders holds Order saved in "storage/orders.json"
  about "Every order ever placed"
```

The full shape:

```text
store Name holds ModelName [saved in "path/to/file.json"]
  [about "description"]
```

## Members / options

| Member | What it does | Required? | Default |
|---|---|---|---|
| `holds ModelName` | The model this store keeps. Every item is a valid value of this model. | Yes | none |
| `saved in "path"` | JSON file to load from at server start and write to after every change. The path is relative to the project root. | No | memory only |
| `about "text"` | Describes the store. | No | none |

### Methods

Services call these on the store by name, for example `Orders.get(id)`. Every call is awaited for you.

| Method | Returns | Fails with |
|---|---|---|
| `all()` | A list of copies of every item, in insertion order. | never |
| `find(id)` | A copy of the item, or `nothing` if there is none. | never |
| `get(id)` | A copy of the item. | 404 `Order "7" was not found` |
| `add(item)` | The saved item, with its `id` filled in. | 400 if the item breaks a model rule; 409 `Order "3" already exists` if the `id` is taken |
| `update(id, changes)` | The updated item. `changes` is an object (`{done: true}`) or a model value; its fields are merged over the current item and the result is validated again. The `id` never changes. | 404 if missing; 400 if the result breaks a rule or `changes` has an unknown field |
| `remove(id)` | `true` | 404 if missing |
| `where(x => condition)` | A list of copies of the items for which the condition is true. | never |
| `count()` | The number of items. | never |
| `clear()` | Removes every item and restarts ids at `1`. | never |

## Behaviour

**IDs.** `add` keeps an `id` you pass (turned into text). Otherwise it assigns the next number as text: `"1"`, `"2"`, `"3"`… The counter always moves past the highest numeric id seen, so adding `id: "10"` makes the next automatic id `"11"`. Ids are compared as text, so `get(1)` and `get("1")` find the same item.

**Validation.** `add` builds a new model value from the item you pass (a model value or a plain object), so every model rule runs. `update` merges `changes` over the current item and builds a new value, so the rules run again on the result.

**Copies.** Every method returns copies. This does nothing to the stored item:

```text
let order = Orders.get("1")
order.total = 0          # changes only the local copy
Orders.update("1", {total: 0})   # this saves it
```

**Persistence (`saved in`).** When the app runs with `cluub dev` or `cluub start`:

1. At startup, if the file exists, every record is loaded and validated with the model. If the file is not valid JSON or a record breaks a rule, the server refuses to start with `Could not read storage/orders.json for store Orders: … Fix or delete the file.`
2. After every `add`, `update`, `remove` and `clear`, the whole store is written to the file (to a temporary file first, then renamed, so a crash cannot leave half a file). Missing folders are created.

The file is a JSON array of objects, one per item, each with its `id`.

**In tests every store is in memory and empty**, even if it has `saved in`. Each test starts with fresh stores, so tests never touch your data files.

**Layer rules.** Only a `service` may list a store in `uses` ([E201](/reference/errors#e201) otherwise). Tests may use stores directly without `uses`. Calling a store method that does not exist is [E107](/reference/errors#e107). Store calls cannot appear inside a quick `x => ...` function ([E108](/reference/errors#e108)); the function you pass to `where` can only look at the item it is given.

**Folder and naming.** Stores live in `data/` ([E301](/reference/errors#e301)). Names are PascalCase; a plural of the model name (`Orders` for `Order`) is the convention.

**Errors and statuses.** `get`, `update` and `remove` on a missing id throw a not-found error (status 404, code `not_found`). A duplicate id in `add` throws status 409 (code `failed`). Rule violations throw a `ValidationError` (status 400). Inside an api these become HTTP responses with those statuses.

## Errors

| Code | Message (example) | Fix |
|---|---|---|
| [E010](/reference/errors#e010) | ``Expected `holds` but found the end of the line.`` (hint: ``Stores look like `store Todos holds Todo`.``) | Add `holds ModelName`. |
| [E012](/reference/errors#e012) | `` `max` is not allowed inside a store. `` (hint: `A store can contain: about.`) | A store body may only have `about`. |
| [E101](/reference/errors#e101) | `"Orders" is declared twice (…)` | Rename one. |
| [E102](/reference/errors#e102) | `"orders" should be PascalCase (…)` | Rename the store. |
| [E105](/reference/errors#e105) | `Store Orders holds "Ordr", which is not a model.` (hint: `Did you mean "Order"?`) | Hold a declared model. |
| [E106](/reference/errors#e106) | `OrderService uses Orders but doesn't declare it.` | Add `uses Orders` to the service. |
| [E107](/reference/errors#e107) | `Orders has no store method "fetch".` (hint: `Available: all, find, get, add, update, remove, where, count, clear.`) | Use one of the listed methods. |
| [E108](/reference/errors#e108) | `Orders.get is missing the value for "id".` | Pass the argument. |
| [E201](/reference/errors#e201) | `A backend api (OrderApi) can't use the data layer directly (Orders is a store).` | Call a service from the api; let the service use the store. |
| [E301](/reference/errors#e301) | `A store belongs in the "data" folder, but "Orders" is in models/order.clb.` | Move it to `data/`. |

## Examples

**1. An in-memory store used by a service.**

```cluub
model Note
  body: text, required

store Notes holds Note

service NoteService
  about "Writing notes"
  uses Notes

  action write(body: text) -> Note
    return Notes.add(Note(body: body))

  action list() -> list of Note
    return Notes.all()
```

**2. A saved store with updates, lookups and removal.**

```cluub
model Task
  title: text, required, min 3
  done: bool = false

store Tasks holds Task saved in "storage/tasks.json"

service TaskService
  about "Managing tasks"
  uses Tasks

  action toggle(id: text) -> Task
    about "Mark a task done or not done"
    let task = Tasks.get(id)
    return Tasks.update(id, {done: not task.done})

  action open() -> list of Task
    return Tasks.where(t => not t.done)

  action rename(id: text, title: text) -> Task
    return Tasks.update(id, {title: title})

  action discard(id: text)
    Tasks.remove(id)
```

**3. Store behaviour pinned down in tests.**

```cluub
model Task
  title: text, required, min 3
  done: bool = false

store Tasks holds Task

test "ids are assigned in order"
  let a = Tasks.add(Task(title: "Write"))
  let b = Tasks.add(Task(title: "Read"))
  expect a.id is "1"
  expect b.id is "2"

test "find gives nothing, get fails with 404"
  expect Tasks.find("9") is nothing
  expect Tasks.get("9") fails with "was not found"

test "update merges and validates"
  let t = Tasks.add(Task(title: "Write"))
  let u = Tasks.update(t.id, {done: true})
  expect u.title is "Write"
  expect u.done is true
  expect Tasks.update(t.id, {title: "x"}) fails with "title must be at least 3 characters"

test "stores hand out copies"
  let t = Tasks.add(Task(title: "Write"))
  t.title = "Changed"
  expect Tasks.get(t.id).title is "Write"

test "counting"
  Tasks.add(Task(title: "Write"))
  Tasks.add(Task(title: "Read"))
  expect Tasks.count() is 2
  Tasks.clear()
  expect Tasks.count() is 0
```

## Edge cases & limits

* **The whole store lives in memory**, and `saved in` rewrites the whole file on every change. This suits prototypes and small apps (thousands of items), not large or shared data. There is no database driver yet.
* **One process only.** Two servers writing the same file will overwrite each other. There are no transactions or locks.
* **No queries beyond `where`.** No sorting, paging or indexes; use list helpers such as `.sortBy(x => ...)` on the result.
* **`where` runs your condition on copies of every item**, so cost grows with store size.
* **`clear()` restarts ids at 1**, which can reuse ids that other data still refers to.
* **Records loaded from a file must still match the model.** Adding a `required` field to a model can stop the server from starting until old records are fixed.
* **`update` cannot remove a field**; pass `nothing` for optional fields instead.
* **No `saved in` in the browser or tests**: persistence only happens in the Node server.

## See also

* [model](/reference/model)
* [service](/reference/service)
* [Models & data guide](/guide/data)
* [Project structure & layers](/guide/structure)
