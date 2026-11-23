# CLI

| Command | What it does |
|---|---|
| `cluub new <name> [--template app\|ai-chat\|blank]` | Create a project |
| `cluub dev [--port 3000]` | Build, run, watch files and reload the browser on save. Shows errors and suggestions on every save |
| `cluub check` | Errors, warnings and suggestions without running anything |
| `cluub test [filter] [--no-generate]` | Regenerate tests in `tests/generated/` and run all tests |
| `cluub explain [--for po\|ba\|qa\|dev] [--out file]` | Plain-English overview of the project |
| `cluub make "<request>" [--using claude\|openai\|gemini\|ollama]` | AI writes or changes code; files are written only if the project compiles |
| `cluub build` | Compile to `dist/` (`dist/server.js` + `dist/public/`) |
| `cluub start [--port 3000]` | Run the built app (`PORT` env var also works) |
| `cluub errors [CODE]` | List error codes or explain one |
| `cluub ai` | Show which AI provider keys are set (masked), the default provider and the `aiKeys` mode |
| `cluub ai set <claude\|openai\|gemini>` | Save a key in `.env` with hidden input; `.env` gets mode 600 and is added to `.gitignore` |
| `cluub ai use <provider[:model]>` | Set the default provider (`CLUUB_AI` in `.env`) |
| `cluub ai test [provider]` | Send one tiny request to check a key works |
| `cluub ai remove <provider>` | Delete a key from `.env` |
| `cluub version`, `cluub help` | |

## `cluub ai`

Cluub is bring-your-own-key: these commands manage *your* provider keys for one project. Nothing is sent anywhere except `cluub ai test`, which makes one tiny request to the provider you name. See [Your own AI keys](/guide/ai-keys) for end-user keys.

```bash
cluub ai set claude      # paste the key when asked (hidden)
cluub ai test claude     # ✓ The key works. Reply: "OK"
cluub ai use openai:gpt-4.1-mini
cluub ai remove claude
```

## What `cluub build` produces

```text
dist/
├── server.js                 # your backend as plain JavaScript
└── public/
    ├── index.html
    └── _cluub/
        ├── app.client.js     # your pages and components as plain JavaScript
        ├── theme.css
        └── runtime/…         # the ~1,000-line Cluub runtime (no third-party code)
```

Deploy anywhere Node 18+ runs: copy the project and run `cluub start`.

## Environment variables

| Variable | |
|---|---|
| `PORT` | server port |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` | AI providers |
| `CLUUB_AI` | default provider, e.g. `ollama` or `claude:claude-sonnet-5-5` |
| `CLUUB_<PROVIDER>_MODEL` | default model for a provider |
| `OLLAMA_HOST` | Ollama address (default `http://localhost:11434`) |
| `NO_COLOR` | plain terminal output |
