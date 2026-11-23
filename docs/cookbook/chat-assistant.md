# A chat assistant

## Problem

You want a chat box where people talk to an assistant with a clear personality and limits ("you help customers of our bookshop, you never invent order numbers"). It should remember the conversation, but not send the entire history with every message, which gets slow and expensive. Starter questions help people begin, and a failed AI call must not leave half a conversation behind.

## Solution

A service keeps the messages, sends the **system prompt** plus the **last 10 messages** to the AI, and saves the user's message and the reply only after the AI has answered. A small component draws each bubble.

**`app.clb`**

```cluub
app Bookshop
  about "A bookshop with an AI assistant"
  port 3000
  ai "claude"
```

**`models/message.clb`**

```cluub
model Message
  about "One message in the conversation"
  role: text, one of ["user", "assistant"]
  content: text, required
  sentAt: text = now()
```

**`data/messages.clb`**

```cluub
store Messages holds Message
  about "The conversation, kept in memory"
```

**`services/chat-service.clb`**

```cluub
service ChatService
  about "Pip, the bookshop assistant, with a short memory"
  uses Messages

  action history() -> list of Message
    return Messages.all()

  action send(text: text) -> list of Message
    about "Send a message and get Pip's reply"
    require text is not empty, "Type a message first"
    require text.count <= 2000, "Messages can be at most 2000 characters"
    let earlier = Messages.all()
    let transcript = ""
    let index = 0
    for message in earlier
      if index >= earlier.count - 10
        transcript = transcript + "{message.role}: {message.content}\n"
      index = index + 1
    let reply = ask ai """
      Conversation so far (most recent last):
      {transcript}
      user: {text}
      assistant:
      """ with system """
      You are Pip, the friendly assistant of a small online bookshop.
      Answer in at most 80 words. If you don't know something, say so and
      suggest emailing help@example.com. Never invent order numbers, prices
      or delivery dates.
      """
    Messages.add(Message(role: "user", content: text))
    Messages.add(Message(role: "assistant", content: reply.trim()))
    return Messages.all()

  action clear()
    about "Start a new conversation"
    Messages.clear()
```

**`api/chat-api.clb`**

```cluub
api ChatApi at "/api/chat"
  about "Chat with Pip"
  uses ChatService

  get history at "/"
    return ChatService.history()

  post send at "/" with text: text = ""
    return ChatService.send(text)

  delete clear at "/"
    ChatService.clear()
```

**`ui/components/bubble.clb`**

```cluub
component Bubble
  about "One chat message, styled by who sent it"
  takes message: Message
  view
    box, class "bubble {message.role}"
      text message.content
```

**`ui/pages/chat.clb`**

```cluub
page Chat at "/"
  about "Talk to Pip, the bookshop assistant"
  title "Ask Pip"
  uses ChatApi
  state draft = ""
  state messages = []
  state thinking = false

  when loaded
    messages = ChatApi.history()

  action send()
    about "Send the typed message"
    let text = draft
    draft = ""
    thinking = true
    try
      messages = ChatApi.send(text: text)
    catch problem
      draft = text
      thinking = false
      fail problem.message
    thinking = false

  action ask(question: text)
    about "Send a starter question"
    draft = question
    send()

  action clear()
    ChatApi.clear()
    messages = []

  view
    heading "Ask Pip"
    if messages is empty
      text "Ask about books, orders or delivery. Or start with:"
      row
        button "Do you ship abroad?", on click ask("Do you ship abroad?"), style ghost
        button "Recommend a sci-fi book", on click ask("Recommend a sci-fi book"), style ghost
    for message in messages
      Bubble message: message
    if thinking
      spinner
    row
      input draft, placeholder "Type a message", on enter send
      button "Send", on click send, style primary, disabled draft is empty or thinking
      button "New chat", on click clear, style ghost
```

**`theme.css`**

