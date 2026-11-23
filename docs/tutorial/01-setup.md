# 1. Create the project

**Goal:** create the Helpdesk project, run it in the browser, change the first page, and meet the compiler.

## Create the project

Open a terminal in the folder where you keep your projects and run:

```bash
cluub new helpdesk --template blank
```

```text
✓ Created helpdesk from the blank template.

  cd helpdesk
  cluub dev

Then open http://localhost:3000. Edit any .clb file and the page reloads.
```

There are three templates. `app` (the default) is a finished todo app and `ai-chat` is a chat assistant. We use `blank` because we want to build everything ourselves. It gives you the folder structure and one page. See [Install & first app](/guide/install) for the others.

## Look around

```bash
cd helpdesk
```

```text
helpdesk/
├── .env.example        # where AI keys will go (chapter 6)
├── .gitignore          # ignores dist/, storage/ and .env
├── app.clb             # the app's name and settings
├── models/             # data shapes and their rules
├── data/               # stores: where models are saved
├── network/            # clients for outside APIs
├── services/           # business logic and AI
├── api/                # HTTP endpoints
├── ui/
│   ├── pages/
│   │   └── home.clb    # the only page so far
│   ├── components/
│   └── layouts/
└── tests/
```

(The empty folders hold a `.keep` file so they exist. You can ignore those.)

Every Cluub project has **exactly this shape**, and the compiler enforces it. A model must live in `models/`, a page in `ui/pages/`, and so on. Put one in the wrong place and you get error **E301** with the folder it belongs in. This sounds strict, but it means that anyone, whether a teammate, a reviewer or an AI assistant, can open any Cluub project and know where everything is. [Project structure & layers](/guide/structure) explains the reasoning.

Open `app.clb`:

```cluub
app Helpdesk
  port 3000
```

This is the [`app` declaration](/reference/app). Cluub turned the folder name `helpdesk` into the app name `Helpdesk`. Two things to notice about the syntax:

- A **declaration** starts at the beginning of a line with a keyword (`app`, `model`, `page`, ...) and a name. Declaration names are `PascalCase`.
- Everything that belongs to it is **indented by two spaces**. There are no braces and no semicolons. Indentation is the structure.

## Run it

Start the development server:

```bash
cluub dev
```

```text
✓ Started in 1.8ms (1 pages · 0 apis · 0 services · 0 models)
  http://localhost:3000  · watching for changes · Ctrl+C to stop
```

Open <http://localhost:3000>. You see a heading "Hello from Helpdesk" and a line telling you to edit `ui/pages/home.clb`.

`cluub dev` compiles the whole project (frontend and backend), starts one server for both, and **watches your files**. Every time you save a `.clb` file it recompiles and reloads the browser. Leave it running in its own terminal tab for the rest of the tutorial. If port 3000 is busy, use `cluub dev --port 3001`.

## Your first page

Open `ui/pages/home.clb` and replace its contents:

```cluub
page Home at "/"
  about "The front door of the helpdesk"
  title "Helpdesk"
  view
    heading "Helpdesk"
    text "Customers will send us support tickets from this page."
    text "Agents will work through them in the queue."
```

Save. The browser reloads by itself.

Line by line:

- `page Home at "/"` declares a [page](/reference/page) called `Home` that lives at the URL `/`.
- `about "..."` is a one-line description for humans. Cluub uses `about` lines to write documentation for your product owner and QA team (chapter 8), and suggests adding one when it's missing (suggestion W104).
- `title "Helpdesk"` sets the browser tab title.
- `view` is what the page shows. Each line inside it is a [view element](/reference/view-elements): `heading` becomes a big title, `text` a paragraph. Indentation nests them, just like the rest of the language.

There is no HTML, no JSX and no CSS here. Cluub has a built-in theme that looks clean on desktop and mobile and supports dark mode. You can change it later with a `theme.css` file (see [Pages & components](/guide/frontend#look-and-feel)).

## Meet the compiler

Mistakes happen, so let's make one on purpose. In `ui/pages/home.clb`, misspell `heading` as `heding` and save. The terminal running `cluub dev` shows:

```text
error E013 ui/pages/home.clb:5:5
  `heding` is not a view element.
   4 |   view
   5 |     heding "Helpdesk"
     |     ^^^^^^
  hint: Did you mean `heading`?

✗ 1 error · 0 warnings · 0 suggestions
```

Every Cluub error has the same shape: a **code** (`E013`, look any of them up with `cluub errors E013` or in [Error codes](/reference/errors)), the **file, line and column**, the offending code with a marker under it, and a **hint** that usually tells you the fix. While there's an error, `cluub dev` keeps serving the last good version and waits for you.

Fix the typo, save, and the page is back.

You can get the same report without running the server:

```bash
cluub check
```

```text
✓ No errors (0 suggestions · checked in 1.9ms)
```

`cluub check` is fast enough to run on every save, in a pre-commit hook or in CI.

## Your first test run

You haven't written a test yet, but Cluub has already written one for you:

```bash
cluub test
```

```text
Generated 1 test in tests/generated/

tests/generated/ui.test.clb
  ✓ Home page: renders 1ms

1 passed in 2ms
```

Open `tests/generated/ui.test.clb`:

```text
test "Home page: renders"
  render Home
  expect screen has "Helpdesk"
  expect screen has "Customers will send us support tickets from this page."
```

Every time you run `cluub test`, Cluub reads your code and writes tests for it: one for each model rule, each `require` in a service, each api route, each page and each button. It runs them together with the tests you write yourself, in one process, with a fresh in-memory database and no network. You'll see this list grow in every chapter, and in [chapter 7](/tutorial/07-testing) you'll write your own. Don't edit files in `tests/generated/`. They are rewritten on every run.

## Checkpoint

You should now have:

- A `helpdesk/` folder with the structure shown above.
- `cluub dev` running, and <http://localhost:3000> showing the heading **Helpdesk** and two lines of text. The browser tab is titled "Helpdesk".
- `cluub check` printing `✓ No errors`.
- `cluub test` printing `1 passed`.

## Recap

- `cluub new <name> --template blank` creates a project with the standard folder layout. The compiler enforces that layout.
- `cluub dev` compiles, serves and live-reloads the whole app.
- Declarations start at column 1 with a keyword and a `PascalCase` name; their contents are indented by two spaces.
- A `page` has a URL, an `about`, a `title` and a `view` made of elements like `heading` and `text`.
- Errors have a code, a location and a hint. `cluub check` shows them without running anything.
- `cluub test` writes tests for your code and runs them.

Next: [2. The Ticket model](/tutorial/02-ticket-model), where we describe what a ticket is.
