# Master–detail pages with a path parameter

## Problem

You have a list ("master") and want each item to open its own page ("detail") with a shareable URL like `/books/3`. The detail page must load the right item from the URL, show a spinner while it loads, and say something friendly when the id doesn't exist, instead of an error toast.

## Solution

Two pages. The list links to `/books/{id}`, and the detail page declares `{id}` in its path and loads the item in `when loaded`.

**`models/book.clb`**

```cluub
model Book
  about "A book on the shelf"
  title: text, required "Every book needs a title", max 120
  author: text, required "Who wrote it?"
  year: number?
  notes: text?
```

**`data/books.clb`**

```cluub
store Books holds Book
  about "Every book on the shelf"
```

**`services/book-service.clb`**

```cluub
service BookService
  about "Listing, finding and adding books"
  uses Books

  action all() -> list of Book
    return Books.all().sortBy(b => b.title)

  action get(id: text) -> Book
    about "One book; fails with 404 if the id is unknown"
    return Books.get(id)

  action add(title: text, author: text, year: number?) -> Book
    about "Put a new book on the shelf"
    require title is not empty, "Every book needs a title"
    return Books.add(Book(title: title, author: author, year: year))
```

**`api/book-api.clb`**

```cluub
api BookApi at "/api/books"
  about "Book endpoints"
  uses BookService

  get list at "/"
    return BookService.all()

  get one at "/{id}"
    return BookService.get(id)

  post add at "/" with title: text = "", author: text = ""
    return BookService.add(title, author)
```

**`ui/pages/shelf.clb`**

```cluub
page Shelf at "/"
  about "The list of books; each one links to its own page"
  title "Shelf"
  uses BookApi
  state books = []
  state title = ""
  state author = ""

  when loaded
    books = BookApi.list()

  action add()
    about "Add a book and open its page"
    let book = BookApi.add(title: title, author: author)
    go to "/books/{book.id}"

  view
    heading "Shelf"
    row
      input title, placeholder "Title"
      input author, placeholder "Author"
      button "Add book", on click add, style primary, disabled title is empty
    list
      for book in books
        item
          link book.title to "/books/{book.id}"
    if books is empty
      text "The shelf is empty."
```

**`ui/pages/book-detail.clb`**

```cluub
page BookDetail at "/books/{id}"
  about "One book, looked up by the id in the URL"
  title book.title
  uses BookApi
  state book = nothing
  state missing = false

  when loaded
    try
      book = BookApi.one(id)
    catch problem
      if problem.status is 404
        missing = true
      else
        fail problem.message

  view
    link "← Back to the shelf" to "/"
    if missing
      heading "Book not found"
      text "There is no book with id {id}. It may have been removed."
    else if book is nothing
      spinner
    else
      heading book.title
      text "by {book.author}"
      if book.year is not nothing
        text "Published {book.year}", style muted
      if book.notes is not empty
        card
          text book.notes
```

## How it works

* **`page BookDetail at "/books/{id}"`** makes `id` available by name everywhere in the page: in `when loaded`, in actions and in the view (`"There is no book with id {id}"`). Path parameters are always text.
* **The API uses the same idea.** `get one at "/{id}"` under `api BookApi at "/api/books"` answers `GET /api/books/3`, and the page calls it as `BookApi.one(id)`.
* **Links are plain paths.** `link book.title to "/books/{book.id}"` navigates without reloading the page. `go to "/books/{book.id}"` does the same from an action, here right after creating a book.
* **Three states in the view.** `book` starts as `nothing`, so the page first shows a `spinner`. When the load succeeds, `book` is set and the details appear. If the load fails, `missing` decides what to show.
* **404 vs. everything else.** `Books.get(id)` fails with status 404 when the id is unknown. The page catches it and checks `problem.status is 404` to show a friendly message. Any other problem is passed on with `fail problem.message`, which shows the usual toast.
* **`title book.title`** sets the browser tab title from state. While `book` is `nothing` the title is empty, and Cluub leaves the tab title as it was.
* **Optional fields.** `year: number?` and `notes: text?` may be `nothing`; the view checks before showing them.

## Test it

**`tests/books.test.clb`**

```cluub
test "an unknown book is a 404"
  expect BookService.get("42") fails with "not found"
  let response = request get "/api/books/42"
  expect response.status is 404

test "the detail page shows the book from the URL"
  BookService.add("Dune", "Frank Herbert", 1965)
  render BookDetail
  expect screen has "by Frank Herbert"
  expect screen has "Published 1965"

test "an unknown id shows a friendly message, not a toast"
  go to "/books/42"
  expect screen has "Book not found"
  expect screen has "There is no book with id 42"

test "clicking a book on the shelf opens its page"
  BookService.add("Dune", "Frank Herbert", 1965)
  render Shelf
  click "Dune"
  expect screen has "Published 1965"

test "adding a book opens its new page"
  render Shelf
  type "Dune" into "Title"
  type "Frank Herbert" into "Author"
  click "Add book"
  expect screen has "by Frank Herbert"
```

`render BookDetail` opens the page with every path parameter set to `"1"`, so the first test adds a book (which gets id `1`) before rendering. Use `go to "/books/42"` when you need a specific URL.

## Variations and pitfalls

* **Generated tests skip pages with path parameters**, because Cluub can't guess a valid id. Write at least one test like the ones above for every detail page.
* **Edit on the detail page.** Add `state editing = false` and an `action save()` that calls a `put` route, then set `book` to the returned value. The [CRUD recipe](/cookbook/crud-list) shows the routes.
* **Nested resources** work the same way: `page Chapter at "/books/{bookId}/chapters/{chapterId}"` gives you both names.
* **Delete and go back:** call the delete route, then `go to "/"`.
* **Query strings aren't available to pages.** Only `{name}` path segments become values; `?tab=notes` is ignored by the router.

## See also

* [Page reference](/reference/page) (path parameters, `title`, `when loaded`)
* [Pages & components](/guide/frontend)
* [Loading and empty states](/cookbook/loading-empty-states)
* [Error handling patterns](/cookbook/error-handling)