```css
.bubble { padding: 10px 14px; border-radius: var(--radius); margin-bottom: 8px; max-width: 80%; white-space: pre-line; }
.bubble p { margin: 0; }
.bubble.user { margin-left: auto; background: var(--primary); color: var(--primary-text); }
.bubble.assistant { background: var(--surface); border: 1px solid var(--border); }
```

## How it works

* **`with system """..."""`** sets the assistant's role and rules once, separately from the conversation. Put tone, length limits and hard "never" rules there.
* **A sliding window.** The loop keeps only messages whose position is in the last 10 (`index >= earlier.count - 10`) and writes them as `role: content` lines. Older messages are still stored and shown; they just aren't sent. That keeps each request small and predictable.
* **`\n` inside text** is a newline, so the transcript is one message per line.
* **Save after the AI answers.** Both messages are added only after `ask ai` returned. If the call fails (no key, provider down: a 502 `AIError`, shown to users in production as *"The AI service is not available right now"*), nothing is saved and the conversation stays consistent.
* **The page restores the draft on failure.** It clears the input immediately so the UI feels fast, puts the text back in `catch problem`, and re-raises with `fail problem.message` to show the toast.
* **Actions can call actions.** `ask(question)` fills `draft` and calls `send()`, so starter buttons reuse the exact same path.
* **The bubble is a component.** `class "bubble {message.role}"` gives `bubble user` or `bubble assistant`, and three CSS rules do the rest. Components have no state, so the page keeps the messages.

## Test it

**`tests/chat.test.clb`**

```cluub
test "a message gets a reply and both are saved"
  let messages = ChatService.send("Do you have Dune in stock?")
  expect messages.count is 2
  expect messages.last.role is "assistant"
  expect messages.last.content has "AI reply to"

test "only the last 10 messages are sent to the AI"
  let n = 1
  while n <= 12
    Messages.add(Message(role: "user", content: "Message {n}"))
    n = n + 1
  let messages = ChatService.send("Hi")
  expect messages.last.content has "user: Message 3"
  expect not (messages.last.content has "Message 2")

test "a failed send leaves no half conversation"
  expect ChatService.send("") fails with "Type a message first"
  expect ChatService.history() is empty

test "a starter question can be sent with one click"
  render Chat
  click "Do you ship abroad?"
  expect screen has "Do you ship abroad?"
  expect screen has "AI reply to"
  click "New chat"
  expect screen has "Or start with"
```

**Why the window test works.** The fake AI answers `"AI reply to: "` plus the first 60 characters of the prompt. With 12 earlier messages, the prompt's first line after the header is `user: Message 3`, so the reply contains it, and `Message 2` (outside the window) never appears. The fake can't tell you whether Pip *follows* the system prompt; try a few conversations with a real key before you ship.

## Variations and pitfalls

* **One shared conversation.** This store holds a single conversation for everyone using the app. Cluub has no sessions or login yet, so per-user chats need a conversation id that the page keeps (for example `page Chat at "/chat/{conversationId}"`) and a `conversationId` field on `Message` to filter by. Anyone with the URL can read that chat.
* **Memory resets on restart.** Add `saved in "storage/messages.json"` to keep chats; see [Persisting data to a JSON file](/cookbook/json-file-store).
* **No streaming yet.** The reply appears when it's complete; the spinner covers the wait.
* **Give Pip facts, not hopes.** To answer "where is my order?", look the order up in a service and put the facts into the prompt. Letting the AI call your services itself (agents and tools) is on the [roadmap](/reference/roadmap).
* **Keep the window small.** Ten messages is a good default. For long chats, ask the AI for a short summary of older messages and send that instead of the full text.

## See also

* [AI guide](/guide/ai)
* [Reusable components](/cookbook/reusable-components)
* [Custom theme and styling](/cookbook/theming)
* The `ai-chat` template: `cluub new my-chat --template ai-chat` ([install guide](/guide/install))
