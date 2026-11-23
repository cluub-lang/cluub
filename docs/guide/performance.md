# Performance

Every number on this page was measured on one machine, with the scripts described next to it. Use them for orders of magnitude, not as guarantees. They are here to answer three practical questions: how fast is the edit-compile-test loop, how much can one server handle, and where does it slow down.

::: info Test machine
Apple M3 (8 cores), 16 GB RAM, macOS 27.3, Node.js 24.21, Cluub 0.1.0, measured on 2026-11-23 (after the security fixes that went into 0.1.0). Other work was running on the machine, and the load generator ran on the same machine as the server, so treat throughput numbers as lower bounds. No numbers were measured in a browser.
:::

## Compile time

**Method:** a Node script imported `compile()` from `compiler/index.js`, compiled each project 5 times to warm up, then 50 times, and recorded `performance.now()` around each call. The synthetic projects repeat one "feature" (a model, store, service, api and page) N times.

| Project | Files | Lines | Median compile | p90 |
|---|---|---|---|---|
| `blank` template | 2 | 9 | 0.02 ms | 0.03 ms |
| `ai-chat` template | 9 | 138 | 0.34 ms | 0.62 ms |
| `app` template | 10 | 169 | 0.42 ms | 0.66 ms |
| synthetic, 50 features | 251 | 2,053 | 3.8 ms | 5.7 ms |
| synthetic, 200 features | 1,001 | 8,203 | 13.8 ms | 18.3 ms |

Compile time grows roughly linearly with code size. The figure `cluub build` prints (`✓ Built in 5.6ms`) covers a single cold compile, including JIT warm-up.

## CLI wall-clock time

**Method:** each command ran 12 times as a child process (`node cli/cluub.js <cmd>`). We dropped the two fastest runs and report the median of the rest.

| Command (`app` template) | Median wall time |
|---|---|
| `cluub version` (Node startup only) | 43 ms |
| `cluub check` | 53 ms |
| `cluub build` | 57 ms |
| `cluub test` (generate 15 tests + run 19) | 88 ms |

The `ai-chat` template gave similar numbers (build 54 ms, test 87 ms). Most of every command is Node.js starting up: compiling takes under 1 ms, and writing `dist/` takes a few.

## Test run time

**Method:** the same script compiled each project plus its generated tests, then called `runTests()` from `runtime/testing.js` 10 times. Each test gets a fresh in-memory backend, and UI tests render headlessly against it.

| Project | Tests | Median run |
|---|---|---|
| `blank` | 1 | 1.2 ms |
| `ai-chat` | 22 | 8.8 ms |
| `app` | 19 | 10.1 ms |
| synthetic, 50 features | 600 | 321 ms |
| synthetic, 200 features | 2,400 | 1,902 ms |

That is roughly 0.5–0.8 ms per test, with no network, disk or real AI involved, so you can run the whole suite on every save.

## Server memory and throughput

**Method:** a script started `cluub start` for the built `app` template as a child process. It read the server's resident memory with `ps -o rss=`, then sent requests with `fetch` from N concurrent async loops. Before the run it deleted `storage/`, so the file store began empty.

| Measurement | Result |
|---|---|
| Bare `node` process, for comparison | 44 MB RSS |
| `cluub start`, idle after startup | 64 MB RSS |
| After the full run below | 163–173 MB RSS |
| The same app in Docker (`node dist/start.mjs`, `docker stats`, after a couple of requests) | 21 MiB |

The Docker figure is the container's memory as Docker reports it, which counts differently from macOS RSS.

| Workload | Concurrency | Throughput | p50 | p99 |
|---|---|---|---|---|
| `GET /api/todos`, 100 records | 1 | 5,560–5,590 req/s | 0.15 ms | 0.6 ms |
| `GET /api/todos`, 100 records | 32 | 8,250–10,100 req/s | 3.0 ms | 6.6–21.8 ms |
| `POST /api/todos` (file store grows 100 → 1,100 records) | 1 | 2,040–2,220 req/s | 0.4 ms | 1.0–1.3 ms |
| `POST /api/todos` (file store grows 1,100 → 2,100 records) | 16 | 1,360–1,590 req/s | 9 ms | 24–56 ms |
| `GET /api/todos`, 2,100 records (≈210 KB of JSON) | 8 | 616–658 req/s | 9.2–9.7 ms | 23–30 ms |
| `GET /` (index.html) | 32 | 16,360–16,690 req/s | 1.6 ms | 5.7–6.3 ms |
| `GET /_cluub/runtime/core.js` (17 KB) | 32 | 18,320–19,660 req/s | 1.4 ms | 3.9–4.7 ms |

