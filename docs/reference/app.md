# app

The `app` declaration names your project and holds a few project-wide settings: a description, the development port and the default AI provider. Every project has exactly one, in `app.clb` at the project root. The CLI uses that file to find the project. The app declaration has no code and no dependencies. It is a list of `key value` settings.

## Syntax

```cluub
app ShopApp
  about "An online shop with AI product descriptions"
  port 3000
  ai "claude"
```

The full shape:

```text
app Name
  [setting <expression>]...
```

Each setting is a name followed by a value on one line. `app Name` with no settings is also valid.

## Members / options

| Setting | What it does | Required? | Default |
|---|---|---|---|
| `Name` (after `app`) | The project's name, in PascalCase ([E102](/reference/errors#e102)). Used as the `<title>` of the built `index.html` (each page replaces it with its own title once it opens) and as the heading of `cluub explain`. | Yes | none |
| `about "text"` | One-line description, shown next to the name in `cluub explain`. | No | none |
| `port N` | The port `cluub dev` and `cluub start` listen on, unless `--port` or the `PORT` environment variable says otherwise. | No | `3000` |
| `ai "provider"` | Default AI provider for every `ask ai` that has no `using`. One of `"claude"`, `"openai"`, `"gemini"`, `"ollama"` (`"anthropic"` and `"google"` also work). Add a model after a colon: `"claude:claude-sonnet-5-5"`. | No | see below |
| `aiKeys "server"` | Whose AI keys pay: `"server"` (your key from `.env` or the environment), `"user"` (each end user's own key, required; your key is never used) or `"either"` (the user's key when they added one, else yours). See [Your own AI keys](/guide/ai-keys). Any other value is warning W108. | No | `"server"` |
| `aiModel "model-id"` | Model to use with the `ai` provider, as an alternative to the colon form. | No | the provider's default model |

No other settings exist. Any other name gives warning [W108](/reference/errors#w108) (`Unknown app setting "prot"; it will be ignored.` with a "Did you mean" hint) and is ignored.

## Behaviour

**Finding the project.** Every CLI command except `cluub new` looks for `app.clb` in the current folder and then in each parent folder. Without it you get `No Cluub project here (no app.clb found). Create one with cluub new my-app.`

**Settings are expressions.** Each value is compiled like any Cluub expression and evaluated when the server program starts, so text interpolation works, and `env.X` reads the environment (`ai env.AI_PROVIDER`, or `port env.APP_PORT`).

**Which port is used.**

`cluub dev` and `cluub start` pick the port the same way, first match wins:

1. the `--port` flag (`cluub start --port 8080`);
2. the `PORT` environment variable (what most hosting platforms set);
3. the app's `port` setting;
4. `3000`.

**Which AI provider and model are used** for an `ask ai`, from highest priority to lowest:

1. `using "provider[:model]"` on that `ask ai`;
2. the app's `ai` setting;
3. the `CLUUB_AI` environment variable;
4. the first provider whose API key is present in the environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, in that order);
5. `ollama` (local, no key).

The model comes from the `:model` part if given, else `aiModel` (when the provider is the one named in `ai`), else `CLUUB_<PROVIDER>_MODEL` (for example `CLUUB_CLAUDE_MODEL`), else the provider's default. Keys are never written in `app.clb`: they come from `.env`. A missing key fails the AI call at runtime with `No API key for claude. Run "cluub ai set claude" (or add ANTHROPIC_API_KEY=... to .env). Never put keys in code.` In tests the AI is always fake, whatever this setting says.

**Compile-time checks.** Only one `app` per project ([E101](/reference/errors#e101)). The name must be PascalCase ([E102](/reference/errors#e102)). Unknown settings give W108. The app must be in a file at the project root ([E301](/reference/errors#e301)). Text that looks like an API key is rejected ([E401](/reference/errors#e401)), so a key can never be committed through `app.clb`. Setting values are checked like other expressions: unknown names are reported ([E105](/reference/errors#e105)).

**Not a layer.** Nothing can `uses` the app, and the app uses nothing.

## Errors

| Code | Message (example) | Fix |
|---|---|---|
| [E010](/reference/errors#e010) | ``Expected a value but found `=`.`` | Settings have no `=`: write `port 3000`. |
| [E010](/reference/errors#e010) | `Expected a setting but found the text "port".` | Setting names are plain words, not quoted. |
| [E010](/reference/errors#e010) | `Expected the app name but found the end of the line.` | Write `app MyApp`. |
| [E102](/reference/errors#e102) | `"my_app" should be PascalCase (start with a capital letter, no underscores).` (hint: `Rename it to "MyApp".`) | Rename the app. |
| [E101](/reference/errors#e101) | `` Only one `app` declaration is allowed per project. `` (hint: ``Keep a single `app` in app.clb.``) | Delete the extra app declaration. |
| [E105](/reference/errors#e105) | `I don't know what "claude" is.` | Quote text values: `ai "claude"`. |
| [E301](/reference/errors#e301) | `An app belongs in the "project root (app.clb)" folder, but "ShopApp" is in config/app.clb.` | Move it to `app.clb` at the root. |
| [E401](/reference/errors#e401) | `This looks like a secret key written directly in the code.` | Put the key in `.env`. |
| [W108](/reference/errors#w108) | `Unknown app setting "prot"; it will be ignored.` (hint: `Did you mean "port"?`) | Fix the setting name, or remove it. Known settings: `about`, `port`, `ai`, `aiModel`, `aiKeys`, `lang`. |

## Examples

**1. The smallest project file.**

```cluub
app Notes
```

`cluub dev` serves it on port 3000 (or `PORT` / `--port`), and `ask ai` picks a provider from your `.env`.

**2. A typical starter.**

```cluub
app TodoAi
  about "A full-stack starter: todos with an AI summary"
  port 3000
  ai "claude"
```

With `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

**3. Choosing the model per environment.**

```cluub
app SupportDesk
  about "Support tickets triaged by AI"
  port 4000
  ai env.SUPPORT_AI
  aiModel "gpt-4.1-mini"
```

With `SUPPORT_AI=openai` in `.env`, every `ask ai` uses OpenAI's `gpt-4.1-mini`. Be careful when the provider can change: `aiModel` applies to whatever provider `ai` names, so `SUPPORT_AI=ollama` would ask Ollama for a model called `gpt-4.1-mini`. In that case put the model in the variable instead (`SUPPORT_AI=openai:gpt-4.1-mini`) and drop `aiModel`. A single `ask ai ... using "claude"` still overrides both, and then `aiModel` is not used because the provider differs.

## Edge cases & limits

* **Unknown settings are only a warning** (W108). A typo such as `prot 3000` still builds, and the port falls back to 3000.
* **`PORT` beats the app's `port`.** On a host that sets `PORT`, the `port` setting has no effect; that is intended.
* **An unknown provider in `ai`** is only reported at runtime, when an AI call fails with `Unknown AI provider "gpt". Use one of: claude, openai, gemini, ollama.`
* **The file name is not enforced exactly.** E301 only checks that the app is at the root; but the CLI finds projects by `app.clb`, so always use that name.
* **No other configuration** (database URLs, CORS, logging levels, feature flags) is read from the app. Read such values in services with `env.X`.
* **The compiler can build without an app** (the name defaults to `CluubApp`), which is what the playground does, but the CLI cannot.

## See also

* [Project structure & layers](/guide/structure)
* [AI guide](/guide/ai)
* [CLI reference](/reference/cli)
* [Install guide](/guide/install)
