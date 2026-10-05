# Computational Portfolio

Personal portfolio and website showcasing projects in computational engineering,
numerical simulation, and software development.

A static one-pager with a German, English, and French interface, built with plain
HTML, CSS, and JavaScript. No build step, no framework, no dependencies, no
tracking. Push to GitHub Pages and it is live.

---

## Quick start

There is nothing to install and nothing to build.

```bash
# serve the folder with any static server
npx http-server . -p 8080
# then open http://127.0.0.1:8080
```

Run the tests (Node 18 or newer, no `npm install` needed — this uses the built-in
test runner):

```bash
node --test
```

> Use bare `node --test`. `node --test tests/` does not work: Node reads the
> argument as a module path and fails with `MODULE_NOT_FOUND`.

Deploy by pushing to the `main` branch and enabling GitHub Pages for the
repository (Settings → Pages → Source: `main` / root).

---

## How the three languages work

This is the one thing worth understanding before you edit anything.

**German is the real content.** Every German sentence is static markup in
`index.html`. English and French live in `assets/js/i18n.js`.

Each translatable element carries a `data-i18n` attribute naming its key:

```html
<h1 data-i18n="hero.name">[Vorname Nachname]</h1>
```

The key is the contract. `main.js` walks the page on load and on every language
switch, replacing each element's text with the active language's dictionary value.

### Changing a placeholder

A placeholder marked with `data-i18n` lives in **three** places. Change all three:

| # | File | What to edit |
| --- | --- | --- |
| 1 | `index.html` | the German text between the tags |
| 2 | `assets/js/i18n.js` | `I18N.en["hero.name"]` |
| 3 | `assets/js/i18n.js` | `I18N.fr["hero.name"]` |

Worked example — replacing the name:

```html
<!-- index.html -->
<h1 data-i18n="hero.name">[Vorname Nachname]</h1>
```

```js
// assets/js/i18n.js
"hero.name": "[Jane Doe]",                       // I18N.en
"hero.name": "[Jeanne Dupont]",                  // I18N.fr
```

To find every occurrence of a key at once:

```bash
# macOS / Linux / Git Bash
grep -rn "hero.name" index.html assets/js/i18n.js
```

```powershell
# Windows PowerShell
Select-String -Path index.html, assets/js/i18n.js -Pattern "hero.name"
```

If you only edit the German and skip the dictionaries, German shows your text and
EN/FR keep showing the old placeholder — that is the intended fallback, not a bug,
but it is almost never what you want.

### Two kinds of elements

**Text elements** get `data-i18n` and nothing else. Their content is replaced
wholesale, so they must contain text only — no nested tags.

```html
<p data-i18n="about.p1">[Studium, Schwerpunkte.]</p>
```

**Attribute elements** additionally carry `data-i18n-attr`, and the value is
written with `setAttribute` instead. Children are safe here.

```html
<nav data-i18n="nav.label" data-i18n-attr="aria-label" aria-label="Hauptnavigation">
```

Never put a plain `data-i18n` on an element that wraps icons or markup — the
text replacement deletes them. A test enforces this; if you hit it, use
`data-i18n-attr` or move the key to a text leaf.

---

## What is still placeholder

The text content is complete: **zero square-bracket placeholders remain** on any
page, and `tests/placeholders.test.js` enforces that. Two binary assets are still
generated stand-ins:

1. **The project images** in `assets/img/project-*.svg` are abstract placeholders.
2. **`assets/img/og-image.png`** is a gradient with no text on it.

Check for yourself:

```powershell
Select-String -Path *.html, assets/js/i18n.js -Pattern '\[.+?\]'
```

That should return nothing.

### About the postal address

The Impressum lists `Aachen, Deutschland` plus a note that a deliverable address
is supplied on request by email. That is a real pattern used by people without a
registered office, but it is contested under § 5 DDG — courts have held that a
`c/o` address or an on-request arrangement is not sufficient. A virtual office,
a `c/o` at a known party, or a commercial address avoids the question entirely.

