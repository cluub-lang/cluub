# Persisting data to a JSON file

## Problem

In-memory stores forget everything when the server restarts, which is fine for a demo and useless for a real journal, a team wiki or a small internal tool. You want data to survive restarts without setting up a database, and to know exactly what happens to the file when your models change.

## Solution

Add `saved in "…"` to the store. Nothing else in the project changes: services, apis, pages and tests stay the same.

**`models/entry.clb`**

```cluub
model Entry
  about "One journal entry"
  text: text, required "Write something first", max 5000
  mood: text = "okay", one of ["great", "okay", "rough"]
  writtenOn: date = today()
```

**`data/entries.clb`**

```cluub
store Entries holds Entry saved in "storage/entries.json"
  about "Journal entries, kept in a JSON file next to the project"
```

**`services/journal-service.clb`**

```cluub
service JournalService
  about "Writing, reading and deleting journal entries"
  uses Entries

  action write(text: text, mood: text = "okay") -> Entry
    about "Save a new entry dated today"
    require text is not empty, "Write something first"
    return Entries.add(Entry(text: text, mood: mood))

  action list() -> list of Entry
    return Entries.all()

  action remove(id: text)
    Entries.remove(id)

  action summary() -> text
    about "How many entries there are, and how many were great"
    let great = Entries.where(e => e.mood is "great").count
    return "{Entries.count()} entries, {great} great days"
```

**`api/journal-api.clb`**

```cluub
api JournalApi at "/api/entries"
  about "Journal endpoints"
  uses JournalService

  get list at "/"
    return JournalService.list()

  get summary at "/summary"
    return JournalService.summary()

  post write at "/" with text: text = "", mood: text = "okay"
    return JournalService.write(text, mood)

  delete remove at "/{id}"
    JournalService.remove(id)
```

**`ui/pages/journal.clb`**

```cluub
page Journal at "/"
  about "A journal whose entries survive server restarts"
  title "Journal"
  uses JournalApi
  state entries = []
  state summary = ""
  state draft = ""
  state mood = "okay"

  when loaded
    refresh()

  action refresh()
    entries = JournalApi.list()
    summary = JournalApi.summary()

  action write()
    about "Save the entry"
    JournalApi.write(text: draft, mood: mood)
    draft = ""
    refresh()

  action remove(id: text)
    JournalApi.remove(id)
    refresh()

  view
    heading "Journal"
    text summary, style muted
    input draft, placeholder "How was today?", multiline
    row
      select mood, options ["great", "okay", "rough"]
      button "Save entry", on click write, style primary, disabled draft is empty
    for entry in entries
      card
        row
          badge entry.mood
          text entry.writtenOn, style muted
          button "Delete", on click remove(entry.id), style ghost
        text entry.text
```

## How it works

* **`saved in "storage/entries.json"`** turns the store into a file store. The path is relative to the project root. The folder is created on the first write.
* **Loaded at startup, written on every change.** When the server starts, Cluub reads the file and validates every item against the model. Each `add`, `update`, `remove` and `clear` rewrites the whole file: first to `entries.json.tmp`, then renamed over the real file, so a crash in the middle never leaves half a file.
* **The file is plain JSON**: a list of your items with their ids, readable and easy to back up or put under version control if you want to:

```json
[
  {
    "id": "1",
    "text": "Shipped the cookbook.",
    "mood": "great",
    "writtenOn": "2026-11-23"
  }
]
```

* **Ids keep counting.** After a restart, new items get the next number after the highest id in the file, so ids are never reused.
* **Reads are served from memory.** `all()`, `find()`, `where()` and `count()` don't touch the disk, so they're fast; stores return copies, so changing an item only sticks after `update`.
* **Tests always use memory.** `cluub test` gives every test a fresh, empty in-memory store, so tests never read or overwrite your real file.
* **`storage/` is git-ignored** in new projects (`.gitignore` lists `storage/`), so personal data isn't committed by accident.

## Test it

**`tests/journal.test.clb`**

```cluub
test "an entry is saved with today's date"
  let entry = JournalService.write("Shipped the cookbook.", "great")
  expect entry.writtenOn is today()
  expect JournalService.summary() is "1 entries, 1 great days"

test "the page writes and deletes entries"
  render Journal
  type "Shipped the cookbook." into "How was today?"
  click "Save entry"
  expect screen has "Shipped the cookbook."
  expect screen has "1 entries"
  click "Delete"
  expect screen has "0 entries"
```

These tests prove the logic, not the file: tests run in memory. To see persistence, run the app, add an entry, stop it and start it again:

```bash
cluub build && cluub start      # add an entry in the browser, then Ctrl+C
cat storage/entries.json      # the entry is there
cluub start                    # ...and still on the page
```

## Variations and pitfalls

* **Adding a field is safe if it has a default** (`tags: list of text = []`) or is optional (`location: text?`): old items get the default when the file loads.
* **Removing or renaming a field breaks loading.** Items in the file still have the old field, so the server refuses to start with *Could not load storage/entries.json for store Entries: Entry has no field "…"*. Edit the JSON (remove or rename the key in every item) before you start the new version. The same happens if you add a new `required` field without a default, or tighten a rule that old items break.
* **Don't edit the file while the server runs.** The server reads it once at startup and overwrites it on the next change.
* **Small data only.** The whole file is rewritten on every change and kept in memory. That's great for hundreds or a few thousand items and a handful of users; for more, database stores are on the [roadmap](/reference/roadmap). Swapping will only mean changing this one line.
* **One server process.** Two servers writing the same file will overwrite each other's changes.
* **Seeding.** There's no startup hook. Seed in a service action when `Entries.count() is 0`, as in [Search and filtering](/cookbook/search-filter).

## See also

* [Store reference](/reference/store)
* [Models & data: stores](/guide/data#stores-data-layer)
* [CLI](/reference/cli) (`cluub build`, `cluub start`)
* [CRUD list](/cookbook/crud-list)
