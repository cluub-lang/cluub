# Error codes

Run `cluub errors CODE` in a terminal for the same information.

| Code | Problem | How to fix |
|---|---|---|
| <span id="e001">**E001**</span> | Tabs used for indentation | Indent with 2 spaces. |
| <span id="e002">**E002**</span> | Indentation step is not 2 spaces | Indent each nested block by exactly 2 spaces. |
| <span id="e003">**E003**</span> | Indentation does not line up with an outer block | Line up the line with an outer block. |
| <span id="e004">**E004**</span> | Unterminated text | Close the text with ". Use triple quotes for multiple lines. |
| <span id="e005">**E005**</span> | Unexpected character | Remove the character. Text uses double quotes. |
| <span id="e006">**E006**</span> | Symbol operator used where Cluub uses a word | Use is, is not, and, or, not. |
| <span id="e010">**E010**</span> | Unexpected token / syntax error | Read the message: it says what was expected and what was found. |
| <span id="e011">**E011**</span> | Unknown top-level declaration | A file contains declarations: model, store, client, service, api, page, component, layout, test, app. |
| <span id="e012">**E012**</span> | Unknown member inside a declaration | Each declaration kind allows specific members; the hint lists them. |
| <span id="e013">**E013**</span> | Unknown view element | Use a known element, or a Capitalized component name. |
| <span id="e101">**E101**</span> | Duplicate declaration | Rename one of the declarations. |
| <span id="e102">**E102**</span> | Declaration name must be PascalCase | Rename to PascalCase. |
| <span id="e103">**E103**</span> | Field, action, state or parameter name must be camelCase | Rename to camelCase. |
| <span id="e104">**E104**</span> | Unknown dependency in `uses` | Fix the spelling, or declare the dependency. |
| <span id="e105">**E105**</span> | Unknown name | Fix the spelling, or create the value with let. |
| <span id="e106">**E106**</span> | Dependency used without `uses` | Add uses X to the declaration. |
| <span id="e107">**E107**</span> | Unknown action, route or store method | Use an existing action/route/method; the hint lists them. |
| <span id="e108">**E108**</span> | Wrong arguments in a call | Match the parameter names and count. |
| <span id="e109">**E109**</span> | Unknown model field | Use a field that exists on the model. |
| <span id="e110">**E110**</span> | Assignment to a name that was never created | Create it first with let (or state on a page). |
| <span id="e111">**E111**</span> | Name created twice in the same block | Use name = value to change an existing value. |
| <span id="e112">**E112**</span> | `input`/`checkbox` must be bound to state | Declare page state and bind the input to it. |
| <span id="e113">**E113**</span> | Event handler must be an action call | Events call actions: on click save or on click remove(item.id). |
| <span id="e114">**E114**</span> | Wrong component properties | Pass the properties the component takes. |
| <span id="e115">**E115**</span> | Duplicate route or action name | Rename the duplicate. |
| <span id="e116">**E116**</span> | Unknown layout | Declare the layout or fix its name. |
| <span id="e117">**E117**</span> | Api or action called while a view is drawn | Views only show data. Load it into `state` in `when loaded` or an action, then show the state. |
| <span id="e120">**E120**</span> | Test-only statement used outside a test | Move the statement into a test. |
| <span id="e201">**E201**</span> | Layer rule violated | Follow page → api → service → store/client. |
| <span id="e202">**E202**</span> | Circular dependency between services | Move shared logic into a third service. |
| <span id="e203">**E203**</span> | Components and layouts cannot use dependencies | Pass data to components with takes. |
| <span id="e204">**E204**</span> | AI called from the UI layer | Call AI from a service and expose it through an api. |
| <span id="e205">**E205**</span> | Environment secret read from the UI layer | Read env in a service; send only what the page needs. |
| <span id="e301">**E301**</span> | Declaration is in the wrong folder | Move the file to the folder for its kind. |
| <span id="e401">**E401**</span> | Hard-coded secret detected | Move the secret to .env and read env.NAME. |
| <span id="w101">**W101**</span> | Unused dependency | Remove the unused dependency. |
| <span id="w102">**W102**</span> | Action is too long (Single Responsibility) | Split the action into smaller ones. |
| <span id="w103">**W103**</span> | Service has too many actions (Single Responsibility / Interface Segregation) | Split the service by responsibility. |
| <span id="w104">**W104**</span> | Missing `about` description | Add an about line. |
| <span id="w105">**W105**</span> | State is never used | Remove the unused state or show it. |
| <span id="w106">**W106**</span> | Page has no view | Add a view block. |
| <span id="w107">**W107**</span> | Layout without exactly one slot | Put one `slot` where the page should appear. With none the page is hidden; with two it appears twice. |
| <span id="w108">**W108**</span> | Unknown app setting | Use one of `about`, `port`, `ai`, `aiModel`; other settings are ignored. |

Codes starting with **E** are errors (the build stops). **W** codes are warnings. Suggestions use W104.
