<script setup>
import { withBase } from 'vitepress'
</script>

# Brand & logo

Cluub *clubs together* the frontend, the backend and AI. The logo says exactly that: a club (♣) made of **three circles**, one for each part, joined on a single stem.

## Logo files

All files are plain SVG in the repository's `docs/public/` folder and are served from this site.

<div class="brand-logos">
  <figure><img :src="withBase('/logo-full.svg')" alt="Cluub logo with wordmark, for light backgrounds"><figcaption><code>/logo-full.svg</code> · light backgrounds</figcaption></figure>
  <figure class="on-dark"><img :src="withBase('/logo-full-dark.svg')" alt="Cluub logo with wordmark, for dark backgrounds"><figcaption><code>/logo-full-dark.svg</code> · dark backgrounds</figcaption></figure>
  <figure><img :src="withBase('/logo.svg')" alt="Cluub mark, for light backgrounds"><figcaption><code>/logo.svg</code> · mark only</figcaption></figure>
  <figure class="on-dark"><img :src="withBase('/logo-dark.svg')" alt="Cluub mark, for dark backgrounds"><figcaption><code>/logo-dark.svg</code> · mark on dark</figcaption></figure>
  <figure><img :src="withBase('/wordmark.svg')" alt="Cluub wordmark"><figcaption><code>/wordmark.svg</code> · wordmark only</figcaption></figure>
  <figure><img :src="withBase('/favicon.svg')" alt="Cluub favicon"><figcaption><code>/favicon.svg</code> · adapts to dark mode</figcaption></figure>
</div>

The wordmark is drawn with simple strokes (no font), so it looks identical everywhere and needs no font licence.

## Colours

The three circles use the **Okabe–Ito palette**, a set of colours designed to stay distinguishable for people with colour-vision deficiency.

<div class="brand-swatches">
  <div style="background:#0072B2;color:#fff"><b>Blue #0072B2</b><br>Frontend · brand colour</div>
  <div style="background:#E69F00;color:#1E293B"><b>Orange #E69F00</b><br>Backend</div>
  <div style="background:#009E73;color:#fff"><b>Green #009E73</b><br>AI</div>
  <div style="background:#1E293B;color:#fff"><b>Ink #1E293B</b><br>Stem, wordmark, text</div>
  <div style="background:#56B4E9;color:#0B1220"><b>Sky #56B4E9</b><br>Brand colour on dark</div>
</div>

| Token | Hex | Used for | Contrast |
|---|---|---|---|
| Blue | `#0072B2` | Frontend circle, links and buttons on light backgrounds | 5.2 : 1 on white (WCAG AA for text) |
| Orange | `#E69F00` | Backend circle | Decorative; not used for text |
| Green | `#009E73` | AI circle | Decorative; not used for text |
| Ink | `#1E293B` | Stem, wordmark, body text | 14.6 : 1 on white |
| Sky | `#56B4E9` | Links and buttons on dark backgrounds | 7.4 : 1 on `#1B1B1F` |
| Light ink | `#F1F5F9` | Stem and wordmark on dark backgrounds | 15.7 : 1 on `#1B1B1F` |

### Colour-blind check

The three circle colours were checked with the Machado (2009) colour-vision simulation, measuring how different each pair still looks (CIEDE2000 ΔE; above about 10 is clearly different):

| Vision | Blue / orange | Blue / green | Orange / green |
|---|---|---|---|
| Typical | 55.4 | 38.4 | 42.9 |
| Protanopia (no red cones) | 55.7 | 38.4 | 17.9 |
| Deuteranopia (no green cones) | 62.7 | 34.6 | 26.5 |
| Tritanopia (no blue cones, rare) | 51.4 | 12.4 | 55.5 |

The mark never relies on colour alone: each circle has a fixed position (frontend left, backend right, AI on top) and a white ring separates it from its neighbours, so the shape reads the same in greyscale.

The same blue is the default `--primary` colour of every Cluub app, and the [default theme](/cookbook/theming) uses `#56B4E9` in dark mode.

## Usage

* **Do** leave space around the logo at least as wide as one circle.
* **Do** use the dark variants on dark backgrounds.
* **Don't** recolour, rotate, stretch or add effects to the mark.
* **Don't** swap the circle colours: blue, orange and green always stand for frontend, backend and AI.
* The name is written **Cluub** in text and **cluub** for the command, the package and the wordmark.

## See also

* [Why the name Cluub](/guide/introduction#why-the-name-cluub)
* [Custom theme and styling](/cookbook/theming)
