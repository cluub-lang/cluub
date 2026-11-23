# Loading and empty states

## Problem

A page that loads data has more than one look: *still loading*, *failed to load*, *loaded but empty*, and *loaded with data*. Showing an empty list while data is on its way makes users think it's gone; showing a blank page when there's nothing yet wastes the moment when you could explain what to do. Buttons that start slow work should also show they're busy.

## Solution

Give each look a piece of state and pick one with `if … else if … else` in the view.

**`models/project.clb`**

```cluub
model Project
  about "A group of tasks"
  name: text, required "Give the project a name", min 2, max 60
  tasks: number = 0, min 0
```

**`data/projects.clb`**

```cluub
store Projects holds Project
  about "All projects"
```

**`services/project-service.clb`**

```cluub
service ProjectService
  about "Listing and creating projects"
  uses Projects

  action list() -> list of Project
    return Projects.all().sortBy(p => p.name)

  action create(name: text) -> Project
    about "Start a new project"
    require name is not empty, "Give the project a name"
    return Projects.add(Project(name: name.trim()))
```

**`api/project-api.clb`**

```cluub
api ProjectApi at "/api/projects"
  about "Project endpoints"
  uses ProjectService

  get list at "/"
    return ProjectService.list()

  post create at "/" with name: text = ""
    return ProjectService.create(name)
```

**`ui/pages/projects.clb`**

```cluub
page ProjectsPage at "/"
  about "Projects with loading, error, empty and busy states"
  title "Projects"
  uses ProjectApi
  state projects = []
  state loading = true
  state loadError = ""
  state name = ""
  state saving = false

  when loaded
    load()

  action load()
    about "Load the projects and remember whether it worked"
    loading = true
    loadError = ""
    try
      projects = ProjectApi.list()
    catch problem
      loadError = problem.message
    loading = false

  action create()
    about "Create a project, showing a busy state meanwhile"
    saving = true
    try
      ProjectApi.create(name: name)
      name = ""
      projects = ProjectApi.list()
    catch problem
      saving = false
      fail problem.message
    saving = false

  view
    heading "Projects"
    if loading
      row
        spinner
        text "Loading projects…", style muted
    else if loadError is not empty
      card
        text "Couldn't load projects: {loadError}"
        button "Try again", on click load
    else if projects is empty
      card, class "empty"
        subheading "No projects yet"
        text "Projects group your tasks. Create the first one below."
    else
      for project in projects
        card
          row
            text project.name
            badge "{project.tasks} tasks"
    row
      input name, placeholder "New project name", on enter create
      button "Create project", on click create, style primary, disabled name is empty or saving
      if saving
        spinner
```

**`theme.css`**

```css
.empty { text-align: center; padding: 32px 16px; border-style: dashed; }
```

## How it works

* **`state loading = true`** means the very first render shows the spinner. Starting with `false` would flash the empty state for a moment before the data arrives.
* **`when loaded` calls `load()`.** Keeping the loading logic in an action lets the **Try again** button reuse it.
* **Catching the load error** stores the message in `loadError` and shows it in place, with a retry button, instead of only a toast that disappears after five seconds.
* **One branch at a time.** `if loading` / `else if loadError is not empty` / `else if projects is empty` / `else` makes the four looks mutually exclusive, so you never see a spinner *and* "No projects yet".
* **`is empty`** is true for `nothing`, `""` (also whitespace-only text), `[]` and `{}`, so it works whether the API returned an empty list or nothing at all.
* **The empty state teaches.** It says what projects are for and points at the input below, which stays visible in every state.
* **Busy buttons.** `saving` disables **Create project** and shows a small spinner while the request runs, which also prevents double submits. In `catch`, the flag is reset *before* `fail problem.message` re-raises the error as a toast, because `fail` stops the action.

## Test it

**`tests/projects.test.clb`**

```cluub
test "an empty account shows the empty state, not a blank page"
  render ProjectsPage
  expect screen has "No projects yet"
  expect not (screen has "Loading projects")

test "projects replace the empty state"
  ProjectService.create("Website relaunch")
  render ProjectsPage
  expect screen has "Website relaunch"
  expect screen has "0 tasks"
  expect not (screen has "No projects yet")

test "creating the first project from the empty state"
  render ProjectsPage
  type "Website relaunch" into "New project name"
  click "Create project"
  expect screen has "Website relaunch"

test "a rejected name is explained"
  render ProjectsPage
  type "X" into "New project name"
  click "Create project"
  expect screen has "name must be at least 2 characters"
```

**Tests see the settled page.** `render` and `click` wait until every request has finished, so a test always sees the final state: the empty state or the list, never the spinner. That makes tests stable, but it also means the spinner and the `loadError` branch aren't exercised here. Nothing in this recipe can make the list call fail in a test (fresh in-memory stores don't fail), so check the error branch by stopping the server in `cluub dev` and clicking **Try again**.

## Variations and pitfalls

* **Name clash.** The page is called `ProjectsPage` because the store is already called `Projects`; every declaration name must be unique (error E101).
* **Per-item busy states.** To show a spinner on just the card being deleted, keep `state busyId = ""`, set it at the start of the action, and use `if busyId is project.id` inside the loop.
* **Skeletons instead of spinners.** Replace the spinner with a few `card, class "skeleton"` boxes and animate them in `theme.css`.
* **Empty search results are different from an empty account.** Say "Nothing matches 'xyz'" with a way to clear the search; see [Search and filtering](/cookbook/search-filter).
* **Don't put `fail` before resetting flags.** `fail` stops the action immediately, so anything after it never runs and the button would stay disabled.

## See also

* [Pages & components](/guide/frontend)
* [View elements](/reference/view-elements) (`spinner`, `if`, `for`)
* [Master–detail pages](/cookbook/master-detail) (spinner while a single item loads)
* [Error handling patterns](/cookbook/error-handling)
