# 10-minute tour

We'll build a tiny **feedback board**: people post feedback, AI tags it, the team marks items done. Follow along in the [playground](/playground) or a new project (`cluub new feedback --template blank`).

## 1. Describe the data (`models/feedback.clb`)

```cluub
model Feedback
  about "Something a customer told us"
  message: text, required, min 5, max 500
  kind: text = "question", one of ["bug", "feature", "question"]
  done: bool = false
```

The rules are enforced everywhere: in the API, in services and in tests. `Feedback(message: "hi")` fails with *"message must be at least 5 characters"*.

## 2. Store it (`data/feedback-store.clb`)

```cluub
store FeedbackStore holds Feedback saved in "storage/feedback.json"
```

## 3. Business logic + AI (`services/feedback-service.clb`)

```cluub
service FeedbackService
  about "Collects feedback and tags it with AI"
  uses FeedbackStore

  action post(message: text) -> Feedback
    about "Post new feedback"
    require message is not empty, "Please write something"
    let kind = ask ai "Classify this feedback: {message}" as one of ["bug", "feature", "question"]
    return FeedbackStore.add(Feedback(message: message, kind: kind))

  action all() -> list of Feedback
    return FeedbackStore.all()

  action finish(id: text) -> Feedback
    return FeedbackStore.update(id, {done: true})
```

`ask ai ... as one of [...]` always returns one of those three words, never free text.

## 4. Expose it (`api/feedback-api.clb`)

```cluub
api FeedbackApi at "/api/feedback"
  uses FeedbackService
  get list at "/"
    return FeedbackService.all()
  post create at "/" with message: text
    return FeedbackService.post(message)
  post finish at "/{id}/finish"
    return FeedbackService.finish(id)
```

## 5. The page (`ui/pages/board.clb`)

```cluub
page Board at "/"
  about "The feedback board"
  uses FeedbackApi
  state draft = ""
  state items = []

  when loaded
    items = FeedbackApi.list()

  action send()
    FeedbackApi.create(message: draft)
    draft = ""
    items = FeedbackApi.list()

  action finish(id: text)
    FeedbackApi.finish(id)
    items = FeedbackApi.list()

  view
    heading "Feedback"
    row
      input draft, placeholder "Tell us anything", on enter send
      button "Send", on click send, style primary
    for item in items
      card
        badge item.kind
        text item.message
        if not item.done
          button "Mark done", on click finish(item.id), style ghost
```

Notice what you **didn't** write: no `await`, no `fetch`, no loading/error plumbing, no re-render code. If the server rejects the input, the page shows the message automatically.

## 6. Test it

```bash
cluub test
```

Cluub writes tests for every rule above (too-short message, invalid kind, missing `message` in the API, the page rendering, the Send button) and runs them with a fake AI and a fresh database. Add your own in `tests/`:

```cluub
test "posting feedback tags it"
  let f = FeedbackService.post("The export button crashes")
  expect f.kind is one of ["bug", "feature", "question"]
```

## 7. Share it with the team

```bash
cluub explain --for po   # what users can do
cluub explain --for qa   # what's tested, edge cases to try
```

That's the whole language for most apps. Next: [Project structure & layers](/guide/structure).
