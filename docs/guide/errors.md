# Errors & suggestions

Every problem Cluub reports has:

1. a **code** (look it up with `cluub errors E201` or in the [error reference](/reference/errors)),
2. the **exact file, line and column**, with the code underlined,
3. a **plain-English message**, and
4. a **hint** that tells you how to fix it.

```text
error E105 ui/pages/shop.clb:14:12
  I don't know what "itme" is.
  13 |     for item in items
  14 |       text itme.name
     |            ^^^^
  hint: Did you mean "item"?
```

## Three levels

| Level | Meaning | Blocks the build? |
|---|---|---|
| **error** (`E…`) | the program is wrong or breaks the architecture | yes |
| **warning** (`W…`) | it works, but it will hurt later (unused dependency, oversized action) | no |
| **suggestion** | a habit that helps the team (add an `about` line) | no |

`cluub dev` and `cluub check` show all three every time you save, so you get suggestions **while you code**.

## Suggestions that teach good design

* **W102**: *Action "checkout" has 31 statements. Split it into smaller actions that each do one thing (Single Responsibility Principle).*
* **W103**: *OrderService has 11 actions. Large services are hard to test and change.*
* **W101**: *"Mailer" is listed in `uses` but never used.*
* **E401**: *This looks like a secret key written directly in the code. Put it in the .env file and read it with env.MY_KEY.*

## Runtime errors are precise too

| Situation | What the user / caller sees |
|---|---|
| Invalid input to an api | `400` *"total must be a number (got "abc")"* with the field name |
| `require` fails | `400` with your message |
| Missing item | `404` *"Order "17" was not found"* |
| AI without a key | `502` *"No API key for claude. Add ANTHROPIC_API_KEY=... to your .env file"* |
| Outside API down | `502` *"Weather.forecast failed: GET https://… returned 503"* |
| A bug in your code | `500` *"Something went wrong on the server."* to users; full details in the server log |

In the browser, these messages appear automatically as a toast. You don't write any error-handling code unless you want to (`try … catch`).