Ranges are two separate runs, and no request failed in either. The very first 100 POSTs had a p99 of 37–42 ms, from JIT warm-up and creating the storage folder.

**What the numbers show:**

* A small app serves thousands of api requests per second on one core.
* Writes stay fast up to a few thousand records even though each write rewrites the whole JSON file. The writes are synchronous, though, so a large file blocks every other request while it's written.
* Reads scale with store size: returning 2,100 records is roughly 10× slower than returning 100, because of the copying described below.

## The runtime model

Knowing what happens on each request and each click explains these numbers.

### Backend

1. **One process, one event loop.** `cluub start` is a single Node `http` server. There is no clustering.
2. **Dispatch.** For each api request the dispatcher finds the matching route, validates every parameter against its declared type, gets the api's dependencies (created once and reused; file stores are loaded when the server starts), and calls the handler.
3. **Stores hold everything in memory.** `Store.all()`, `find()`, `get()` and `where()` return **copies**: each record is rebuilt as a new model instance, which re-runs validation. That keeps callers from mutating stored data by accident, but it costs O(n) for `all()` and `where()`. `where()` copies every record, then filters.
4. **File stores rewrite the whole file** on every `add`, `update`, `remove` and `clear`, with synchronous `writeFileSync` + `renameSync`.
5. **Responses are `JSON.stringify`'d.** No compression, no ETag. Static files are streamed from disk with `cache-control: public, max-age=300`.

### Frontend

1. **Page state is a proxy.** Assigning `todos = TodoApi.list()` schedules a re-render on the next microtask. Several assignments in one action produce one render.
2. **After every action**, the runtime renders again, whether the action succeeded or failed (a failure shows a toast).
3. **Rendering rebuilds the page's whole virtual tree** by calling `view()`, then patches the real DOM **by position**: same tag, same position means the element is reused and only changed attributes and text are updated. There are no keys, so inserting an item at the top of a 500-item list updates all 500 rows instead of inserting one.
4. **Every api call is a real HTTP request**, awaited automatically. The common pattern of "change, then reload the list" costs two round trips per click.

## Tips

**Return what the page needs from one call.** Instead of `TodoApi.add(...)` followed by `TodoApi.list()`, have the service return the updated list, as the `ai-chat` template's `ChatService.send` does. That halves the round trips:

```cluub
service TodoService
  uses Todos
  action add(title: text) -> list of Todo
    Todos.add(Todo(title: title))
    return Todos.all()
```

**Page large stores.** Return a slice instead of everything:

```cluub
api TodoApi at "/api/todos"
  uses TodoService
  get page at "/page" with offset: number = 0, size: number = 50
    return TodoService.page(offset, size)
```

**Avoid `all()` and `where()` in hot paths on large stores.** Use `get(id)` or `find(id)`: a map lookup plus one copy.

Use `Todos.count()` rather than `Todos.all().count`: `count()` reads the store's size directly, while `all()` copies every record first.

**Keep the file store small, or move hot data to memory.** A store without `saved in` never touches the disk. For data that grows without limit (logs, chat history), clear or archive old records. Database stores are on the [roadmap](/reference/roadmap).

**Cache AI results.** An AI call takes seconds and costs money. Store the answer and check for it before you ask again.

**Keep the list structure stable.** Put content that appears and disappears (an `if` block) after long lists and inputs, or inside an always-present container. Then the position-based patcher doesn't shift every following element.

**Put a proxy in front.** gzip cuts the runtime JavaScript to about a third (`core.js`: 15,028 → 5,621 bytes in our nginx test, measured before 0.1.0 grew the file to 17 KB), and the proxy can cache static files.

**Run tests by name while you work.** `cluub test "Home page"` runs only tests whose names contain that text. Add `--no-generate` to skip regenerating `tests/generated/`.

## Reproducing the measurements

The scripts are small enough to rewrite:

1. **Compile/test:** read every `.clb` file of a template into `{ path: source }`, call `compile(files, { enforceFolders: true })` in a loop, then `compile({ ...files, ...generateTests(result.decls) })` and `runTests({ serverCode, clientCode })`.
2. **Server:** `cluub build`, spawn `cluub start --port 4390`, keep reading its stdout (otherwise the request log fills the pipe and stalls the server), then run N async loops of `fetch` and sort the latencies.

Always report the machine, the Node version and the concurrency with any number.

## See also

* [Deployment](/guide/deployment)
* [Models & data](/guide/data)
* [Pages & components](/guide/frontend)
* [Store reference](/reference/store)
* [Testing strategy](/guide/testing-strategy)
