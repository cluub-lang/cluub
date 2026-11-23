# Troubleshooting

Each entry below starts with the exact symptom: the message you see in the terminal, the browser or a test report. Then it gives the cause and the fix. All messages were reproduced with Cluub 0.1.0. When a CLI command fails, set `CLUUB_DEBUG=1` to also print the stack trace.

## The port is already in use

```text
✗ Port 3000 is already in use. Stop the other program or run with --port 3001.
```

**Cause:** another process (often an earlier `cluub dev` you forgot in another terminal) is listening on that port.

**Fix:** stop it, or pick another port:

```bash
lsof -i :3000          # macOS/Linux: see who holds the port
cluub dev --port 3001
PORT=3001 cluub start
```

## "No Cluub project here"

```text
✗ No Cluub project here (no app.clb found). Create one with `cluub new my-app`.
```

**Cause:** you ran the command outside a project. Cluub looks for `app.clb` in the current folder and every parent folder.

**Fix:** `cd` into the folder that contains `app.clb`.

## Tabs or uneven indentation (E001, E002, E003)

```text
error E001 ui/pages/about.clb:2:1
  Tabs are not allowed for indentation.
   2 | 	view
     | ^
  hint: Use 2 spaces per level. Your editor can convert tabs to spaces ("Indent using spaces").
```

```text
error E002 ui/pages/about.clb:2:1
  Indent each block by exactly 2 spaces (this line is indented 3 more than the line above).
```

```text
error E003 ui/pages/about.clb:4:1
  This line's indentation doesn't line up with any block above it.
  hint: Use 2 spaces to continue the outer block.
```

**Cause:** blocks are defined by indentation, exactly 2 spaces per level. Tabs are rejected outright. A line indented 3 or 4 spaces deeper than its parent is E002, and a line that returns to a column no open block uses is E003. Lexer errors stop at the first problem in each file.

**Fix:** set your editor to "indent using spaces, size 2" for `.clb` files, and re-indent the file. In VS Code, use *Convert Indentation to Spaces* from the command palette. Text pasted from chat or email often brings tabs along.

## Declaration in the wrong folder (E301)

```text
error E301 services/todo-model.clb:1:1
  A model belongs in the "models" folder, but "Todo" is in services/todo-model.clb.
  hint: Move it to models/todo.clb. Every Cluub project has the same layout so anyone can find anything.
```

**Cause:** each declaration kind has one folder: `models/`, `data/` (stores), `network/` (clients), `services/`, `api/`, `ui/pages/`, `ui/components/`, `ui/layouts/`, `tests/`. `app` goes in `app.clb` at the root.

**Fix:** move the file to the folder the hint names. Any file name works (kebab-case is the convention): only the folder matters.

## Layer rule errors (E201, E203, E204, E205)

```text
error E201 ui/pages/about.clb:2:8
  A UI page (About) can't use the data layer directly (Todos is a store).
   2 |   uses Todos
     |        ^^^^^
  hint: Pages talk to the backend only through an `api`. Flow: page → api → service → store/client.
```

**Cause:** the dependency skips a layer. Allowed: page → api, api → service, service → store, client or service. Components and layouts can't `uses` anything (E203). `ask ai` (E204) and `env` (E205) are backend-only.

**Fix:** add the missing layer. For a page that needs store data, add a service action that reads the store and an api route that calls it, then `uses` the api in the page. See [Project structure & layers](/guide/structure).

## AI: no API key or the AI is unavailable

Under `cluub start`, the page shows a generic toast and the server log has the reason:

```text
toast:       The AI service is not available right now. Please try again.
server log:  ✗ TodoApi.summary: No API key for claude. Run "cluub ai set claude" (or add ANTHROPIC_API_KEY=... to .env). Never put keys in code.
```

Under `cluub dev`, the toast shows the reason directly. The templates' "Summarize with AI" button does this until you add a key.

**Cause:** the provider chosen for the call has no key. The provider is picked in this order: `using "..."` on the call, then `CLUUB_AI` (environment or `.env`), then the `ai` line in `app.clb`, then the first provider with a key, then Ollama.

