# Forms with validation

## Problem

You need a sign-up form that feels finished: hints appear next to a field while the user types, the submit button stays disabled until the form makes sense, and when the server rejects something ("that email is already on the list") the message appears **next to the right field** instead of a generic toast. The rules must also hold for anyone who calls the API directly.

## Solution

Put the rules in the **model** and the **service** (they run on the server, every time), and let the page add quick hints on top.

**`models/signup.clb`**

```cluub
model Signup
  about "Someone joining the beta waitlist"
  name: text, required "Please tell us your name", min 2, max 80
  email: email, required "We need an email to reach you"
  company: text?, max 100
  plan: text = "starter", one of ["starter", "team", "enterprise"]
```

**`data/signups.clb`**

```cluub
store Signups holds Signup
  about "Everyone on the waitlist"
```

**`services/signup-service.clb`**

```cluub
service SignupService
  about "Rules for joining the waitlist"
  uses Signups

  action join(name: text, email: text, company: text = "", plan: text = "starter") -> Signup
    about "Add someone to the waitlist, once per email"
    require name is not empty, "Please tell us your name"
    let address = email.trim().lower()
    let taken = Signups.where(s => s.email is address)
    if taken is not empty
      fail "{address} is already on the list" status 409
    return Signups.add(Signup(name: name, email: address, company: company, plan: plan))
```

**`api/signup-api.clb`**

```cluub
api SignupApi at "/api/signups"
  about "Waitlist endpoints"
  uses SignupService

  post join at "/" with name: text = "", email: text = "", company: text = "", plan: text = "starter"
    return SignupService.join(name, email, company, plan)
```

**`ui/pages/join.clb`**

```cluub
page Join at "/"
  about "Waitlist sign-up form with field errors and server messages"
  title "Join the beta"
  uses SignupApi
  state name = ""
  state email = ""
  state company = ""
  state plan = "starter"
  state nameError = ""
  state emailError = ""
  state formError = ""
  state notice = ""
  state saving = false

  action submit()
    about "Send the form and put any error next to its field"
    nameError = ""
    emailError = ""
    formError = ""
    saving = true
    try
      let signup = SignupApi.join(name: name, email: email, company: company, plan: plan)
      notice = "You're on the list, {signup.name}! We'll write to {signup.email}."
      name = ""
      email = ""
      company = ""
    catch problem
      if problem.field is "name"
        nameError = problem.message
      else if problem.field is "email"
        emailError = problem.message
      else
        formError = problem.message
    saving = false

  view
    heading "Join the beta"
    if notice is not empty
      card, class "notice"
        text notice
    form
      label "Name"
      input name, placeholder "Ada Lovelace"
      if nameError is not empty
        text nameError, class "field-error"
      else if name is not empty and name.count < 2
        text "Name must be at least 2 characters", class "field-error"
      label "Email"
      input email, placeholder "you@example.com", type "email"
      if emailError is not empty
        text emailError, class "field-error"
      label "Company (optional)"
      input company, placeholder "Analytical Engines Ltd"
      label "Plan"
      select plan, options ["starter", "team", "enterprise"], label "Plan"
      if formError is not empty
        text formError, class "field-error"
      button "Join the waitlist", on click submit, style primary, disabled saving or name is empty or email is empty
```

**`theme.css`**

```css
form { display: flex; flex-direction: column; gap: 6px; max-width: 420px; }
form label { font-weight: 600; margin-top: 8px; }
.field-error { color: var(--danger); font-size: 0.9rem; margin: 0; }
.notice { border-color: var(--success); }
```

## How it works

* **The model is the single source of truth.** `required "Please tell us your name"` replaces the default message; `min 2` produces *"name must be at least 2 characters"*. These rules run whenever a `Signup` is created, no matter who calls the service.
* **`require name is not empty, ...`** stops the action with a 400 before any work happens. Business rules that need data (an email that's already taken) use `fail "..." status 409`.
* **API parameters have defaults** (`name: text = ""`). Without a default, an empty field is rejected by the API layer with *Missing required value "name"* before your friendly service message runs. With a default, the empty value reaches `require` and the model.
* **`problem.field`.** A model rule failure tells the caller which field broke. The API returns it as `error.field`, and in the page `catch problem` gives you `problem.field` and `problem.message`. The page puts the message in `nameError` or `emailError`; anything without a field (the 409) goes to `formError`.
* **Catching in the page replaces the toast.** If you don't catch, Cluub shows the server message as a toast automatically. Here we catch so the message sits next to the field.
* **Accessible names.** The visible `label "Name"` lines are just text. Screen readers name each input by its `placeholder`, and `label "Plan"` on the `select` (the `label` *property*, after a comma) gives it an explicit name.
* **Live hints are plain view logic.** `else if name is not empty and name.count < 2` re-evaluates on every keystroke because the view redraws whenever state changes. It's only a hint. The server still checks.
* **`disabled saving or name is empty or email is empty`** keeps the button off while required fields are blank and while a request is in flight.

## Test it

**`tests/signup.test.clb`**

```cluub
test "a valid sign-up joins the list with a clean email"
  let signup = SignupService.join("Ada Lovelace", " ADA@example.com ")
  expect signup.email is "ada@example.com"
  expect signup.plan is "starter"

test "the same email can't join twice"
  SignupService.join("Ada Lovelace", "ada@example.com")
  expect SignupService.join("Ada L", "ada@example.com") fails with "already on the list"

test "the model checks every field"
  expect SignupService.join("A", "ada@example.com") fails with "at least 2 characters"
  expect SignupService.join("Ada", "not-an-email") fails with "valid email"

test "the api names the field that is wrong"
  let response = request post "/api/signups" with {name: "Ada", email: "nope"}
  expect response.status is 400
  expect response.body.error.field is "email"

test "the page shows the server error next to the field"
  render Join
  type "Ada" into "Ada Lovelace"
  type "nope" into "you@example.com"
  click "Join the waitlist"
  expect screen has "email must be a valid email address"

test "the page confirms a successful sign-up"
  render Join
  type "Ada" into "Ada Lovelace"
  type "ada@example.com" into "you@example.com"
  click "Join the waitlist"
  expect screen has "You're on the list, Ada!"
```

`cluub test` also generates tests for every model rule (`name` too short, `email` invalid, `plan` not allowed), for the `require`, and a test that types *"Sample text"* into each input and clicks **Join the waitlist**.

## Variations and pitfalls

* **Keep `disabled` simple.** "Is empty" and "is saving" are easy to understand. Don't repeat format rules there (`disabled not (email has "@")`): a button that stays grey without saying why is worse than a clear message from the model.
* **Pressing Enter.** Buttons are `type="button"` by default, so this form doesn't submit on Enter. To get real form behavior, write `form, on submit submit` and give the button `type "submit"` instead of `on click submit`; Enter in any field and a click on the button (also in tests) then run `submit`.
* **Old errors stay visible** until the next submit, because `nameError` is only cleared in `submit`. To clear a message as the user types, show the live hint first and the server error only while the field is unchanged.
* **Don't repeat every rule in the page.** Hints are for comfort; the model and service are what protect your data.

## See also

* [Models & data](/guide/data) and the [model reference](/reference/model)
* [Error handling patterns](/cookbook/error-handling)
* [Pages & components](/guide/frontend), [view elements](/reference/view-elements), [properties & events](/reference/properties-events)
* [Automatic tests](/guide/testing)
