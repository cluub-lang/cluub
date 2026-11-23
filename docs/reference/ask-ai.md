# Ask AI

`ask ai` sends a prompt to a language model and gives back its answer: as text, as a validated model, as a list, or as one of a fixed set of options. The same line works with Claude, OpenAI, Gemini and Ollama. It has no dependencies; requests are made with `fetch`.

## Syntax

```text
ask ai PROMPT [as TYPE | as one of LIST] [using PROVIDER] [with system SYSTEM]
```

`ask ai` is an expression, usually on the right of `let` or `return`. The options can come in any order after the prompt.

```cluub
model Contact
  name: text, required
  email: email

service Assistant
  action examples(note: text, report: text, t: text)
    let summary = ask ai "Summarize in one sentence: {note}"
    let contact = ask ai "Extract the contact from: {note}" as Contact
    let tags = ask ai "List 3 tags for: {note}" as list of text
    let kind = ask ai "Bug or feature? {report}" as one of ["bug", "feature"]
    let french = ask ai "Translate to French: {t}" using "openai" with system "You are a translator"
    return summary
```

| Part | Value | Effect |
|---|---|---|
| prompt | any expression (converted to text) | The user message. Triple-quoted text is convenient for long prompts. |
| `as TYPE` | a type: `text`, `number`, `bool`, a model, `list of T` | Ask for JSON and parse it into that type. |
| `as one of LIST` | a list expression | The answer is exactly one entry of the list. |
| `using SPEC` | text: `"provider"` or `"provider:model"` | Choose the provider (and model) for this call. |
| `with system TEXT` | any expression | System prompt (instructions that frame the request). |

The prompt and each option value are read as an arithmetic-level expression, so `ask ai "Hi " + name` works; wrap comparisons in parentheses.

## Where it is allowed

`ask ai` runs on the server so API keys never reach the browser.

| Declaration | Allowed |
|---|---|
| `service`, `api` | yes |
| `test` | yes, with the fake AI |
| `page`, `component`, `layout` | no: error **E204** `AI can only be called from a service, not from the UI.` |

Pages call an api, which calls a service that asks the AI.

## Plain text answers

Without `as`, the result is the model's reply text. For Claude, all text blocks of the reply are joined. There is no retry for plain answers.

```cluub
service Summaries
  action summarize(article: text) -> text
    let prompt = """
      Summarize this article in three bullet points.
      Article:
      {article}
      """
    return ask ai prompt with system "You write short, factual summaries."
```

## Structured answers: `as Type`

With `as Type`, Cluub appends an instruction to the prompt and parses the reply as JSON:

```text
<your prompt>

Reply with only <description>. No explanation, no markdown.
```

| Type | Description sent to the model | How the reply is used |
|---|---|---|
| a model | `a JSON object with fields { "name": text, "tags": array, "tier": text (one of free/pro) }` | Built into the model and **validated** (all rules apply). |
| `list of Model` | `a JSON array of a JSON object with fields {...}` | Each item built and validated. |
| `list of text` (or other) | `a JSON array of a JSON string` | Parsed; items are not validated. |
| `number` | `a JSON number` | Parsed JSON, not checked. |
| `bool` | `true or false` | Parsed JSON, not checked. |
| `text` | `a JSON string` | Parsed JSON. The reply must be quoted JSON text. |
| other types | `JSON` | Parsed JSON. |

Parsing steps:

1. Trim the reply and remove a surrounding Markdown fence (```` ```json ... ``` ````).
2. `JSON.parse` the rest.
3. Build the result: models are created (and validated); a list result is mapped item by item.

### Retries

If parsing or validation fails, Cluub asks once more, adding `Your previous reply was invalid: <reason>. Fix it.` to the prompt. After two failed attempts the call fails with:

```text
The AI did not return valid Contact data: <reason>
```

```cluub
model Ticket
  title: text, required, max 80
  priority: text, one of ["low", "normal", "high"]
  tags: list of text = []

service Triage
  action classify(email: text) -> Ticket
    return ask ai "Turn this support email into a ticket: {email}" as Ticket
```

If the model answers with `"priority": "urgent"`, the first attempt fails with `priority must be one of: low, normal, high`, the second attempt includes that message, and a valid reply returns a `Ticket`.

## Choices: `as one of [...]`

Cluub appends `Answer with exactly one of these options and nothing else: a, b, c` to the prompt, then matches the reply:

1. **Exact match**: the trimmed reply, with `.`, `"` and `'` removed, equals an option, ignoring case.
2. **Loose match**: otherwise, the first option (in list order) that appears anywhere in the reply, ignoring case.
3. Otherwise the call fails: `The AI answered "<first 80 characters>", which is not one of: bug, feature.`

The result is always the option as written in your list, converted to text (so `as one of [1, 2]` returns `"1"` or `"2"`). There is no retry.

Because loose matching takes the first option found, put options that contain other options first (`["not urgent", "urgent"]`, not the reverse).

## Whose key is used

The app setting `aiKeys` decides whose key pays for each call (details in [Your own AI keys](/guide/ai-keys)):

| `aiKeys` | Key used for an `ask ai` call |
|---|---|
| `"server"` (default) | Your key from the environment or `.env`, chosen as described below. End-user keys are ignored. |
| `"user"` | The end user's own key, sent by the browser with their request. Without one the call fails with **401** `ai_key_required`: "This feature uses your own AI key. Add your key in the app, then try again." Your key is never used. |
| `"either"` | The end user's key when the request carries one, otherwise your key. |

