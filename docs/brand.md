<script setup>
import { withBase } from 'vitepress'
</script>

# Brand & logo

Cluub *clubs together* the frontend, the backend and AI. The logo hides a little joke in the name: the **uu** of cluub becomes the cat's happy, closed **eyes**, drawn as two big white letters, so the logo reads *cl*, then a cat, then *b*, and the cat *is* the double u. The cat is friendly, curious and quick, which is how Cluub should feel to use.

## Logo files

All files are plain SVG in the repository's `docs/public/` folder and are served from this site.

<div class="brand-logos">
  <figure class="on-light"><img :src="withBase('/logo-full.svg')" alt="Cluub logo: the letters c and l, a cat face whose eyes are the uu, and the letter b, for light backgrounds"><figcaption><code>/logo-full.svg</code> · light backgrounds</figcaption></figure>
  <figure class="on-dark"><img :src="withBase('/logo-full-dark.svg')" alt="Cluub logo with light letters, for dark backgrounds"><figcaption><code>/logo-full-dark.svg</code> · dark backgrounds</figcaption></figure>
  <figure class="on-light"><img :src="withBase('/logo.svg')" alt="Cluub cat icon"><figcaption><code>/logo.svg</code> · icon</figcaption></figure>
  <figure class="on-dark"><img :src="withBase('/logo-dark.svg')" alt="Cluub cat icon on a dark background"><figcaption><code>/logo-dark.svg</code> · icon on dark</figcaption></figure>
  <figure class="on-light"><img :src="withBase('/wordmark.svg')" alt="Cluub wordmark without the cat"><figcaption><code>/wordmark.svg</code> · plain wordmark</figcaption></figure>
  <figure class="on-light"><img :src="withBase('/favicon.svg')" alt="Cluub favicon"><figcaption><code>/favicon.svg</code> · favicon</figcaption></figure>
</div>

The letters are drawn with simple strokes (no font), so the logo looks identical everywhere and needs no font licence. The cat icon works on light and dark backgrounds alike; use `/wordmark.svg` where a playful mark doesn't fit (for example in plain-text contexts).

### Anatomy of the cat

| Part | Colour | Why |
|---|---|---|
| Face and ears | Blue `#0072B2`, inner ears sky `#56B4E9` | The brand colour; 5.2 : 1 against white |
| Eyes **uu** | White | The **uu** of cluub, as happy closed eyes; 5.2 : 1 on the blue face |
| Nose | Orange `#E69F00` | Warm accent from the palette |
| Mouth | White | A small smile |
| Whiskers | Orange `#E69F00` | Accent; 7.6 : 1 on dark backgrounds |

## Colours

Cluub uses the **Okabe–Ito palette**, a set of colours designed to stay distinguishable for people with colour-vision deficiency.

<div class="brand-swatches">
  <div style="background:#0072B2;color:#fff"><b>Blue #0072B2</b><br>Brand colour, cat face</div>
  <div style="background:#E69F00;color:#1E293B"><b>Orange #E69F00</b><br>Nose, whiskers</div>
  <div style="background:#009E73;color:#fff"><b>Green #009E73</b><br>Accents</div>
  <div style="background:#1E293B;color:#fff"><b>Ink #1E293B</b><br>Letters, text</div>
  <div style="background:#56B4E9;color:#0B1220"><b>Sky #56B4E9</b><br>Brand colour on dark</div>
  <div style="background:#CC79A7;color:#1E293B"><b>Reddish purple #CC79A7</b><br>AI in diagrams</div>
  <div style="background:#A84B00;color:#fff"><b>Deep vermillion #A84B00</b><br>Errors (shade of #D55E00)</div>
</div>

The same palette is used everywhere: the logo, this site, the diagrams, the playground and the default theme of every Cluub app. Text on a coloured background is white on blue and deep vermillion, and ink `#1E293B` on sky, green, orange and reddish purple, all at 4.3 : 1 or more.

| Token | Hex | Used for | Contrast (measured) |
|---|---|---|---|
| Blue | `#0072B2` | Cat face, links and buttons on light backgrounds | 5.2 : 1 on white; 3.3 : 1 on `#1B1B1F` |
| Orange | `#E69F00` | Nose, whiskers | 7.6 : 1 on `#1B1B1F`; decorative on white |
| Green | `#009E73` | Accents in the docs | Decorative |
| Ink | `#1E293B` | Letters, body text | 14.6 : 1 on white |
| Sky | `#56B4E9` | Links and buttons on dark backgrounds | 7.4 : 1 on `#1B1B1F` |
| Reddish purple | `#CC79A7` | AI in diagrams | Ink text on it: 4.8 : 1 |
| Deep vermillion | `#A84B00` | Error messages and toasts (a darker shade of Okabe–Ito vermillion `#D55E00`) | White text on it: 5.7 : 1 |
| Light ink | `#F1F5F9` | Letters on dark backgrounds | 15.7 : 1 on `#1B1B1F` |

Every part of the logo that carries meaning (face, the white **uu** eyes, letters) has at least 3 : 1 contrast against what's behind it, the WCAG level for graphics.

### Colour-blind check

The cat doesn't depend on colour at all: the white **uu** eyes stand out from the blue face by brightness, not hue, so they read the same in greyscale, so it reads the same in greyscale and for every type of colour vision. The palette itself was checked with the Machado (2009) colour-vision simulation (CIEDE2000 ΔE between colours; above about 10 is clearly different):

| Vision | Blue / orange | Blue / green | Orange / green |
|---|---|---|---|
| Typical | 55.4 | 38.4 | 42.9 |
| Protanopia (no red cones) | 55.7 | 38.4 | 17.9 |
| Deuteranopia (no green cones) | 62.7 | 34.6 | 26.5 |
| Tritanopia (no blue cones, rare) | 51.4 | 12.4 | 55.5 |

The same blue is the default `--primary` colour of every Cluub app, and the [default theme](/cookbook/theming) uses `#56B4E9` in dark mode.

## Usage

* **Do** leave space around the logo at least as wide as one cat ear.
* **Do** use `/logo-full-dark.svg` on dark backgrounds (the cat icon works on both).
* **Don't** recolour, rotate, stretch or add effects to the logo.
* **Don't** change the eyes: the white **uu** is the heart of the logo.
* The name is written **Cluub** in text and **cluub** for the command, the package and the wordmark.

## See also

* [Why the name Cluub](/guide/introduction#why-the-name-cluub)
* [Custom theme and styling](/cookbook/theming)
