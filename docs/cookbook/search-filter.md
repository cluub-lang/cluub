# Search and filtering

## Problem

Users want to find things: type a few letters, pick a category, tick "in stock only". The full catalog may be too big to send to the browser, so the real search should run on the server. But once results are on screen, narrowing them further should feel instant.

## Solution

Do the main search in a **service** (filters arrive as query-string parameters), and do the instant "narrow these results" filter **in the view** with `.where(...)`.

**`models/product.clb`**

```cluub
model Product
  about "Something we sell"
  name: text, required, max 80
  category: text = "other", one of ["books", "games", "music", "other"]
  price: number = 0, min 0
  inStock: bool = true
```

**`data/products.clb`**

```cluub
store Products holds Product
  about "The catalog"
```

**`services/search-service.clb`**

```cluub
service SearchService
  about "Find products by text, category and stock"
  uses Products

  action search(query: text = "", category: text = "all", inStockOnly: bool = false) -> list of Product
    about "Products matching every filter, cheapest first"
    ensureSamples()
    let words = query.trim()
    let results = Products.where(p => p.name has words)
    if category is not "all"
      results = results.where(p => p.category is category)
    if inStockOnly
      results = results.where(p => p.inStock)
    return results.sortBy(p => p.price)

  action ensureSamples()
    about "Add demo products the first time the catalog is empty"
    if Products.count() is 0
      Products.add(Product(name: "Dune", category: "books", price: 12))
      Products.add(Product(name: "Project Hail Mary", category: "books", price: 15))
      Products.add(Product(name: "Catan", category: "games", price: 40))
      Products.add(Product(name: "Azul", category: "games", price: 35, inStock: false))
      Products.add(Product(name: "Dune: Imperium", category: "games", price: 45))
      Products.add(Product(name: "Kind of Blue", category: "music", price: 18))
```

**`api/search-api.clb`**

```cluub
api SearchApi at "/api/products"
  about "Product search"
  uses SearchService

  get search at "/" with query: text = "", category: text = "all", inStockOnly: bool = false
    return SearchService.search(query, category, inStockOnly)
```

**`ui/pages/shop.clb`**

```cluub
page Shop at "/"
  about "Search products on the server, then narrow the results instantly"
  title "Shop"
  uses SearchApi
  state query = ""
  state category = "all"
  state inStockOnly = false
  state results = []
  state narrow = ""

  when loaded
    results = SearchApi.search()

  action search()
    about "Run the server-side search with the current filters"
    narrow = ""
    results = SearchApi.search(query: query, category: category, inStockOnly: inStockOnly)

  view
    heading "Shop"
    row
      input query, placeholder "Search products", on enter search
      select category, options ["all", "books", "games", "music", "other"], on change search
      button "Search", on click search, style primary
    row
      checkbox inStockOnly, label "In stock only", on change search
      label "In stock only"
    input narrow, placeholder "Narrow these results"
    text "{results.where(p => p.name has narrow).count} shown", style muted
    for product in results.where(p => p.name has narrow)
      card
        row
          text product.name
          badge product.category
          text "{product.price} EUR"
          if not product.inStock
            badge "sold out"
    if results is empty
      text "Nothing matches. Try fewer words or another category."
```

## How it works

* **Filters are query parameters.** On a `get` route, `with query: text = "", category: text = "all", inStockOnly: bool = false` reads `?query=…&category=…&inStockOnly=true` and checks the types (`"true"`/`"false"` become a real `bool`). The defaults make every filter optional, so `SearchApi.search()` with no arguments returns everything.
* **`has` is case-insensitive for text.** `p.name has words` matches "Dune" for "dune" or "DUNE". An empty search (`""`) matches everything.
* **Filters stack.** Each `if` narrows `results` a bit more with `.where(...)`, then `.sortBy(p => p.price)` orders them. Because the logic is in the service, the same rules apply to any caller.
* **`ensureSamples()`** calls another action of the same service by name. It fills an empty catalog with demo data so the page has something to show; remove it once you have real data.
* **Events on inputs.** `on enter search` runs the search when the user presses Enter. On `select` and `checkbox`, `on change search` runs *after* the new value is written to state, so `search()` sees the new category.
* **Instant narrowing happens in the view.** `for product in results.where(p => p.name has narrow)` re-runs on every keystroke because typing changes `narrow` and the view redraws. No request is sent. The count line uses the same expression.

## Test it

**`tests/search.test.clb`**

```cluub
test "search matches names in any case, cheapest first"
  let found = SearchService.search("DUNE")
  expect found.count is 2
  expect found.first.name is "Dune"
  expect found.last.name is "Dune: Imperium"

test "category and stock filters combine"
  let games = SearchService.search("", "games", true)
  expect games.count is 2
  expect games.first.name is "Catan"

test "the api reads filters from the query string"
  let response = request get "/api/products?category=music"
  expect response.status is 200
  expect response.body.count is 1

test "the page searches on the server and narrows instantly"
  render Shop
  expect screen has "Kind of Blue"
  type "dune" into "Search products"
  click "Search"
  expect screen has "2 shown"
  expect not (screen has "Kind of Blue")
  type "imperium" into "Narrow"
  expect screen has "1 shown"
```

## Variations and pitfalls

* **Search-as-you-type against the server.** `input query, placeholder "Search products", on input search` calls the server on every keystroke (the input stays bound to `query`). Cluub has no debounce, so that's one request per key; it's fine for small apps, but for anything bigger prefer `on enter` or a button, plus the view-level `.where` for instant feedback.
* **Large catalogs.** `Products.where(...)` loads every item and filters in memory. That's fine for JSON-file and in-memory stores (hundreds to a few thousand items). Database stores are on the [roadmap](/reference/roadmap).
* **Combine with paging.** Return a page of results instead of the whole list; see [Pagination in a service](/cookbook/pagination).
* **Search several fields:** `Products.where(p => p.name has words or p.category has words)`.
* **Remember the search in the URL?** Pages can't read the query string yet; only path parameters (`/shop/{category}`) are available by name.

## See also

* [API reference](/reference/api) (where parameters come from)
* [Properties & events](/reference/properties-events)
* [Store reference](/reference/store) (`where`, `count`)
* [Loading and empty states](/cookbook/loading-empty-states)
