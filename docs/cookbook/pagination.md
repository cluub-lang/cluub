# Pagination in a service

## Problem

A list grows past what fits on one screen. You want "Page 2 of 7" with Previous/Next buttons, and you want the server to send only the items for the current page. The rules (page size limits, what happens on page 99) should live in one place, not be re-invented by every page.

## Solution

The service returns a **page object**: the items plus the numbers the UI needs. The page only remembers the result and asks for another page number.

**`models/article.clb`**

```cluub
model Article
  about "A blog article"
  title: text, required, max 120
  summary: text = ""
```

**`models/article-page.clb`**

```cluub
model ArticlePage
  about "One page of articles plus what the UI needs to draw paging controls"
  items: list of Article
  page: number
  pageSize: number
  total: number
  totalPages: number
```

**`data/articles.clb`**

```cluub
store Articles holds Article
  about "All articles"
```

**`services/article-service.clb`**

```cluub
service ArticleService
  about "Articles, served one page at a time"
  uses Articles

  action list(pageNumber: number = 1, size: number = 5) -> ArticlePage
    about "Return one page of articles in title order"
    require size >= 1, "Page size must be at least 1"
    require size <= 50, "Page size can be at most 50"
    let all = Articles.all().sortBy(a => a.title)
    let total = all.count
    let totalPages = 1
    while totalPages * size < total
      totalPages = totalPages + 1
    let current = pageNumber
    if current < 1
      current = 1
    if current > totalPages
      current = totalPages
    let items = all.skip((current - 1) * size).take(size)
    return ArticlePage(items: items, page: current, pageSize: size, total: total, totalPages: totalPages)

  action seed()
    about "Add twelve sample articles to an empty blog"
    if Articles.all() is not empty
      return
    for title in ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett", "Kilo", "Lima"]
      Articles.add(Article(title: title, summary: "A short article about {title}."))
```

**`api/article-api.clb`**

```cluub
api ArticleApi at "/api/articles"
  about "Paged article list"
  uses ArticleService

  get list at "/" with page: number = 1, size: number = 5
    return ArticleService.list(page, size)

  post seed at "/seed"
    ArticleService.seed()
```

**`ui/pages/blog.clb`**

```cluub
page Blog at "/"
  about "Articles with Previous / Next paging"
  title "Blog"
  uses ArticleApi
  state result = nothing

  when loaded
    result = ArticleApi.list(page: 1)

  action goTo(pageNumber: number)
    about "Load another page"
    result = ArticleApi.list(page: pageNumber)

  action addSamples()
    ArticleApi.seed()
    result = ArticleApi.list(page: 1)

  view
    heading "Articles"
    if result is nothing
      spinner
    else
      for article in result.items
        card
          subheading article.title
          text article.summary, style muted
      if result.total is 0
        text "No articles yet."
        button "Add sample articles", on click addSamples
      row
        if result.page > 1
          button "← Previous", on click goTo(result.page - 1)
        text "Page {result.page} of {result.totalPages} · {result.total} articles"
        if result.page < result.totalPages
          button "Next →", on click goTo(result.page + 1)
```

## How it works

* **The page object is a model.** `ArticlePage` documents exactly what the API returns, and `items: list of Article` validates every item. The page reads `result.items`, `result.page`, `result.totalPages` and `result.total`.
* **Limits are `require` lines.** `size` must be between 1 and 50, so nobody can ask for a million rows. `GET /api/articles?size=500` answers 400 with *"Page size can be at most 50"*.
* **Counting pages without fractions.** `while totalPages * size < total` grows `totalPages` until the pages cover every item. An empty blog is "page 1 of 1".
* **Out-of-range pages are clamped**, not errors: page 0 becomes 1 and page 99 becomes the last page. That keeps old links and double-clicks harmless.
* **Cutting the page.** `all.skip((current - 1) * size).take(size)` drops the items of earlier pages and keeps the next `size`. Both return new lists, and asking for more than is left simply returns fewer items.
* **The UI hides impossible buttons.** `if result.page > 1` shows **Previous** only when there is a previous page, so there's no greyed-out button with nothing behind it. `disabled result.page is 1` works too if you prefer a fixed layout.
* **`goTo(result.page - 1)`.** Event handlers can pass expressions, so one action serves both buttons.

## Test it

**`tests/paging.test.clb`**

```cluub
test "pages are cut in the service"
  ArticleService.seed()
  let first = ArticleService.list(1, 5)
  expect first.items.count is 5
  expect first.totalPages is 3
  expect first.items.first.title is "Alpha"
  let last = ArticleService.list(3, 5)
  expect last.items.count is 2
  expect last.items.last.title is "Lima"

test "out-of-range pages are clamped"
  ArticleService.seed()
  expect ArticleService.list(99, 5).page is 3
  expect ArticleService.list(0, 5).page is 1

test "an empty blog is page 1 of 1"
  let empty = ArticleService.list()
  expect empty.totalPages is 1
  expect empty.items is empty

test "the api validates the page size"
  let response = request get "/api/articles?size=500"
  expect response.status is 400
  expect response.body.error.message has "at most 50"

test "the page moves between pages"
  ArticleService.seed()
  render Blog
  expect screen has "Page 1 of 3"
  click "Next"
  expect screen has "Page 2 of 3"
  expect screen has "Foxtrot"
  click "Previous"
  expect screen has "Alpha"
```

## Variations and pitfalls

* **Still loads everything.** The service reads `Articles.all()` and cuts the page in memory, so the *browser* gets small responses but the server still touches every item. That's fine for memory and JSON-file stores. Database stores with real `LIMIT/OFFSET` are on the [roadmap](/reference/roadmap).
* **Page numbers in the URL.** Use a path parameter, `page Blog at "/blog/{pageNumber}"`, call `ArticleApi.list(page: number(pageNumber))` in `when loaded`, and turn the buttons into `link "Next →" to "/blog/{result.page + 1}"`. Path parameters are text, hence `number(...)`.
* **"Load more" instead of pages.** Keep a `state items = []` and append each new page with `for a in next.items` / `items.add(a)`. The view redraws when the action finishes.
* **Combine with search.** Add a `query: text = ""` parameter and filter with `.where(...)` before counting; see [Search and filtering](/cookbook/search-filter).
* **Newest first.** `sortBy` sorts ascending; add `.reversed()` for descending: `Articles.all().sortBy(a => a.publishedOn).reversed()`.

## See also

* [Service reference](/reference/service)
* [API reference](/reference/api)
* [Models & data](/guide/data)
* [Search and filtering](/cookbook/search-filter)