**This is the one item on the site that still needs a lawyer, together with the
rest of the legal pages.** The text is now complete and reads as a finished
document rather than a draft, which means nothing on either legal page signals
that it is unreviewed. That signal used to be the square brackets.

## Changing content

### Name, role, availability

`index.html`, Hero section: `hero.name`, `hero.role`, `hero.availability`,
`hero.intro`. Then update the matching `I18N.en` / `I18N.fr` entries.

### Email address

`contact@mauricebastard.de` appears in **five** places across four files, and
missing one leaves a dead link or a form that sends nowhere. Search for it:

```powershell
Select-String -Path *.html, assets/js/main.js -Pattern "contact@mauricebastard.de"
```

| Location | What it is |
| --- | --- |
| `index.html` → `#contact-mailto` `href` | the mailto button |
| `assets/js/main.js` → the submit handler | the form's mailto target |
| `impressum.html` | the contact block |
| `datenschutz.html` → controller block | the controller address |
| `datenschutz.html` → rights block | where data-subject requests go |

### Swapping the CV

There is one CV per language in `assets/pdf/`, named by language code:

```
CV_DE_Maurice_Bastard.pdf
CV_EN_Maurice_Bastard.pdf
CV_FR_Maurice_Bastard.pdf
```

The download link follows the active language. `#cv-download` in the Hero carries
the **German** file as its `href`, which is what a visitor gets with JavaScript
disabled; `main.js` rewrites both `href` and `download` on every language change,
so a French visitor gets the French CV rather than the German one.

To replace a CV, keep the filename. To rename them, change the `CV_FILENAMES` map
at the top of the wiring section in `assets/js/main.js` and the `href` on
`#cv-download` in `index.html` — `tests/cv.test.js` checks that both still agree,
that all three files exist, and that the language switch actually calls
`updateCvLink()`.

### GitHub and LinkedIn

Two profile links, both in the contact section: `github.com/MauriceBa` and the
LinkedIn profile. No project card links to a repository — the simulation work was
done at Forschungszentrum Jülich and is not public, and a card pointing at a
private or nonexistent repo reads worse than no link at all.

If you publish something later, add the link to that one card rather than to all
three.

### Projects

Project cards are static markup in `index.html`, one `<article>` each. To add a
fourth:

1. Copy an existing `<article class="card project" data-category="...">`.
2. Give it a new `data-category` and point the image at a new SVG.
3. Add `project4.*` keys to `I18N.en` and `I18N.fr` (`title`, `category`,
   `problem`, `method`, `tag1`–`tag4`, plus `institution` if there is no link).
4. If you introduce a **new category**, also add a matching
   `<button data-filter="...">` to `#project-filter`, or the card becomes
   unreachable — the test suite checks this.

Note the cards deliberately differ in their footer: project 2 has a DOI link,
project 3 has nothing, and projects without public output carry a
`project__note` naming the institution instead. That is honest — an empty link
row or a dead button is worse than saying who the work was done with.

### Legal pages

`impressum.html` and `datenschutz.html` are **structurally complete but legally
unreviewed**. They are organised around DDG § 5 and the GDPR articles, but that
is a layout, not compliance.

**Have both pages reviewed by a lawyer before you publish.** German law requires a
correct Impressum and a correct privacy policy, and getting either wrong carries
fines.

The privacy page states the site sets no cookies, loads no third-party content,
and sends no data anywhere. That is true of this build — if you later add
analytics, an embed, a font from a CDN, or a contact-form service, that statement
becomes false and must be updated in the same change.

---

## Files

