# AI: structured extraction with `as Model`

## Problem

You receive free text (sales emails, support requests, CVs) and need **data**: a name, an email address, a budget, a yes/no flag. Asking the AI for "JSON please" and parsing it yourself is fragile: fields go missing, numbers come back as words, emails are malformed. You want a real, validated object or a clear error.

## Solution

Describe the result as a **model** and write `ask ai "…" as Lead`. Cluub tells the AI the exact shape, parses the reply, validates it with the model's rules, and retries once if it doesn't fit.

**`models/lead.clb`**

```cluub
model Lead
  about "A potential customer, extracted from an email by AI"
  name: text, required
  email: email, required
  company: text?
  phone: text?
  interest: text = "other", one of ["buy", "support", "partnership", "other"]
  budget: number?, min 0
  urgent: bool = false
```

**`data/leads.clb`**

```cluub
store Leads holds Lead
  about "Leads extracted from incoming email"
```

**`services/lead-service.clb`**

```cluub
service LeadService
  about "Turns sales emails into leads with structured AI output"
  uses Leads

  action extract(emailText: text) -> Lead
    about "Read an email and save the sender as a lead (one lead per email address)"
    require emailText is not empty, "Paste an email first"
    require emailText.count <= 10000, "Emails can be at most 10000 characters"
    let lead = ask ai """
      Read this email and extract the sender as a sales lead.
      - interest: what they want (buy, support, partnership or other)
      - budget: a number in euros if they mention one, otherwise leave it out
      - urgent: true only if they ask for an answer within a few days
      Use only facts from the email. Leave out fields the email doesn't mention.

      Email:
      {emailText}
      """ as Lead
    let existing = Leads.where(l => l.email is lead.email)
    if existing is not empty
      return Leads.update(existing.first.id, lead)
    return Leads.add(lead)

  action all() -> list of Lead
    return Leads.all()

  action remove(id: text)
    Leads.remove(id)
```

**`api/lead-api.clb`**

```cluub
api LeadApi at "/api/leads"
  about "Lead inbox"
  uses LeadService

  get list at "/"
    return LeadService.all()

  post extract at "/" with emailText: text = ""
    return LeadService.extract(emailText)

  delete remove at "/{id}"
    LeadService.remove(id)
```

**`ui/pages/inbox.clb`**

```cluub
page Inbox at "/"
  about "Paste a sales email, get a lead"
  title "Lead inbox"
  uses LeadApi
  state emailText = ""
  state leads = []
  state reading = false

  when loaded
    leads = LeadApi.list()

  action extract()
    about "Send the email to the AI and refresh the list"
    reading = true
    try
      LeadApi.extract(emailText: emailText)
      emailText = ""
      leads = LeadApi.list()
    catch problem
      reading = false
      fail problem.message
    reading = false

  action remove(id: text)
    LeadApi.remove(id)
    leads = LeadApi.list()

  view
    heading "Lead inbox"
    input emailText, placeholder "Paste a sales email here", multiline
    row
      button "Extract lead", on click extract, style primary, disabled emailText is empty or reading
      if reading
        spinner
    for lead in leads
      card
        row
          subheading lead.name
          badge lead.interest
          if lead.urgent
            badge "urgent"
        text lead.email
        if lead.company is not empty
          text lead.company, style muted
        if lead.budget is not nothing
          text "Budget: {lead.budget} EUR"
        button "Remove", on click remove(lead.id), style ghost
    if leads is empty
      text "No leads yet."
```

## How it works

* **`as Lead` turns the AI into a typed function.** Cluub appends an instruction describing the JSON shape (`"name": text, "email": email, "interest": text (one of buy/support/partnership/other), …`) to your prompt, so you only describe the *meaning* of the fields.
* **The model's rules validate the reply.** A malformed email, an `interest` outside the list or a negative budget is rejected exactly like bad user input. If the first reply is invalid JSON or breaks a rule, Cluub asks once more and includes the error. If the second reply is also invalid you get an `AIError` (status 502), never a half-filled object.
* **Optional fields mean "not mentioned".** `company: text?`, `phone: text?` and `budget: number?` may be missing. Make a field required only when every input really contains it; otherwise the AI is pushed to invent a value, or the reply fails validation.
* **Defaults fill gaps.** If the reply leaves out `interest` or `urgent`, the model defaults (`"other"`, `false`) apply.
* **The result is a real `Lead`**, so it goes straight into the store. `Leads.where(l => l.email is lead.email)` finds an earlier lead from the same sender and `Leads.update(...)` refreshes it instead of creating a duplicate.
* **The page never sees the prompt.** It sends text to `LeadApi.extract` and reloads the list; the key and the prompt stay on the server.

## Test it

**`tests/leads.test.clb`**

```cluub
test "an email becomes a validated lead"
  let lead = LeadService.extract("Hi, I'm Ada from Analytical Engines. We'd like 20 licences, budget 5000 EUR.")
  expect lead.email is "user@example.com"
  expect lead.interest is "buy"
  expect LeadService.all().count is 1

test "the same sender is updated, not duplicated"
  LeadService.extract("First email from Ada")
  LeadService.extract("Second email from Ada")
  expect LeadService.all().count is 1

test "empty input never reaches the AI"
  expect LeadService.extract("") fails with "Paste an email first"

test "the page lists the extracted lead"
  render Inbox
  type "Hi, I'm Ada and I'd like a demo." into "Paste a sales email"
  click "Extract lead"
  expect screen has "user@example.com"
  click "Remove"
  expect screen has "No leads yet."
```

**What the fake AI returns.** In tests, `ask ai … as Lead` returns a valid **sample** built from the model: text fields become `"Sample name"`, `"Sample company"` and so on, emails become `user@example.com`, numbers their `min` (here `0`), bools `true`, and `one of` fields their first option (`"buy"`). The sample is the same for every prompt, which is why both emails in the second test count as the same sender. The tests check *your* logic (validation, de-duplication, the page); check extraction quality with a real key.

## Variations and pitfalls

* **Lists of things:** `as list of ActionItem` returns several validated items, for example every task mentioned in meeting notes. In tests it returns a list with one sample item, so write tests that work with one item, and use hand-made `ActionItem(...)` values for anything else.

```cluub
service NotesService
  action actionItems(notes: text) -> list of ActionItem
    about "Every task mentioned in the meeting notes"
    return ask ai "List every action item in these notes: {notes}" as list of ActionItem
```

* **Field names guide the AI.** `budget` plus "a number in euros" in the prompt works better than a vague `amount`.
* **Let people check the result.** For important data, return the extracted `Lead` without saving it, show it in editable inputs, and save only when the user confirms.
* **Don't trust extracted data with actions.** Extraction reads untrusted text. Validate it (the model does) and keep decisions such as sending emails or changing prices behind explicit user actions.
* **`as one of`** is the right tool when you only need a single label; see [AI: classification](/cookbook/ai-classification).

## See also

* [AI guide: structured output](/guide/ai#structured-output-as-model)
* [Model reference](/reference/model) and [types](/reference/types)
* [AI: summarizing text](/cookbook/ai-summarize)
* [Error handling patterns](/cookbook/error-handling)
