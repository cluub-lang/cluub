# Custom theme and styling

## Problem

The built-in theme is clean, but your app needs your brand: your colors, your corner radius, your logo, a highlighted "most popular" plan, and it should still look right in dark mode. You want to do that without fighting the framework or adding a CSS toolchain.

## Solution

Use three tools, from broadest to most specific:

1. **`theme.css` variables** at the project root change the whole app.
2. **`style primary | danger | ghost | muted`** picks a built-in look for one element.
3. **`class "..."`** adds your own CSS classes, including dynamic ones like `"plan-{plan.tier}"`.

**`theme.css`**

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap");

:root {
  --primary: #007A5C; --primary-text: #ffffff;
  --radius: 6px; --gap: 16px;
  --font: "Inter", ui-sans-serif, system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root { --primary: #009E73; --primary-text: #1E293B; }
}

header img { height: 28px; border-radius: 0; }
.plan { display: flex; flex-direction: column; gap: 8px; }
.plan-popular { border: 2px solid var(--primary); }
.price { font-size: 1.6rem; font-weight: 700; margin: 0; }
```

**`assets/logo.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#007A5C"/></svg>
```

**`ui/layouts/main.clb`**

```cluub
layout Main
  about "Brand header and footer for every page"
  view
    header
      image "/assets/logo.svg", alt "Acme logo"
      link "Acme" to "/"
      nav
        link "Pricing" to "/"
    slot
    footer
      text "© 2026 Acme"
```

**`ui/pages/pricing.clb`**

```cluub
page Pricing at "/"
  about "A pricing page showing theme variables, style words and classes"
  title "Pricing"
  layout Main
  state yearly = false
  state chosen = ""
  state plans = [{name: "Starter", monthly: 0, tier: "free"}, {name: "Team", monthly: 12, tier: "popular"}, {name: "Enterprise", monthly: 40, tier: "custom"}]

  action choose(name: text)
    chosen = name

  action contactSales()
    chosen = "a call with sales"

  view
    heading "Pricing"
    row
      checkbox yearly, label "Pay yearly"
      label "Pay yearly (2 months free)"
    grid
      for plan in plans
        card, class "plan plan-{plan.tier}"
          if plan.tier is "popular"
            badge "Most popular"
          subheading plan.name
          if yearly
            text "{plan.monthly * 10} EUR / year", class "price"
          else
            text "{plan.monthly} EUR / month", class "price"
          button "Choose {plan.name}", on click choose(plan.name), style primary
    if chosen is not empty
      text "You picked {chosen}. We'll be in touch.", style muted
    button "Talk to sales", on click contactSales, style ghost
```

## How it works

* **Variables restyle everything.** The built-in theme draws every element from a handful of CSS variables: `--bg`, `--surface`, `--text`, `--muted`, `--border`, `--primary`, `--primary-text`, `--danger`, `--success`, `--radius`, `--gap` and `--font`. Override them in `:root` and buttons, inputs, cards, badges, links and the focus ring all follow.
* **Your file loads last.** If `theme.css` exists at the project root, `cluub dev` and `cluub build` copy it to `/assets/theme.css` and link it *after* the built-in theme, so your rules win at equal specificity. `cluub dev` also reloads the page when you save it.
* **Dark mode.** The built-in theme switches its variables under `@media (prefers-color-scheme: dark)`. Override the same variables inside the same media query, as above, or your light brand color will be used on a dark background.
* **`style` is a fixed word.** `style primary` (filled brand button), `style danger` (red), `style ghost` (transparent, brand-colored text) and `style muted` (gray text) become CSS classes of the same name.
* **`class` takes any text, including interpolation.** `card, class "plan plan-{plan.tier}"` gives the element `card plan plan-popular`: the built-in `card` class is kept and yours are added. You can combine `style` and `class` on one element.
* **Static files go in `assets/`.** Everything in the project's `assets/` folder is served at `/assets/…`, so `image "/assets/logo.svg"` just works. Fonts can be loaded with `@import` at the top of `theme.css`.
* **Layouts carry the brand.** `layout Main` puts the logo and footer around every page that says `layout Main`; `slot` marks where the page goes.

## Test it

**`tests/pricing.test.clb`**

```cluub
test "the pricing page shows every plan"
  render Pricing
  expect screen has "Most popular"
  expect screen has "12 EUR / month"
  expect screen has "© 2026 Acme"

test "choosing a plan confirms it"
  render Pricing
  click "Choose Team"
  expect screen has "You picked Team"
```

Tests check text and behavior, not looks: CSS isn't loaded in tests. Check your theme by eye in `cluub dev`, in both light and dark mode.

## Variations and pitfalls

* **`style` can't be dynamic.** `style plan.tone` doesn't work, because `style` only accepts one of the four words. Use `class "{plan.tone}"` and define the classes in `theme.css`.
* **Classes the runtime uses** (`row`, `col`, `card`, `grid`, `badge`, `spinner`, `cluub-page`, `cluub-toast`, `cluub-crash`) can be restyled too, for example `.cluub-toast { background: #111; }`. Be careful: your change applies everywhere.
* **Inline `style="…"` attributes aren't available.** Everything goes through classes, which keeps styling in one file.
* **No CSS preprocessor or scoped styles.** It's plain CSS in one file; prefix classes by feature (`.plan-…`, `.bubble-…`) to avoid clashes.
* **The checkbox can't be clicked in tests** (tests type into inputs and click buttons and links), so the yearly price isn't covered above.

## See also

* [Pages & components: look and feel](/guide/frontend#look-and-feel)
* [Properties & events](/reference/properties-events) (`style`, `class`)
* [Layout reference](/reference/layout)
* [CLI: what `cluub build` produces](/reference/cli)