```
index.html              the one-pager: all sections, German content, all i18n keys
impressum.html          placeholder legal notice (German only)
datenschutz.html        placeholder privacy policy (German only)
assets/css/style.css    design tokens, layout, components, responsive rules
assets/js/i18n.js       EN and FR dictionaries
assets/js/main.js       pure logic + all DOM wiring
assets/img/             placeholder project SVGs, favicon, og-image.png
assets/pdf/             your CV, one file per language (CV_DE/EN/FR_Maurice_Bastard.pdf)
tests/                  Node built-in test runner; never served
docs/superpowers/       the design spec and implementation plan
```

`style.css` is organised top-down: tokens, reset and base, layout primitives,
components, responsive refinements, then motion and contrast overrides. Most edits
land in the components section.

---

## Customising the design

All colour, spacing, type, radius, and shadow values are CSS custom properties at
the top of `assets/css/style.css`. Change them in `:root`; the dark theme in
`[data-theme="dark"]` re-points only the `--color-*` values, which is what keeps the
two themes consistent.

```css
:root {
  --color-accent: #1d4ed8;   /* change this */
  --color-bg: #ffffff;
  --color-text: #111827;
}
```

Colour contrast was verified for every text and border pair in light mode, dark
mode, and `prefers-contrast: more`. Body text sits far above the 4.5:1 minimum, so
you have room to adjust the accent — but if you push it much lighter, re-check
`contrast` before shipping.

The site ships no web fonts and uses the system stack, so there is nothing to load
and nothing to license.

---

## Behaviour reference

| Feature | Where | Notes |
| --- | --- | --- |
| Theme toggle | `#theme-toggle` | persists in `localStorage` under `portfolio-theme`; resolved before first paint so there is no flash |
| Language switch | `#lang-group` | persists under `portfolio-lang`; also sets `<html lang>` |
| Project filter | `#project-filter` | real buttons with `aria-pressed`; hides cards with the `hidden` attribute so they leave the accessibility tree; announces the count in a live region |
| Mobile nav | `#nav-toggle` | below 864 px; sets `inert` on `<main>` and `<footer>` so Tab cannot reach the content behind an open menu; Escape closes it; the menu auto-closes if the viewport crosses into the wide layout |
| Scroll spy | header nav | `IntersectionObserver`; marks the active link with `aria-current` |
| Contact form | `#contact-form` | **has no backend.** GitHub Pages cannot receive submissions, so it opens the visitor's mail client via `mailto:`. Nothing is sent or stored. |

### Browser storage

Two keys only: `portfolio-theme` and `portfolio-lang`. Both stay on the visitor's
device and are described in the privacy page. Clearing site data removes them.

---

## Accessibility and performance

- Semantic landmarks, one `h1` per page, heading levels that never skip.
- Full keyboard operation, visible focus rings, `aria-pressed` on all toggles.
- Status changes (filter counts, validation failures) go through `aria-live`.
- `prefers-reduced-motion` and `prefers-contrast: more` are both honoured.
- With JavaScript disabled the site still renders completely in German, all three
  project cards are present, and the in-page navigation stays reachable at every
  screen width — the collapsed menu falls back to an always-open list, so a
  scripting-disabled visitor never gets a dead hamburger button. This is
  deliberate, so crawlers and applicant tracking systems read real content.

The `tests/maintenance.test.js` file guards the invariants that rot quietly as
content changes: translation-key parity across all three languages, asset links
that resolve, `target="_blank"` links that carry `rel="noopener noreferrer"`,
heading order, and the no-child-markup rule described above. Run `node --test`
after editing content.

---

## Before you publish

- [ ] `node --test` passes
- [ ] No square-bracket placeholders remain. Site pages and dictionaries are
      clean; verify with
      `Select-String -Path index.html, impressum.html, datenschutz.html, assets/js/i18n.js -Pattern '\[.+?\]'`
      — leave this README out of the search, it contains bracketed examples
- [ ] `assets/img/` holds real project visuals
- [ ] Both legal pages reviewed by a lawyer
- [ ] The privacy page's "no cookies, no third parties" claim still true
- [ ] `assets/img/og-image.png` replaced — it is an abstract placeholder with no text
