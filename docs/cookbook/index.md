# Cookbook

The guide explains how Cluub works; the cookbook shows how to build specific things with it. Each recipe solves one everyday problem, such as a validated form, a paged list or an AI classifier, with a complete, working project you can copy.

Every recipe has the same parts:

* **Problem**: what you're trying to do, in one paragraph.
* **Solution**: the full code, split into files with their exact paths (`models/…`, `services/…`, `ui/pages/…`). The folders are the ones Cluub enforces, so you can drop the files into any project.
* **How it works**: the important lines, explained.
* **Test it**: a `tests/*.test.clb` file that passes with `cluub test`.
* **Variations and pitfalls**: common changes, and the things that trip people up, including current limits.
* **See also**: where to read more.

Each recipe was built as a real project (`cluub new … --template blank`, then the files shown) and passes `cluub check` with no errors and `cluub test`, including the tests Cluub generates.

## Recipes

### Data and pages

| Recipe | What you'll build |
|---|---|
| [Forms with validation](/cookbook/forms-validation) | A sign-up form with live hints, a disabled submit button, and server errors shown next to the right field |
| [CRUD list](/cookbook/crud-list) | A bookmark list with create, inline edit and delete |
| [Search and filtering](/cookbook/search-filter) | Server-side search with query parameters, plus instant filtering in the view |
| [Master–detail pages](/cookbook/master-detail) | A list that links to `/books/{id}`, with a spinner and a friendly "not found" |
| [Pagination in a service](/cookbook/pagination) | "Page 2 of 7" with Previous/Next, cut and clamped in the service |
| [Loading and empty states](/cookbook/loading-empty-states) | Spinner, load error with retry, empty state and busy buttons |
| [Persisting data to a JSON file](/cookbook/json-file-store) | A journal that survives restarts, and what happens when models change |

### Backend and integration

| Recipe | What you'll build |
|---|---|
| [Calling an external REST API](/cookbook/external-api) | A weather lookup with `client`, friendly `NetworkError` handling and testable JSON mapping |
| [Error-handling patterns](/cookbook/error-handling) | `require`, `fail … status`, `get` vs `find` and `try … catch problem`, each with its own status code |

### AI

| Recipe | What you'll build |
|---|---|
| [AI: summarizing text](/cookbook/ai-summarize) | Summaries in three styles with a system prompt and a history |
| [AI: structured extraction](/cookbook/ai-extraction) | Sales emails turned into validated `Lead` records with `as Lead` |
| [AI: classification](/cookbook/ai-classification) | Support tickets labeled with `as one of`, routed by code, and correctable by people |
| [A chat assistant](/cookbook/chat-assistant) | A bookshop assistant with a persona, a 10-message memory and starter questions |

### UI building blocks

| Recipe | What you'll build |
|---|---|
| [Reusable components](/cookbook/reusable-components) | A task board from nested components that call the page's actions |
| [Custom theme and styling](/cookbook/theming) | Brand colors, dark mode, a logo, `style` words and dynamic `class`es |

## Before you start

* Create a project with `cluub new my-app --template blank` and add the files from a recipe. Delete the template's `ui/pages/home.clb` if the recipe has its own page at `/`.
* Recipes that use AI run their tests **without a key**: in tests, `ask ai` returns `"AI reply to: …"`, `as one of` returns the first option, and `as Model` returns a valid sample. To use a real model, copy `.env.example` to `.env` and add a key (see [AI](/guide/ai)).
* Clients never reach the network in tests; they return `nothing`. The [external API recipe](/cookbook/external-api) shows how to test around that.
* Things Cluub doesn't have yet (auth and sessions, databases, file uploads, component state, debounce, streaming) are noted in the recipes where they matter, with the closest honest approach. See [Status & roadmap](/reference/roadmap).
