# Install & first app

You need **Node.js 18 or newer** (check with `node --version`). Cluub has no other dependencies.

## Create a project

Run one command in a terminal, just like `npm create vite` or `ng new`:

::: code-group

```bash [npm]
npm create cluub@latest my-app
```

```bash [pnpm]
pnpm create cluub my-app
```

```bash [yarn]
yarn create cluub my-app
```

```bash [bun]
bun create cluub my-app
```

:::

It asks for a project name and a template (or pass them: `npm create cluub@latest my-app -- --template ai-chat`), then prints the next steps:

```bash
cd my-app
npm install
npm run dev
```

Open <http://localhost:3000>. You have a working full-stack todo app with a layout, an about page, validation, a JSON-file database, an AI summary button and tests. Edit `ui/pages/home.clb`, change the heading, save, and the browser reloads.

Every project has these scripts:

| Script | Runs | Does |
|---|---|---|
| `npm run dev` | `cluub dev` | Build, run and reload on save |
| `npm test` | `cluub test` | Generate and run all tests |
| `npm run check` | `cluub check` | Errors and suggestions, without running |
| `npm run build` | `cluub build` | Compile to `dist/` |
| `npm start` | `cluub start` | Run the built app |

## Or install the `cluub` command globally

```bash
npm install -g cluub
cluub new my-app
cd my-app
cluub dev
```

With the global command you can skip `npm install` in each project; inside a project, `npx cluub …` also works.

::: tip Before the packages are published
Until `cluub` and `create-cluub` are on npm, install from the source folder: run `npm link` inside the `cluub` folder, then use `cluub new my-app`.
:::

## Templates

| Template | What it gives you |
|---|---|
| `app` (default) | Full-stack todos: layout, components, file storage, AI summary, tests |
| `ai-chat` | A chat assistant with conversation memory and structured AI output |
| `blank` | The folder structure and one page |

```bash
cluub new support-bot --template ai-chat
```

## Turning on AI

Cluub is **bring-your-own-key**: it never provides or proxies an AI key. Add yours with:

```bash
cluub ai set claude      # or openai / gemini; the key is asked for privately
cluub ai test claude
```

The rest of this section shows the `.env` file that command writes. To let your app's *users* bring their own keys instead, see [Your own AI keys](/guide/ai-keys).

### The .env file

Copy `.env.example` to `.env` and set **one** key:

```bash
ANTHROPIC_API_KEY=...      # Claude
# OPENAI_API_KEY=...
# GEMINI_API_KEY=...
# CLUUB_AI=ollama           # local models, no key needed
```

## Editor support

Syntax highlighting is defined in `editors/cluub.tmLanguage.json` (TextMate format, works in VS Code, Sublime Text and others). A language server with inline errors and suggestions is on the [roadmap](/reference/roadmap). Until then, run `cluub dev`: it prints errors and suggestions on every save.
