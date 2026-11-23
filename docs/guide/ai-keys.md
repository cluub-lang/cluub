# Your own AI keys

Cluub is **bring-your-own-key** by design. Cluub never ships an AI key, never sends your requests through a Cluub server, and never charges for AI. Every `ask ai` goes straight from *your* server to the provider (Claude, OpenAI, Gemini or a local Ollama) using a key that *you*, or *your users*, own.

There are two ways to supply keys, and an app can use either or both:

| Who pays | Where the key lives | Use it when |
|---|---|---|
| **You, the developer** (`aiKeys "server"`, the default) | `.env` on your server, managed with `cluub ai` | Internal tools, products where AI is part of what you sell |
| **Each end user** (`aiKeys "user"`) | The user's own browser; sent only with that user's requests | Public tools where every user brings their own account and pays their own provider bill |
| **Both** (`aiKeys "either"`) | The user's key when they added one, otherwise yours | A free tier on your key, with power users on theirs |

## Developer keys: `cluub ai`

Run these inside a project folder.

```bash
cluub ai set claude        # paste the key when asked; it is hidden and never echoed
cluub ai test claude       # one tiny request to prove the key works
cluub ai                   # show which keys are set (masked)
cluub ai use openai        # make OpenAI the default provider (or ollama:llama3.2)
cluub ai remove claude     # delete the key from .env
```

What `cluub ai set` does, exactly:

* Writes `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY` into the project's `.env` file and sets the file's permissions so only you can read it (mode 600).
* Adds `.env` to `.gitignore` if it is missing, so a key can't be committed by accident.
* Asks for the key with hidden input. If you pass the key as an argument instead, Cluub warns you that it is now in your shell history.

`cluub ai` (the status view) looks like this:

```text
AI keys for this project (stored in .env, which is git-ignored)
  claude  ✓ set  sk-a…abcd
  openai  – not set
  gemini  – not set
  ollama  no key needed (local models)

  Default provider: claude
  Whose keys pay:   server (app.clb `aiKeys`: server, user or either)
```

Keys set as real environment variables (for example by your hosting provider) also work, and they **win over** `.env`. That is how you supply keys in production without a `.env` file on the server.

If a key is missing when an AI feature runs, the error says exactly what to do:

```text
No API key for claude. Run "cluub ai set claude" (or add ANTHROPIC_API_KEY=... to .env). Never put keys in code.
```

A key written directly in a `.clb` file is compile error [E401](/reference/errors#e401).

## End-user keys: `aiKeys "user"` and the `aikey` element

To let each person who uses your app bring their own key, change one setting and add one element.

**`app.clb`**

```cluub
app Writer
  about "An AI writing helper where every user brings their own key"
  aiKeys "user"
```

**`ui/pages/settings.clb`**

```cluub
page Settings at "/settings"
  about "Lets the user add or forget their own AI key"
  view
    heading "Your AI key"
    aikey
    if hasAiKey()
      text "You're all set. AI features will use your key."
```

The built-in `aikey` element renders a small, accessible form: a provider choice (Claude, OpenAI or Google Gemini), a password field, a **Remember on this device** checkbox and a **Save key** button. Once a key is saved it shows *"Using your own Claude (Anthropic) key (ending 1a2b)"* and a **Forget my key** button. The built-in `hasAiKey()` tells your views whether a key is saved, for example to show a hint before the first AI action.

Nothing else changes in your code: services keep using `ask ai` exactly as before.

### How the end user's key travels

1. The key is stored **only in the user's browser**: in `sessionStorage` (cleared when the tab closes) by default, or in `localStorage` when they tick *Remember on this device*.
2. On each api call, the browser sends it to **your app's own server** in two request headers, `X-Cluub-AI-Provider` and `X-Cluub-AI-Key`, never in the URL.
3. The server attaches the key to **that request only** (using Node's `AsyncLocalStorage`, so concurrent users can never see each other's keys), calls the provider, and forgets it. The key is **never stored, never written to the server log** and never echoed back.
4. With `aiKeys "user"`, your own `.env` key is **never used**, even if one exists.

If an AI feature runs without a user key, the request fails with status **401** and code `ai_key_required`, and the user sees:

```text
This feature uses your own AI key. Add your key in the app, then try again.
```

This message is shown in production too, because the user needs to act on it.

### Choosing the provider and model

The provider comes from the user's choice in the `aikey` form. The model is the provider's default (see [Choosing a model](/reference/ask-ai#choosing-a-model)), or the `:model` part of a `using "provider:model"` on the `ask ai` line when it names the same provider. `CLUUB_<PROVIDER>_MODEL` on the server also applies. End users can bring keys for Claude, OpenAI and Gemini; Ollama runs on your server and needs no key.

## Security checklist

* **Serve the app over HTTPS.** End-user keys travel in request headers, which HTTPS encrypts. Locally, `http://localhost` is fine. See [Deployment](/guide/deployment).
* **Keep the strict Content Security Policy** that Cluub sends with every page. It stops injected scripts from reading keys out of the browser. See [Security](/guide/security).
* **Tell users what happens.** The `aikey` form already explains that the key stays in their browser; link to your privacy page if you have one.
* **Don't log request headers** in a proxy in front of Cluub (nginx, a load balancer). Cluub itself never does.
* **Rotate keys you suspect have leaked** in the provider's dashboard; `cluub ai set` replaces the local copy.

## In tests

Tests never call a real provider and never need a key, whatever `aiKeys` says: `ask ai` returns a predictable fake answer. The `aikey` element works in UI tests, so you can test the flow:

```cluub
page Home at "/"
  view
    heading "Settings"
    if hasAiKey()
      text "Key ready"
    aikey

test "a user can add and forget their key"
  render Home
  type "sk-test-abcd1234" into "Paste your API key"
  click "Save key"
  expect screen has "Key ready"
  click "Forget my key"
  expect screen has "Paste your API key"
```

## See also

* [AI guide](/guide/ai) and the [`ask ai` reference](/reference/ask-ai)
* [`app` reference](/reference/app): the `aiKeys` setting
* [View elements](/reference/view-elements#aikey): the `aikey` element
* [Security](/guide/security)