**Fix:** copy `.env.example` to `.env` and fill in the key for the provider in `app.clb` (the templates use `ai "claude"`), or set `CLUUB_AI=ollama` to use a local model instead. Then **restart** `cluub start`. `cluub dev` rebuilds by itself when `.env` changes.

A wrong key is logged with the provider's answer, for example `claude returned 401: invalid x-api-key. Check that your API key is correct.` A rate limit adds `You hit a rate limit; wait a moment and try again.`

## AI: Ollama isn't running

```text
Could not reach Ollama at http://localhost:11434. Start it with `ollama serve`, or set CLUUB_AI=claude in .env.
```

**Cause:** the provider is Ollama (`CLUUB_AI=ollama`, `ai "ollama"`, or no key at all), and nothing answered at the address shown, which is `OLLAMA_HOST` or the default `http://localhost:11434`.

**Fix:** start Ollama (`ollama serve`) and pull the model (`ollama pull llama3.2`, or the model named in `CLUUB_OLLAMA_MODEL`). A missing model gives `ollama returned 404: model 'name' not found.` To use a hosted provider instead, set `CLUUB_AI=claude` (or another provider) and its key.

## The page is blank

| What you see | Cause | Fix |
|---|---|---|
| A white page, and the browser console shows a module or 404 error | you opened `dist/public/index.html` from disk (`file://`), or the server isn't running | open the app through `cluub dev` or `cluub start`, at `http://localhost:3000` |
| A white page with no console errors | the page's `view` is empty (warning **W106**), or every element sits in an `if` that is false | check `cluub check` for W106. Add something that always shows |
| `Page not found. Nothing lives at /x.` | no page has that path | check the `at "/path"` on your pages |
| `EventSource's response has a MIME type ("text/html")...` in the console | `dist/` was last written by `cluub dev`, and you're running `cluub start` | run `cluub build` before `cluub start` |
| `Refused to load ... because it violates the following Content Security Policy directive` | your `theme.css` or view loads a font, stylesheet or script from another site | copy the file into `assets/` and reference `/assets/...` |
| An old version of the app | the browser cached the static files (`max-age=300`) | hard-reload, or wait five minutes after a deploy |

## "This page hit an error while drawing"

```text
This page hit an error while drawing: Can't turn "abc" into a number
```

**Cause:** an expression in the `view` threw while rendering, for example `text round(number(price), 2)` when `price` holds text, or a component given the wrong kind of value. The rest of the page (layout, header) still renders around the message.

Reading a field of something that is still `nothing` doesn't crash: views use safe member access, so `heading user.name` just shows nothing until `when loaded` fills `user`. You may still want an explicit loading state:

```cluub
page Profile at "/users/{id}"
  uses UserApi
  state user = nothing
  when loaded
    user = UserApi.get(id)
  view
    if user is nothing
      spinner
    else
      heading user.name
```

Runtime errors point to generated JavaScript, not to your `.clb` line (source maps are on the [roadmap](/reference/roadmap)). Look at the browser console for the full error. `dist/public/_cluub/app.client.js` is readable if you need to see the generated code.

## A toast says "Something went wrong"

| Toast text | Meaning |
|---|---|
| your own message, a validation message, `... was not found` | a normal Cluub error: the code did its job (`fail` messages are always shown) |
| `Something went wrong on the server.` | a bug in backend code under `cluub start`. The **server terminal** has the real message |
| `The AI service is not available right now. Please try again.` / `An outside service is not available right now. Please try again.` | an AI or `client` call failed under `cluub start`. The server terminal has the reason |
| `Unexpected error in TodoApi.add: ...` | a backend bug under `cluub dev`, with the message shown |
| `Something went wrong: ...` | a JavaScript error in the page's own code. Check the browser console |
| `Request body must be valid JSON.` / `Request body is larger than 1 MB.` | a malformed or oversized request (400 / 413) |

## Calling the api from curl or another tool returns 415

```text
{"error":{"code":"bad_content_type","message":"Send the request body as JSON with the header Content-Type: application/json."}}
```