With an end-user key, the provider is the one the user picked (Claude, OpenAI or Gemini); a `using "provider:model"` on the line contributes its model only when it names that same provider. Developers manage their own keys with [`cluub ai`](/reference/cli#cluub-ai).

## Choosing a provider

For each call, the provider spec is the first of:

1. `using "..."` on the call,
2. the `CLUUB_AI` environment variable (so each machine or deployment can switch provider without changing code),
3. the `ai` setting in the `app` declaration (`ai "claude"` or `ai "claude:claude-sonnet-5-5"`),
4. the first provider whose key is set, checked in order: Claude (`ANTHROPIC_API_KEY`), OpenAI (`OPENAI_API_KEY`), Gemini (`GEMINI_API_KEY`),
5. `ollama`.

A spec is `provider` or `provider:model`; everything after the first `:` is the model name. Provider names ignore case; `anthropic` means `claude` and `google` means `gemini`.

```cluub
app SupportDesk
  ai "claude"
  port 3000
```

### Choosing a model

The model is the first of:

1. the model in the spec (`"openai:gpt-4.1"`),
2. the app's `aiModel` setting, when the provider is the one named by the app's `ai` setting,
3. the `CLUUB_<PROVIDER>_MODEL` environment variable (`CLUUB_CLAUDE_MODEL`, `CLUUB_OPENAI_MODEL`, `CLUUB_GEMINI_MODEL`, `CLUUB_OLLAMA_MODEL`),
4. the default below.

| Provider | Key variable | Default model | Endpoint |
|---|---|---|---|
| `claude` | `ANTHROPIC_API_KEY` | `claude-opus-5-5` | `https://api.anthropic.com/v1/messages` |
| `openai` | `OPENAI_API_KEY` | `gpt-4.1-mini` | `https://api.openai.com/v1/chat/completions` |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.5-flash` | Gemini `generateContent` (v1beta) |
| `ollama` | none | `llama3.2` | `OLLAMA_HOST` (default `http://localhost:11434`) + `/api/chat` |

Keys are read from the environment and the project's `.env` file. A key written in code is a compile error (**E401**). Claude requests use `max_tokens` 16000.

### Request timeout

Each request times out after **120 seconds**. A timeout is reported like a network failure: `Could not reach claude: <reason>`.

## Fake AI in tests

`cluub test` never calls a real model. Every `ask ai` returns a predictable value instead, whatever keys are configured:

| Call | Fake result |
|---|---|
| plain | `AI reply to: <first 60 characters of the prompt>` |
| `as one of [...]` | the first option |
| `as Model` | a sample model: the first `one of` entry, `"Sample <field>"` for text (padded or cut to fit `min`/`max`), `user@example.com`, `https://example.com`, `2026-01-31`, the `min` (or 1) for numbers, `true`, for lists, `min` sample items (at least one if the field is `required`, otherwise none), a sample for nested models |
| `as list of Model` | a list with one sample model |
| `as list of T` (not a model) | `[]` |
| `as number` | `0` |
| any other `as` | `""` |

```cluub
service Classifier
  action kind(report: text) -> text
    return ask ai "Bug or feature? {report}" as one of ["bug", "feature"]

test "classification uses the first option in tests"
  expect Classifier.kind("It crashes") is "bug"
```

## AI errors

Every failure is an `AIError`: HTTP status **502**, code `ai`. In a page the message appears as a toast; in code you can `try` / `catch` it. The messages below reach the browser under `cluub dev`; under `cluub start` an api answers `The AI service is not available right now. Please try again.` and the full message goes to the server log (see [Runtime errors](/reference/runtime-errors#development-vs-production-messages)). `catch` in a service always sees the full message.

| Message | Cause |
|---|---|
| `Unknown AI provider "x". Use one of: claude, openai, gemini, ollama.` | Bad provider in `using`, `ai` or `CLUUB_AI`. |
| `No API key for openai. Run "cluub ai set openai" (or add OPENAI_API_KEY=... to .env). Never put keys in code.` | The chosen provider needs a key that is not set. |
| ``Could not reach Ollama at http://localhost:11434. Start it with `ollama serve`, or set CLUUB_AI=claude in .env.`` | Ollama request failed. The address is `OLLAMA_HOST` when set. |
| `Could not reach openai: <reason>` | Network failure or timeout for a hosted provider. |
| `openai returned 401: <detail>. Check that your API key is correct.` | Rejected key. |
| `openai returned 429: <detail>. You hit a rate limit; wait a moment and try again.` | Rate limit. |
| `openai returned <status>: <detail>.` | Any other error status. |
| `Claude declined this request: <explanation>` (or `Claude declined this request.`) | Claude refused. |
| `The AI answered "...", which is not one of: a, b.` | `as one of` could not match. |
| `The AI did not return valid Contact data: <reason>` | `as Type` failed twice. |

```cluub
service SafeSummaries
  action summarize(text: text) -> text
    try
      return ask ai "Summarize: {text}"
    catch problem
      log problem.message
      return "Summary unavailable"
```

## Edge cases & limits

* `as text` expects a JSON string (with quotes). Leave out `as` to get plain text.
* `as number` and `as bool` are parsed but not type-checked; `as list of text` items are not checked either.
* A spec is split at the first `:` only, so model names that contain colons work: `using "ollama:llama3.2:3b"` uses the model `llama3.2:3b`.
* No streaming, no conversation history, no tool use: each `ask ai` is one request and one reply.
* There is no per-call temperature or token setting.

## See also

* [AI guide](/guide/ai)
* [Types](/reference/types)
* [Runtime errors](/reference/runtime-errors)
* [Service reference](/reference/service)
