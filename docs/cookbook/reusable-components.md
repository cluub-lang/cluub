# Reusable components with action callbacks

## Problem

Your page view is getting long, and the same card appears in several places. You want to pull pieces out into components that can be reused and nested, while buttons inside them still change the page's data: "Start", "Finish" and "Delete" on a task card should update the board that owns the tasks.

## Solution

Components **take** data and **actions**. The page owns the state and passes its own actions down; a component calls them like functions (`onAdvance(task.id)`), and can pass them further down to its own children.

**`models/task.clb`**

```cluub
model Task
  about "A piece of work on the board"
  title: text, required "Name the task", max 120
  status: text = "todo", one of ["todo", "doing", "done"]
```

**`data/tasks.clb`**

```cluub
store Tasks holds Task
  about "Every task on the board"
```

**`services/task-service.clb`**

```cluub
service TaskService
  about "Moving tasks across the board"
  uses Tasks

  action list() -> list of Task
    return Tasks.all()

  action add(title: text) -> Task
    require title is not empty, "Name the task"
    return Tasks.add(Task(title: title))

  action advance(id: text) -> Task
    about "Move a task one column to the right"
    let task = Tasks.get(id)
    if task.status is "todo"
      return Tasks.update(id, {status: "doing"})
    return Tasks.update(id, {status: "done"})

  action remove(id: text)
    Tasks.remove(id)
```

**`api/task-api.clb`**

```cluub
api TaskApi at "/api/tasks"
  about "Task board endpoints"
  uses TaskService

  get list at "/"
    return TaskService.list()

  post add at "/" with title: text = ""
    return TaskService.add(title)

  post advance at "/{id}/advance"
    return TaskService.advance(id)

  delete remove at "/{id}"
    TaskService.remove(id)
```

**`ui/components/stat-tile.clb`**

```cluub
component StatTile
  about "A big number with a caption"
  takes caption: text, value: number, tone: text = "plain"
  view
    box, class "stat {tone}"
      text "{value}", class "stat-value"
      text caption, style muted
```

**`ui/components/task-card.clb`**

```cluub
component TaskCard
  about "One task with buttons to move it forward or delete it"
  takes task: Task, onAdvance: action, onRemove: action
  view
    card
      text task.title
      row
        if task.status is "todo"
          button "Start", on click onAdvance(task.id), style primary
        else if task.status is "doing"
          button "Finish", on click onAdvance(task.id), style primary
        button "Delete", on click onRemove(task.id), style ghost
```

**`ui/components/task-column.clb`**

```cluub
component TaskColumn
  about "A titled column of task cards"
  takes title: text, tasks: list of Task, onAdvance: action, onRemove: action
  view
    column
      subheading "{title} ({tasks.count})"
      for task in tasks
        TaskCard task: task, onAdvance: onAdvance, onRemove: onRemove
      if tasks is empty
        text "Nothing here.", style muted
```

**`ui/pages/board.clb`**

```cluub
page Board at "/"
  about "A three-column task board built from small components"
  title "Board"
  uses TaskApi
  state tasks = []
  state draft = ""

  when loaded
    tasks = TaskApi.list()

  action add()
    about "Add a task to the To do column"
    TaskApi.add(title: draft)
    draft = ""
    tasks = TaskApi.list()

  action advance(id: text)
    about "Move a task forward"
    TaskApi.advance(id)
    tasks = TaskApi.list()

  action remove(id: text)
    about "Delete a task"
    TaskApi.remove(id)
    tasks = TaskApi.list()

  view
    heading "Board"
    row
      StatTile caption: "to do", value: tasks.where(t => t.status is "todo").count
      StatTile caption: "in progress", value: tasks.where(t => t.status is "doing").count
      StatTile caption: "done", value: tasks.where(t => t.status is "done").count, tone: "good"
    row
      input draft, placeholder "New task", on enter add
      button "Add task", on click add, style primary, disabled draft is empty
    grid
      TaskColumn title: "To do", tasks: tasks.where(t => t.status is "todo"), onAdvance: advance, onRemove: remove
      TaskColumn title: "Doing", tasks: tasks.where(t => t.status is "doing"), onAdvance: advance, onRemove: remove
      TaskColumn title: "Done", tasks: tasks.where(t => t.status is "done"), onAdvance: advance, onRemove: remove
```

**`theme.css`**

```css
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; min-width: 120px; }
.stat-value { font-size: 1.8rem; font-weight: 700; margin: 0; }
.stat.good .stat-value { color: var(--success); }
```

## How it works

* **`takes` is the component's whole interface.** `takes task: Task, onAdvance: action, onRemove: action` lists what callers must pass. Forgetting one is a compile error (E114, *TaskCard needs "onRemove"*), and so is passing one it doesn't take.
* **Action properties are callbacks.** The page passes its own action by name, `onAdvance: advance`. Inside the component, `on click onAdvance(task.id)` calls it with the id, which runs the page's `advance(id)`, which talks to the API and reloads `tasks`.
* **Callbacks pass straight through.** `TaskColumn` doesn't know what "advance" means; it hands `onAdvance: onAdvance` to each `TaskCard`. Components can use other components without declaring anything.
* **Defaults make properties optional.** `tone: text = "plain"` lets most `StatTile`s skip it; the "done" tile passes `tone: "good"`, which becomes the CSS class `stat good`.
* **Components are stateless.** They can't declare `state`, `uses` or `when loaded` (error E203 for dependencies). All data comes in through `takes`, so a component shows the same thing for the same inputs: easy to reuse and nothing to keep in sync.
* **Derived values are computed at the call site.** `value: tasks.where(t => t.status is "done").count` is evaluated by the page on every redraw, so the tiles and columns always match `tasks`.
* **Logic stays in the service.** "todo → doing → done" lives in `TaskService.advance`; the card only decides which label to show.

## Test it

**`tests/board.test.clb`**

```cluub
test "a task moves from to do to done"
  let task = TaskService.add("Write the docs")
  expect TaskService.advance(task.id).status is "doing"
  expect TaskService.advance(task.id).status is "done"

test "the card buttons call the page's actions"
  render Board
  type "Write the docs" into "New task"
  click "Add task"
  expect screen has "To do (1)"
  click "Start"
  expect screen has "Doing (1)"
  click "Finish"
  expect screen has "Done (1)"
  click "Delete"
  expect screen has "Done (0)"
```

There's no `render` for a single component; components are tested through the pages that use them, against the real backend. That's usually what you want to know anyway: does clicking **Start** on the card move the task?

## Variations and pitfalls

* **No internal state.** A component can't remember "expanded" or "menu open". Keep that in the page (`state openId = ""`) and pass it in (`open: openId is task.id`) together with an action to change it.
* **Keep components dumb.** Components can't call apis (`uses` isn't allowed). If a card needs data, the page loads it and passes it in.
* **Callback names.** Start action properties with `on` (`onAdvance`, `onRemove`) so it's obvious they're callbacks, and pass ids rather than whole objects when the page only needs to find the item.
* **Layouts are components for pages.** For a header and footer on every page, use a `layout` with `slot` instead; see the [layout reference](/reference/layout).
* **Dynamic classes:** `class "stat {tone}"` interpolates any value. `style` only accepts a fixed word (`primary`, `danger`, `ghost`, `muted`); see [Custom theme and styling](/cookbook/theming).

## See also

* [Component reference](/reference/component)
* [Pages & components](/guide/frontend#components)
* [CRUD list](/cookbook/crud-list)
* [Custom theme and styling](/cookbook/theming)