**Cause:** api request bodies must be JSON with `Content-Type: application/json`. This is a deliberate CSRF protection ([Security](/guide/security#http-defaults)). `curl -d` sends `application/x-www-form-urlencoded` by default.

**Fix:** `curl -H 'content-type: application/json' -d '{"title":"Milk"}' localhost:3000/api/todos`.

## "A view can't call an api or an action while it is being drawn" (E117)

```text
error E117 ui/pages/home.clb:5:26
  A view can't call an api or an action while it is being drawn.
   5 |     for t in TodoApi.list()
     |                          ^
  hint: Load the data into `state` in `when loaded` or in an action, then show the state in the view.
```

**Cause:** the view runs on every render. Calling an api, a page action, a component callback or `sleep()` from it would start a request on every redraw. Views only show data.

**Fix:** declare `state todos = []`, fill it in `when loaded` (`todos = TodoApi.list()`), and write `for t in todos` in the view.

## Generated tests fail

```text
tests/generated/models.test.clb
  ✗ Todo: title is required 0ms
      It failed as expected, but with the message:
        "Title can't be empty"
      instead of one containing:
        "title is required"
```

Generated tests are rebuilt from your code on every `cluub test`, so a failure means the code and the runtime disagree. Common causes:

* **The rule exists, but something else fires first:** a `default` value or another rule that's checked earlier. Read the message to see which one.
* **"works with valid input" fails with "Unexpected error":** the action crashed on sample input, for example by using a client result (`nothing` in tests) or the fake AI's reply as if it were real data. Handle `nothing`.
* **"the X button works" fails with "The page crashed":** clicking with sample text in the inputs throws in the page. Run the same steps in the browser. (Buttons with a `disabled` rule get no generated test, and navigating away after the click is fine.)
* **`There is no input with the placeholder ...`** in your own UI test: `type ... into` matches placeholders only, not labels.

Don't edit files in `tests/generated/`: the next run overwrites them. Fix the code, or write your own test in `tests/`.

## Live reload doesn't reload

**Symptom:** `cluub dev` prints `✓ Rebuilt in 4.6ms`, but the browser keeps showing the old page.

How it works: each build has an id. When the dev server restarts, the browser's live-reload connection drops, reconnects, receives the new id, and reloads. In our test the new id arrived about 3 seconds after saving, because browsers wait a few seconds before reconnecting. So **wait a moment** before refreshing by hand.

If it still doesn't reload:

* **Only `.clb`, `.css` and `.env` changes are watched.** Saving an image in `assets/` doesn't trigger a rebuild. Save any `.clb` file, or restart `cluub dev`.
* **Compile errors keep the old build running.** The terminal shows the errors and `Waiting for you to fix the errors above…`, and the browser keeps the last good version.
* **You opened a production build.** Live reload only exists in pages served by `cluub dev`.
* **Linux with Node 18:** `cluub dev` uses recursive `fs.watch`, which Node only supports on Linux from version 20. Use Node 20 or newer. We didn't test this on Linux.

## The JSON store is corrupt or out of date

The server refuses to start:

```text
✗ Could not load storage/todos.json for store Todos: Unexpected end of JSON input. Fix the file, or move it away to start empty.
```

```text
✗ Could not load storage/todos.json for store Todos: done must be a yes/no value (got "maybe"). Fix the file, or move it away to start empty.
```

**Causes:**

* the file was edited by hand and isn't valid JSON, or
* the **model changed** and old records no longer pass validation. For example, you added `priority: text, required` with no default, and saved records don't have it.

**Fix:**

1. Back up the file first: `cp storage/todos.json storage/todos.json.bak`.
2. Repair the JSON, or update the records. Adding a default to the new field (`priority: text = "normal"`) is usually easiest, because loading fills in missing fields with their defaults. To start empty, move the file away.
3. Start the server again. Always edit store files with the server stopped: a running server overwrites the file on its next write.

A leftover `storage/todos.json.tmp` is from an interrupted write. It's safe to delete.

## See also

* [Errors & suggestions](/guide/errors)
* [Error codes](/reference/errors)
* [Deployment](/guide/deployment)
* [AI](/guide/ai)
* [FAQ](/faq)
