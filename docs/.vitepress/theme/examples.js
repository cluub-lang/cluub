// Playground examples. In the playground everything lives in one file; in a
// real project each declaration goes in its own folder (see "Project structure").
export const examples = {
  'Hello counter': `# The smallest useful Cluub app: state, actions and a view.
page Home at "/"
  state count = 0
  state name = ""

  action add()
    count = count + 1

  action reset()
    count = 0

  view
    if name is empty
      heading "Hello!"
    else
      heading "Hello {name}!"
    input name, placeholder "Your name"
    row
      button "Clicked {count} times", on click add, style primary
      button "Reset", on click reset, style ghost
    if count is at least 5
      text "You really like clicking."
`,

  'Todo app (full stack)': `app TodoApp
  about "Todos with validation, an API and tests"

model Todo
  about "Something to get done"
  title: text, required "Please type a title", max 80
  done: bool = false
  priority: text = "normal", one of ["low", "normal", "high"]

store Todos holds Todo

service TodoService
  about "Business rules for todos"
  uses Todos

  action list() -> list of Todo
    return Todos.all().sortBy(t => t.done)

  action add(title: text, priority: text = "normal") -> Todo
    require title is not empty, "Title is required"
    require title.count >= 3, "Title must be at least 3 characters"
    return Todos.add(Todo(title: title, priority: priority))

  action toggle(id: text) -> Todo
    let todo = Todos.get(id)
    return Todos.update(id, {done: not todo.done})

api TodoApi at "/api/todos"
  about "Todo endpoints"
  uses TodoService
  get list at "/"
    return TodoService.list()
  post add at "/" with title: text, priority: text = "normal"
    return TodoService.add(title, priority)
  post toggle at "/{id}/toggle"
    return TodoService.toggle(id)

component TodoItem
  takes todo: Todo, onToggle: action
  view
    card
      row
        checkbox todo.done, on change onToggle(todo.id)
        text todo.title
        badge todo.priority

page Home at "/"
  about "The todo list"
  uses TodoApi
  state draft = ""
  state priority = "normal"
  state todos = []

  when loaded
    todos = TodoApi.list()

  action addTodo()
    TodoApi.add(title: draft, priority: priority)
    draft = ""
    todos = TodoApi.list()

  action toggle(id: text)
    TodoApi.toggle(id)
    todos = TodoApi.list()

  view
    heading "My todos"
    row
      input draft, placeholder "What needs doing?", on enter addTodo
      select priority, options ["low", "normal", "high"]
      button "Add", on click addTodo, style primary
    for todo in todos
      TodoItem todo: todo, onToggle: toggle
    if todos is empty
      text "Nothing yet. Try adding \\"ab\\" to see validation."

test "a user can add a todo"
  render Home
  type "Buy milk" into "What needs doing?"
  click "Add"
  expect screen has "Buy milk"
`,

  'AI assistant': `# In the playground the AI is simulated. In a real project
# set ANTHROPIC_API_KEY (or OpenAI, Gemini, Ollama) in .env.
model Idea
  title: text, required
  pitch: text
  audience: text

service IdeaService
  about "Turns a topic into a product idea with AI"

  action brainstorm(topic: text) -> Idea
    require topic is not empty, "Give me a topic first"
    return ask ai "Invent a product idea about {topic}" as Idea

  action category(text: text) -> text
    return ask ai "Classify: {text}" as one of ["bug", "feature", "question"]

api IdeaApi at "/api/ideas"
  uses IdeaService
  post brainstorm at "/" with topic: text
    return IdeaService.brainstorm(topic)

page Home at "/"
  uses IdeaApi
  state topic = ""
  state idea = nothing

  action go()
    idea = IdeaApi.brainstorm(topic: topic)

  view
    heading "Idea machine"
    row
      input topic, placeholder "A topic, e.g. gardening", on enter go
      button "Brainstorm", on click go, style primary
    if idea is not nothing
      card
        subheading idea.title
        text idea.pitch
        badge idea.audience
`,

  'See an error': `# This example has 3 DELIBERATE mistakes, so you can see how Cluub
# explains problems. Open the Problems tab, click an error to jump
# to its line, and fix it using the hint:
#   1. "heding" is misspelled on purpose (it should be "heading")
#   2. The page reads the store directly (pages must go through an api)
#   3. "itme" is misspelled on purpose (it should be "item")
model Product
  name: text, required
  price: number, min 0

store Products holds Product

page Shop at "/"
  state items = []

  when loaded
    items = Products.all()

  view
    heding "Shop"
    for item in items
      text itme.name
`,
};
