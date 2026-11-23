---
layout: home
hero:
  name: Cluub
  image:
    light: /logo-full.svg
    dark: /logo-full-dark.svg
    alt: "Cluub logo, a club made of three circles for frontend, backend and AI"
  text: One language for frontend, backend and AI
  tagline: Write features in plain English-like code. Cluub builds the UI, the API, the tests and the AI calls, with zero dependencies.
  actions:
    - theme: brand
      text: Try it in the browser
      link: /playground
    - theme: alt
      text: 10-minute tour
      link: /guide/tour
features:
  - icon: 🗣️
    title: Reads like a prompt
    details: "if title is empty, button \"Save\", ask ai \"Summarize {notes}\". Words instead of symbols, so beginners, product people and voice dictation all work."
  - icon: 🧱
    title: One structure, enforced
    details: Models, data, network, services, APIs and UI each have a folder and a layer. The compiler rejects shortcuts, so every project (and every AI) writes code the same way.
  - icon: 🤖
    title: AI is built in
    details: ask ai, structured output "as Contact", classification "as one of [...]". Claude, OpenAI, Gemini and local Ollama behind one line.
  - icon: ✅
    title: Tests write themselves
    details: Every model rule, business rule, API route, page and button gets a generated test. Frontend tests run against a real in-memory backend.
  - icon: 🎯
    title: Errors that teach
    details: Every error has a code, an exact location and a fix. "Did you mean heading?" "Pages talk to the backend only through an api."
  - icon: ⚡
    title: Tiny and fast
    details: No npm install for your app. A project compiles in a few milliseconds to plain JavaScript that runs in any browser and in Node.
---

## A full-stack feature in one screen

```cluub
model Todo
  title: text, required, max 80
  done: bool = false

store Todos holds Todo saved in "storage/todos.json"

service TodoService
  uses Todos
  action add(title: text) -> Todo
    require title.count >= 3, "Title must be at least 3 characters"
    return Todos.add(Todo(title: title))

api TodoApi at "/api/todos"
  uses TodoService
  post add at "/" with title: text
    return TodoService.add(title)

page Home at "/"
  uses TodoApi
  state draft = ""
  action save()
    TodoApi.add(title: draft)
    draft = ""
  view
    heading "My todos"
    input draft, placeholder "What needs doing?", on enter save
    button "Add", on click save, style primary
```

That is a validated data model, a JSON-file database, business rules, a typed REST endpoint and a reactive page. Run `cluub test` and Cluub writes and runs the tests for all of it.
