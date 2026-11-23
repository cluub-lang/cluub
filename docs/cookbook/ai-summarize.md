# AI: summarizing text

## Problem

People paste long things (articles, email threads, meeting notes) and want the gist. You want a summary in a chosen style (a short paragraph, bullet points, or one tweet-sized line), a history of earlier summaries, and no API key anywhere near the browser. You also want tests that run offline and for free.

## Solution

A service builds the prompt and calls `ask ai`; the page only sends the text and shows the result.

**`app.clb`**

```cluub
app Summarizer
  about "Paste text, get a summary"
  port 3000
  ai "claude"
```

**`models/summary.clb`**

```cluub
model Summary
  about "A text and its AI summary"
  source: text, required, max 20000
  summary: text, required
  format: text = "short", one of ["short", "bullets", "tweet"]
  createdAt: text = now()
```

**`data/summaries.clb`**

```cluub
store Summaries holds Summary
  about "Every summary made so far"
```

**`services/summary-service.clb`**

```cluub
service SummaryService
  about "Summarizes long text with AI and keeps a history"
  uses Summaries

  action summarize(source: text, format: text = "short") -> Summary
    about "Summarize a text in the chosen format"
    require source is not empty, "Paste some text to summarize"
    require source.count <= 20000, "Text can be at most 20000 characters"
    require format is one of ["short", "bullets", "tweet"], "Pick short, bullets or tweet"
    let summary = source
    if source.count >= 200
      summary = ask ai """
        Summarize the text below {instructionsFor(format)}.
        Keep names, numbers and dates exactly as written. Do not add facts.

        Text:
        {source}
        """ with system "You are a careful editor who writes plain, neutral summaries."
    return Summaries.add(Summary(source: source, summary: summary.trim(), format: format))

  action instructionsFor(format: text) -> text
    about "How long and in what shape the summary should be"
    if format is "bullets"
      return "as three to five bullet points, each starting with -"
    if format is "tweet"
      return "in one sentence under 280 characters"
    return "in two or three sentences"

  action history() -> list of Summary
    return Summaries.all()
```

**`api/summary-api.clb`**

```cluub
api SummaryApi at "/api/summaries"
  about "Summaries"
  uses SummaryService

  get history at "/"
    return SummaryService.history()

  post summarize at "/" with source: text = "", format: text = "short"
    return SummaryService.summarize(source, format)
```

**`ui/pages/summarizer.clb`**

```cluub
page Summarizer at "/"
  about "Paste text, pick a format, get a summary"
  title "Summarize"
  uses SummaryApi
  state source = ""
  state format = "short"
  state result = nothing
  state working = false
  state history = []

  when loaded
    history = SummaryApi.history()

  action summarize()
    about "Ask the server for a summary"
    working = true
    try
      result = SummaryApi.summarize(source: source, format: format)
      history = SummaryApi.history()
    catch problem
      working = false
      fail problem.message
    working = false

  view
    heading "Summarize"
    input source, placeholder "Paste an article, email or meeting notes", multiline
    row
      select format, options ["short", "bullets", "tweet"], label "Summary style"
      text "{source.count} characters", style muted
      button "Summarize", on click summarize, style primary, disabled source is empty or working
    if working
      spinner
    if result is not nothing
      card
        subheading "Summary"
        text result.summary, class "summary"
    if history is not empty
      subheading "Earlier"
      for item in history
        card
          badge item.format
          text item.summary, class "summary"
```

**`theme.css`**

```css
.summary { white-space: pre-line; }
```

## How it works

* **`ask ai` is one expression.** It returns the model's reply as text. It's only allowed in services, apis and clients, so keys stay on the server (putting it in a page is error E204). The provider comes from `ai "claude"` in `app.clb` and the key from `ANTHROPIC_API_KEY` in `.env`.
* **Triple-quoted prompts** span lines and interpolate values: `{source}` and even `{instructionsFor(format)}`, a call to another action of the same service.
* **`with system "..."`** sets the system prompt: who the AI should be. The user prompt says what to do with this particular text.
* **Guard the input before paying for a call.** `require` lines reject empty and oversized text with a 400. Texts under 200 characters are returned unchanged: summarizing a sentence costs money and adds nothing.
* **`summary.trim()`** removes stray whitespace models sometimes add. The result is saved with `Summaries.add`, so the history survives page reloads (until the server restarts; see the variations).
* **The page shows progress.** `working` drives the `spinner` and disables the button. If the AI call fails (no key, rate limit, provider down), the server logs the reason and answers 502: with `cluub dev` the message says what's wrong (*No API key for claude…*); in production users see *"The AI service is not available right now. Please try again."* The page resets `working` and re-raises the problem with `fail problem.message`, which shows the toast.
* **`class "summary"`** plus one CSS line keeps the line breaks of bullet-point answers, which would otherwise collapse into one paragraph.

## Test it

**`tests/summary.test.clb`**

```cluub
test "long text is summarized by the AI"
  let text = ""
  while text.count < 300
    text = text + "Cluub compiles plain English into a full-stack web app. "
  let result = SummaryService.summarize(text)
  expect result.summary has "AI reply to: Summarize the text below in two"
  expect SummaryService.history().count is 1

test "the format changes the instructions"
  let text = ""
  while text.count < 300
    text = text + "The team agreed to ship on Friday after the review. "
  let bullets = SummaryService.summarize(text, "bullets")
  expect bullets.summary has "bullet points"

test "short text is returned as is, without calling the AI"
  let result = SummaryService.summarize("Ship on Friday.")
  expect result.summary is "Ship on Friday."

test "unknown styles are rejected"
  expect SummaryService.summarize("Ship on Friday.", "poem") fails with "Pick short, bullets or tweet"

test "the page shows the summary"
  let text = ""
  while text.count < 300
    text = text + "Cluub compiles plain English into a full-stack web app. "
  render Summarizer
  type text into "Paste an article"
  click "Summarize"
  expect screen has "AI reply to"
```

**How the fake AI behaves.** Tests never call a real model. A plain `ask ai` returns `"AI reply to: "` followed by the first 60 characters of the prompt, so you can check that the right prompt was built ("bullet points" only appears when the format is `bullets`). It does **not** judge summary quality: check that with a real key, by hand, before you ship.

## Variations and pitfalls

* **Choose a provider per call:** `ask ai "…" using "ollama:llama3.2"` keeps private text on your machine; `using "openai"` uses `OPENAI_API_KEY`.
* **Summaries vanish on restart** because the store is in memory. Add `saved in "storage/summaries.json"`; see [Persisting data to a JSON file](/cookbook/json-file-store).
* **Very long documents.** Models have input limits, and 20,000 characters is a conservative cap. For longer texts, split them into parts with a loop, summarize each part, then summarize the summaries.
* **No streaming yet.** The reply arrives all at once; the spinner covers the wait. Streaming replies are on the [roadmap](/reference/roadmap).
* **Prompt injection.** Pasted text can contain instructions ("ignore the above…"). Keep the system prompt firm, don't give the summarizer any power beyond producing text, and show the result as text (Cluub never renders it as HTML).

## See also

* [AI guide](/guide/ai)
* [AI: structured extraction](/cookbook/ai-extraction) and [AI: classification](/cookbook/ai-classification)
* [Loading and empty states](/cookbook/loading-empty-states)
* [App reference](/reference/app) (choosing the provider)
