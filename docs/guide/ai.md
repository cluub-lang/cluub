# AI

AI in Cluub is one expression: `ask ai`. It only works in services, the backend, so your keys never reach a browser (error **E204** if you try it in a page).

## Text

```cluub
let summary = ask ai "Summarize this support ticket in one sentence: {ticket.body}"
```

Long prompts use triple quotes:

```cluub
let reply = ask ai """
  You are a friendly support agent for our shop.
  Customer message: {message}
  Answer in under 80 words.
  """
```

## Structured output: `as Model`

```cluub
model Contact
  name: text, required
  email: email
  company: text?

service LeadService
  action extract(emailBody: text) -> Contact
    return ask ai "Extract the sender's contact details from: {emailBody}" as Contact
```

Cluub tells the AI the exact JSON shape, parses the reply, **validates it with the model's rules**, and retries once if it doesn't match. You get a real `Contact` or a precise `AIError`. `as list of Contact` works too.

## Classification: `as one of`

```cluub
let kind = ask ai "Is this a bug, a feature request or a question? {text}" as one of ["bug", "feature", "question"]
```

The result is always exactly one of the options.

## Providers

| Provider | `.env` | Default model |
|---|---|---|
| Claude (Anthropic) | `ANTHROPIC_API_KEY` | `claude-opus-5-5` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4.1-mini` |
| Google Gemini | `GEMINI_API_KEY` | `gemini-2.5-flash` |
| Ollama (local, private) | none (`CLUUB_AI=ollama`) | `llama3.2` |

Pick the default in `app.clb` (`ai "claude"`), override the model with `aiModel "…"` or `CLUUB_CLAUDE_MODEL=…`, or choose per call:

```cluub
let fr = ask ai "Translate to French: {text}" using "ollama:llama3.2"
let tone = ask ai "Rewrite politely: {text}" with system "You are an editor"
```

If no provider is set, Cluub uses the first one with a key in `.env`, then falls back to Ollama.

## AI and tests

Tests never call a real AI. `ask ai` returns a predictable fake (`as Model` returns a valid sample), so AI features are tested for free and offline.

## AI that writes Cluub: `cluub make`

```bash
cluub make "add a page that lists customers with a search box"
```

Cluub sends the AI the language reference plus your project, **compiles what comes back**, feeds any errors back to the AI (up to 3 rounds), and writes files only when the whole project compiles. Because the language is small and the structure is enforced, AI-written code looks like everyone else's.
