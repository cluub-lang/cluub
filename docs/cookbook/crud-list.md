# CRUD list: create, edit, delete

## Problem

Almost every app has a list people manage themselves: bookmarks, contacts, products. You need to show the list, add an item, edit one in place, and delete one, with the server staying the source of truth and validation messages reaching the user.

## Solution

One model, one store, a service with four actions, a thin API with one route per action, and one page that keeps the list in state.

**`models/bookmark.clb`**

```cluub
model Bookmark
  about "A saved link"
  title: text, required "Give the bookmark a title", max 100
  url: url, required "Paste a link"
```

**`data/bookmarks.clb`**

```cluub
store Bookmarks holds Bookmark
  about "All saved bookmarks"
```

**`services/bookmark-service.clb`**

```cluub
service BookmarkService
  about "Create, list, change and delete bookmarks"
  uses Bookmarks

  action list() -> list of Bookmark
    return Bookmarks.all().sortBy(b => b.title.lower())

  action create(title: text, url: url) -> Bookmark
    about "Save a new bookmark"
    require title is not empty, "Give the bookmark a title"
    return Bookmarks.add(Bookmark(title: title, url: url))

  action update(id: text, title: text, url: url) -> Bookmark
    about "Change a bookmark's title and link"
    require title is not empty, "Give the bookmark a title"
    return Bookmarks.update(id, {title: title, url: url})

  action remove(id: text)
    about "Delete a bookmark"
    Bookmarks.remove(id)
```

**`api/bookmark-api.clb`**

```cluub
api BookmarkApi at "/api/bookmarks"
  about "Bookmark endpoints"
  uses BookmarkService

  get list at "/"
    return BookmarkService.list()

  post create at "/" with title: text = "", url: url = ""
    return BookmarkService.create(title, url)

  put save at "/{id}" with title: text = "", url: url = ""
    return BookmarkService.update(id, title, url)

  delete remove at "/{id}"
    BookmarkService.remove(id)
```

**`ui/pages/library.clb`**

```cluub
page Library at "/"
  about "Manage bookmarks: add, edit in place and delete"
  title "Bookmarks"
  uses BookmarkApi
  state bookmarks = []
  state newTitle = ""
  state newUrl = ""
  state editingId = ""
  state editTitle = ""
  state editUrl = ""

  when loaded
    bookmarks = BookmarkApi.list()

  action create()
    about "Add a bookmark"
    BookmarkApi.create(title: newTitle, url: newUrl)
    newTitle = ""
    newUrl = ""
    bookmarks = BookmarkApi.list()

  action startEdit(bookmark: Bookmark)
    about "Open the inline editor for one bookmark"
    editingId = bookmark.id
    editTitle = bookmark.title
    editUrl = bookmark.url

  action cancelEdit()
    editingId = ""

  action saveEdit()
    about "Save the inline edit"
    BookmarkApi.save(editingId, title: editTitle, url: editUrl)
    editingId = ""
    bookmarks = BookmarkApi.list()

  action remove(id: text)
    about "Delete a bookmark"
    BookmarkApi.remove(id)
    bookmarks = BookmarkApi.list()

  view
    heading "Bookmarks"
    row
      input newTitle, placeholder "Title"
      input newUrl, placeholder "https://…"
      button "Add", on click create, style primary, disabled newTitle is empty or newUrl is empty
    for bookmark in bookmarks
      card
        if editingId is bookmark.id
          row
            input editTitle, placeholder "Edit title"
            input editUrl, placeholder "Edit link"
            button "Save", on click saveEdit, style primary
            button "Cancel", on click cancelEdit, style ghost
        else
          row
            link bookmark.title to bookmark.url
            button "Edit", on click startEdit(bookmark), style ghost
            button "Delete", on click remove(bookmark.id), style danger
    if bookmarks is empty
      text "No bookmarks yet. Add your first one above."
```

## How it works

* **One action per operation.** `create`, `update` and `remove` live in the service, so the rules are the same for the page, for tests and for anyone calling the API.
* **`Bookmarks.update(id, {title: title, url: url})`** merges the changes into the stored item and **re-validates** it against the model, so an edit can't sneak in an invalid URL. If the id doesn't exist, the store fails with a 404 (*Bookmark "99" was not found*).
* **`url: url = ""`** in the API: the `url` type rejects anything that isn't `http(s)://…` with a 400 that names the field. The default `""` lets an empty value reach the service's friendlier `require`.
* **`put save at "/{id}"`** gets `id` from the path and `title`/`url` from the JSON body. The page calls it as `BookmarkApi.save(editingId, title: editTitle, url: editUrl)`; the generated client builds the URL for you.
* **The page reloads the list after each change** (`bookmarks = BookmarkApi.list()`). That's the simplest way to stay in sync with the server, including sort order.
* **Inline editing is just state.** `editingId` says which card shows inputs. `startEdit(bookmark)` copies the values into `editTitle`/`editUrl`, so typing doesn't change the list until you save. `Cancel` just clears `editingId`.
* **Errors need no code.** If `create` fails, Cluub shows the server message as a toast and the lines after the failed call don't run, so the user's input stays in the fields.

## Test it

**`tests/bookmarks.test.clb`**

```cluub
test "create, edit and delete a bookmark"
  let saved = BookmarkService.create("Cluub docs", "https://cluub.dev")
  let changed = BookmarkService.update(saved.id, "Cluub guide", "https://cluub.dev/guide")
  expect changed.title is "Cluub guide"
  BookmarkService.remove(saved.id)
  expect BookmarkService.list() is empty

test "links must be real web addresses"
  expect BookmarkService.create("Docs", "cluub.dev") fails with "valid web address"

test "editing a missing bookmark says so"
  expect BookmarkService.update("99", "Docs", "https://cluub.dev") fails with "not found"

test "the api rejects a bad link and names the field"
  let response = request post "/api/bookmarks" with {title: "Docs", url: "nope"}
  expect response.status is 400
  expect response.body.error.field is "url"

test "the page adds, edits and deletes"
  render Library
  type "Cluub docs" into "Title"
  type "https://cluub.dev" into "https://"
  click "Add"
  expect screen has "Cluub docs"
  click "Edit"
  type "Cluub guide" into "Edit title"
  click "Save"
  expect screen has "Cluub guide"
  click "Delete"
  expect screen has "No bookmarks yet"
```

## Variations and pitfalls

* **Placeholders double as test handles.** `type "…" into "Title"` picks the first input whose placeholder *contains* "Title". Give the edit inputs different placeholders ("Edit title") so tests and screen readers can tell them apart.
* **Confirm before deleting.** There is no built-in confirm dialog. Use a second state value: the first click sets `confirmingId = bookmark.id`, and inside `if confirmingId is bookmark.id` show a "Really delete?" button that calls `remove`.
* **Persist it.** Change the store line to `store Bookmarks holds Bookmark saved in "storage/bookmarks.json"`; nothing else changes. See [Persisting data to a JSON file](/cookbook/json-file-store).
* **Move the card into a component** once it grows. See [Reusable components with action callbacks](/cookbook/reusable-components).
* **Stores return copies.** Changing `saved.title` in a service does nothing until you call `Bookmarks.update`.

## See also

* [Store reference](/reference/store) and [API reference](/reference/api)
* [Services & APIs](/guide/backend)
* [Master–detail pages](/cookbook/master-detail)
* [Search and filtering](/cookbook/search-filter)
