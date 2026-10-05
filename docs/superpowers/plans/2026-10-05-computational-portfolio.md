# Computational Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete static, dependency-free, three-language (DE/EN/FR) portfolio site described in the design spec, with every content string a swappable placeholder.

**Architecture:** A one-pager (`index.html`) whose German text is real static markup tagged `data-i18n`, plus two German-only legal pages. `assets/js/main.js` holds four DOM-free pure functions behind a CommonJS export guard and DOM wiring behind a `document`-existence guard; `assets/js/i18n.js` holds the EN/FR dictionaries. `assets/css/style.css` is one stylesheet built on CSS custom properties with a `[data-theme="dark"]` override. Automated tests use only Node's built-in `node:test`.

**Tech Stack:** HTML5, CSS3 (custom properties, Grid, Flexbox), vanilla ES2020 JavaScript, Node built-in `node:test` for tests. No runtime dependencies, no build step, no `package.json`.

**Spec:** `docs/superpowers/specs/2026-10-05-computational-portfolio-design.md`

## Global Constraints

- Placeholder convention is fixed: every user-facing content string is wrapped in square brackets, e.g. `[Vorname Nachname]`, `[Verfügbar ab Monat Jahr]`. Non-placeholder fixed copy is allowed only for: skip-link text, `aria-label` fallbacks, the German legal page headings, and the `<html lang>` attribute value.
- Zero runtime dependencies. No `package.json`, no `node_modules`, no CDN, no web fonts, no framework, no icon library, no analytics.
- System font stack only. `--font-sans` resolves to a `system-ui` stack; no `@font-face`.
- `localStorage` keys are exactly `portfolio-theme` and `portfolio-lang`. Values are exactly `"light"`, `"dark"`, `"de"`, `"en"`, `"fr"`.
- `data-i18n` is applied to text-bearing leaf elements only, never to an element containing child markup — `textContent` assignment destroys children.
- `translateDocument` must skip any key absent from the active dictionary, leaving the German HTML text intact. It must never blank an element.
- Translatable elements that are not text nodes carry `data-i18n-attr="content"`; the dictionary value is written via `setAttribute`, not `textContent`.
- Every external link carries `rel="noopener noreferrer"` and `target="_blank"`.
- Contrast: body text ≥ 4.5:1 and large text/UI borders ≥ 3:1 in **both** themes. If a chosen accent value fails, the accent is adjusted — the threshold is never relaxed.
- All animations and transitions are removed inside `@media (prefers-reduced-motion: reduce)`.
- Budgets (from spec §7): `index.html` ≤ 40 KB, `style.css` ≤ 20 KB, `main.js` + `i18n.js` ≤ 20 KB combined, each SVG ≤ 5 KB, `resume_placeholder.pdf` ≤ 10 KB.
- All test files are `tests/*.test.js` and run with **`node --test`** from the repo root
  (bare, so Node auto-discovers `tests/`). Note: `node --test tests/` is **wrong** — Node
  treats the argument as a module path and fails with `MODULE_NOT_FOUND`. They are never
  served and never referenced from HTML.

## Review Focus

Five input classes or failure modes the spec implies that are easiest to get wrong. Each line's test is assigned to the task that owns the code.

1. **`localStorage` unavailable** — private-mode Firefox, disabled cookies, or a `file://` open. Reads throw, and unhandled throws in the theme bootstrap blank the page before paint. Expected: silently fall back to `prefers-color-scheme`, page still renders and still toggles. → Task 1.
2. **Malformed value in `localStorage`** — a hand-edited or stale `portfolio-theme` of `"DARK"`, `"auto"`, or `""`. Expected: fall back to the OS preference, never apply an unknown value to `data-theme`. → Task 1.
3. **Key missing from the active dictionary** — a placeholder added to `index.html` without an EN/FR entry. Expected: German text stays visible; section does not go blank. → Task 3.
4. **Filter matches zero cards** — `web` has no card in v1 by design. Expected: empty-state message shown, count announced as 0, no layout collapse. → Task 4.
5. **mailto field containing `&`, `=`, `?`, newlines, or `+`** — user input is interpolated into a URL query. Expected: single `encodeURIComponent` round-trip yields a `mailto:` URL that reopens with the original text intact; the `+` in an email address must survive as a literal plus. → Task 2.

## File Map

| File | Responsibility |
| --- | --- |
| `index.html` | One-pager. All portfolio sections, German text as static markup, every `data-i18n` key, all ARIA wiring. |
| `impressum.html` | German-only placeholder legal notice. Header with theme toggle only. |
| `datenschutz.html` | German-only placeholder privacy policy. Header with theme toggle only. |
| `assets/css/style.css` | Design tokens, reset, layout, components, responsive refinements, reduced-motion overrides. |
| `assets/js/i18n.js` | `I18N.en` and `I18N.fr` dictionaries. No logic. |
| `assets/js/main.js` | Four pure functions (exported for tests) + all DOM wiring behind a `document` guard. |
| `assets/img/project-1.svg` … `project-3.svg` | Decorative placeholder artwork for the project cards. |
| `assets/img/og-image.png` | Social preview image. **PNG, not SVG** — no major social platform rasterises SVG for `og:image`; Facebook, X and LinkedIn drop it. Generated once with a throwaway Node script (built-in `zlib` only), which is not committed. |
| `assets/img/favicon.svg` | Favicon. |
| `assets/pdf/resume_placeholder.pdf` | Placeholder CV, valid and openable. |
| `assets/pdf/thesis_placeholder.pdf` | Placeholder publication PDF, valid and openable. |
| `tests/theme.test.js` | `resolveTheme` |
| `tests/mailto.test.js` | `buildMailtoUrl` |
| `tests/filter.test.js` | `cardMatchesCategory` |
| `tests/i18n.test.js` | `translateDocument` + EN/FR key parity |
| `tests/maintenance.test.js` | HTML/DOM integrity invariants |
| `README.md` | Placeholder replacement guide (user-facing). |

### Translation key inventory

This list is the contract between `index.html` and `i18n.js`. `tests/i18n.test.js` asserts EN/FR parity; `tests/maintenance.test.js` asserts every key used in HTML exists in both dictionaries.

```
meta.title, meta.description
nav.skip, nav.label, nav.menu, nav.close,
nav.about, nav.skills, nav.projects, nav.research, nav.contact
theme.toDark, theme.toLight
lang.label
hero.name, hero.role, hero.availability, hero.intro,
hero.cta.projects, hero.cta.contact, hero.cta.resume
about.heading, about.p1, about.p2, about.stat1, about.stat2, about.stat3
skills.simulation.title, skills.simulation.desc, skills.simulation.tag1..tag4
skills.languages.title, skills.languages.desc, skills.languages.tag1..tag4
skills.tools.title,     skills.tools.desc,     skills.tools.tag1..tag5
skills.vcs.title,       skills.vcs.desc,       skills.vcs.tag1..tag4
filter.label, filter.all, filter.simulation, filter.optimization, filter.web,
filter.result, filter.empty
projects.heading
project1.title, project1.category, project1.problem, project1.method,
project1.tag1..tag3, project1.repo, project1.demo
project2.title, project2.category, project2.problem, project2.method,
project2.tag1..tag3, project2.repo, project2.demo
project3.title, project3.category, project3.problem, project3.method,
project3.tag1..tag3, project3.repo, project3.demo
research.heading
research.1.title, research.1.meta, research.1.abstract, research.1.download
research.2.title, research.2.meta, research.2.abstract, research.2.download
contact.heading, contact.lead, contact.emailBtn, contact.name, contact.subject,
contact.message, contact.submit, contact.status
contact.github, contact.linkedin
footer.copyright, footer.imprint, footer.privacy
```

`filter.result` is the one dictionary value containing `{count}` / `{total}` placeholders and is
therefore **owned by the filter logic, not by `translateDocument`** — Task 9 Step 5 runs the
filter once on boot so the live region never displays raw braces. Every other key is applied
normally by the translation walk.

---

### Task 1: Theme resolution pure logic

**Files:**
- Create: `assets/js/main.js`
- Create: `tests/theme.test.js`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `resolveTheme(storedValue: string | null | undefined, prefersDark: boolean) -> "light" | "dark"`, exported from `main.js` via CommonJS guard and reachable from `window.Portfolio.resolveTheme` in the browser. Storage key constant `"portfolio-theme"`. `main.js` must not throw when `document` is undefined.

- [ ] **Step 1: Write the failing test**

Create `tests/theme.test.js` using `require('node:test')`, `require('node:assert/strict')`, and `require('../assets/js/main.js')`. Cover, with exact expected strings:

```js
resolveTheme("dark", false)  === "dark"    // stored value always wins
resolveTheme("light", true)  === "light"   // even against a dark OS
resolveTheme(null, true)     === "dark"    // no stored value -> OS preference
resolveTheme(undefined, false) === "light"
resolveTheme("", true)       === "dark"    // empty string is not a valid value
resolveTheme("DARK", true)   === "dark"    // case-insensitive match
resolveTheme("auto", true)   === "dark"    // unknown value -> fall through to OS
resolveTheme("auto", false)  === "light"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test` from the repo root.
Expected: FAIL — `Cannot find module '../assets/js/main.js'`.

- [ ] **Step 3: Create `assets/js/main.js` with the export guard and `resolveTheme`**

Structure the file as a single IIFE containing all pure functions plus a `DOMContentLoaded` wiring block, so later tasks append to one file rather than restructure it:

```js
(function () {
  "use strict";

  // --- pure logic (unit-tested) -------------------------------------------

  function resolveTheme(storedValue, prefersDark) {
    // Returns "dark" only when storedValue (trimmed, lowercased) is exactly
    // "dark"; "light" when exactly "light"; otherwise prefersDark decides.
  }

  const api = { resolveTheme: resolveTheme };

  // --- module guard (Node tests) ---
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  // --- DOM wiring ---
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      // filled in by later tasks
    });
  }
})();
```

The `module` guard must come before the DOM guard so a Node `require` never touches `document`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS — all `resolveTheme` cases green.

- [ ] **Step 5: Commit**

```bash
git add assets/js/main.js tests/theme.test.js
git commit -m "feat: add theme resolution logic with localStorage fallbacks"
```

---

### Task 2: Mailto URL builder

**Files:**
- Modify: `assets/js/main.js` (append to the IIFE, before the `api` object)
- Modify: `tests/theme.test.js` → split out into `tests/mailto.test.js`
- Create: `tests/mailto.test.js`

**Interfaces:**
- Consumes: `main.js` IIFE structure from Task 1.
- Produces: `buildMailtoUrl(email: string, fields: { subject: string, body: string }) -> string`, added to the exported `api` object.

- [ ] **Step 1: Write the failing test**

Create `tests/mailto.test.js`, same three `require`s, requiring `buildMailtoUrl`. Assert exact strings:

```js
buildMailtoUrl("a@b.de", { subject: "Hi", body: "Hello" })
  === "mailto:a@b.de?subject=Hi&body=Hello"

// Review Focus #5 — encoding round-trip:
const tricky = "Müller & Söhne = 100%?\nZeile 2";
const url = buildMailtoUrl("a+b@c.de", { subject: tricky, body: tricky });
assert.ok(url.startsWith("mailto:a+b@c.de?"));
assert.equal(decodeURIComponent(url.split("body=")[1]), tricky);
// the literal + in the address survives; it is NOT encoded as %2B
```

Also assert `buildMailtoUrl("a@b.de", { subject: "", body: "" })` returns `"mailto:a@b.de"` with no `?` when both fields are empty.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `buildMailtoUrl is not a function`.

- [ ] **Step 3: Implement `buildMailtoUrl` in `assets/js/main.js`**

Signature: `buildMailtoUrl(email, fields)`. Behavior: `encodeURIComponent` each of `subject` and `body`; join as `?subject=<enc>&body=<enc>`; return the bare `mailto:<email>` with no `?` when both fields are empty after encoding. The email address is **not** encoded — `+` must stay literal. Add `buildMailtoUrl: buildMailtoUrl` to `api`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/js/main.js tests/mailto.test.js
git commit -m "feat: add mailto URL builder with correct encoding"
```

---

### Task 3: i18n dictionary and translation walk

**Files:**
- Create: `assets/js/i18n.js`
- Create: `tests/i18n.test.js`
- Modify: `assets/js/main.js` (add `translateDocument` to the IIFE and to `api`)

**Interfaces:**
- Consumes: `main.js` IIFE structure from Task 1.
- Produces:
  - `assets/js/i18n.js` exports `{ en: {...}, fr: {...} }`, exposed as `window.I18N` in the browser and as `module.exports` under Node.
  - `translateDocument(doc, dict) -> number`, returning the count of elements actually written. A key absent from `dict` is skipped and does **not** count. Exported from `main.js`.

- [ ] **Step 1: Write the failing test**

Create `tests/i18n.test.js` with two `describe` blocks.

Block 1 — key parity. Require `I18N` from `../assets/js/i18n.js`, then:

```js
const enKeys = Object.keys(I18N.en).sort();
const frKeys = Object.keys(I18N.fr).sort();
assert.deepEqual(frKeys, enKeys);              // both languages define the same keys
// and every value is a non-empty string that is NOT wrapped in square brackets
// in a way that differs between languages -- both keep the [] convention:
// assert.match(I18N.en[k], /^\[.*\]$/) for every k
```

Block 2 — `translateDocument` against a minimal fake document. Build the fake with plain object literals and a `querySelectorAll` that returns them; no jsdom, no DOM library:

```js
function el(key, attr) { return {
  getAttribute: (n) => (n === "data-i18n" ? key : n === "data-i18n-attr" ? attr : null),
  setAttribute(n, v) { this[n] = v; },
  textContent: "DEUTSCH",
}; }

const nodes = [el("hero.name"), el("meta.description", "content"), el("missing.key")];
const doc = { querySelectorAll: () => nodes };

const n = translateDocument(doc, { "hero.name": "Jane Doe", "meta.description": "Desc" });
assert.equal(n, 2);                             // missing.key skipped, not counted
assert.equal(nodes[0].textContent, "Jane Doe"); // textContent path
assert.equal(nodes[1]["content"], "Desc");      // setAttribute path via data-i18n-attr
assert.equal(nodes[2].textContent, "DEUTSCH");  // Review Focus #3: German survives
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `Cannot find module '../assets/js/i18n.js'`.

- [ ] **Step 3: Create `assets/js/i18n.js`**

Two dictionary objects keyed exactly by the Translation key inventory above. Rules the values must satisfy:

- Values keep the square-bracket placeholder convention, translated per language. `[Vorname Nachname]` → `[First Last]` (en) / `[Prénom Nom]` (fr); `[Verfügbar ab Monat Jahr]` → `[Available from Month Year]` / `[Disponible à partir de mois année]`; `[Projekte ansehen]` → `[View projects]` / `[Voir les projets]`; `[Kontakt aufnehmen]` → `[Get in touch]` / `[Me contacter]`.
- `filter.result` carries a `{count}` placeholder and a `{total}` placeholder, e.g. `"{count} von {total} Projekten"` / `"{count} of {total} projects"` / `"{count} sur {total} projets"`.
- `nav.close` is the only key with **no** square brackets — it is fixed chrome copy, not a placeholder.
- Wrap the file so both targets see it:

```js
const I18N = { "en": { /* ... */ }, "fr": { /* ... */ } };
if (typeof window !== "undefined") { window.I18N = I18N; }
if (typeof module !== "undefined" && module.exports) { module.exports = { I18N: I18N }; }
```

- [ ] **Step 4: Implement `translateDocument` in `assets/js/main.js`**

Signature: `translateDocument(doc, dict) -> number`. Algorithm: `Array.from(doc.querySelectorAll("[data-i18n]"))`; for each, read `data-i18n` as the key; `continue` when `!(key in dict)`; read `data-i18n-attr`; when present call `el.setAttribute(attr, dict[key])`, otherwise assign `el.textContent = dict[key]`; increment the counter only on a write. Add to `api`.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test`
Expected: PASS — parity and both `translateDocument` paths green.

- [ ] **Step 6: Commit**

```bash
git add assets/js/i18n.js assets/js/main.js tests/i18n.test.js
git commit -m "feat: add EN/FR dictionaries and DOM-free translation walk"
```

---

### Task 4: Project filter matching logic

**Files:**
- Modify: `assets/js/main.js`
- Create: `tests/filter.test.js`

**Interfaces:**
- Consumes: `main.js` IIFE structure from Task 1.
- Produces: `cardMatchesCategory(cardCategory: string, activeCategory: string) -> boolean`, added to `api`.

- [ ] **Step 1: Write the failing test**

Create `tests/filter.test.js`, same three `require`s, requiring `cardMatchesCategory`. Assert:

```js
cardMatchesCategory("simulation", "all") === true      // "all" is the wildcard
cardMatchesCategory("optimization", "simulation") === false
cardMatchesCategory("optimization", "optimization") === true
cardMatchesCategory("simulation", "simulation") === true
// Review Focus #4 — the "web" category has no card in v1; the predicate must
// still be well-defined, not throw or default to true:
cardMatchesCategory("simulation", "web") === false
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `cardMatchesCategory is not a function`.

- [ ] **Step 3: Implement `cardMatchesCategory` in `assets/js/main.js`**

Signature: `cardMatchesCategory(cardCategory, activeCategory)`. Behavior: return `activeCategory === "all" || cardCategory === activeCategory`. Add to `api`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/js/main.js tests/filter.test.js
git commit -m "feat: add project category filter predicate"
```

---

### Task 5: Placeholder SVG assets

**Files:**
- Create: `assets/img/project-1.svg`, `project-2.svg`, `project-3.svg`, `favicon.svg`, `og-image.png`

**Interfaces:**
- Consumes: nothing.
- Produces: four static SVG files referenced by Task 7 (`project-1..3.svg`, `favicon.svg`) and one PNG for Task 7's `og:image` meta (`og-image.png`).

- [ ] **Step 1: Create `assets/img/favicon.svg`**

A square 32×32 SVG using `currentColor`-independent fixed colors from the palette: rounded rect background plus an abstract glyph (e.g. a mesh/grid motif). No `currentColor` — a favicon has no cascade context.

- [ ] **Step 2: Create the three project SVGs**

Each is 800×450 (16:9), a rounded-rect background, a centred 32-px grid motif, and a short placeholder label reading `[Projekt N]` in the system font stack at ~28 px. Vary the background hue per file so the three cards are visually distinguishable in the grid. Hardcode colors — these are decorative and sit behind text, so no cascade is available.

- [ ] **Step 3: Create `assets/img/og-image.png`**

1200×630, a diagonal navy gradient with a soft radial glow. It must be a **real PNG**, not an SVG: no major social platform rasterises SVG for `og:image`, so an SVG there renders as a broken preview or nothing at all.

Generate it with a throwaway script using only Node's built-in `zlib` (deflate is all a PNG `IDAT` needs) and delete the script afterwards — it is a build-time artifact, not a repo file. Three details decide whether the file is 25 KB or 175 KB, and all three matter:

- Use PNG filter type **2 (Up)** for every scanline except row 0. The artwork is a vertical gradient, so each row's delta from the row above is near-constant and deflate collapses it. Filter type 0 (None) is the default choice and wastes ~7× the size here.
- Posterize to 5 bits per channel (`(v >> 3) << 3`). Invisible banding on a dark navy gradient, roughly a quarter of the bytes.
- Drop the fine grid lines. At 32 px spacing across 1200×630 they are pure entropy the compressor cannot remove.

Verify the result actually decodes, not merely that the signature looks right — open it via `System.Drawing.Image::FromFile`, assert 1200×630, and sample a few pixels to confirm the gradient rendered. Expected: under 40 KB.

- [ ] **Step 4: Verify the SVGs are valid XML and all assets are within budget**

Run: `npx html-validate assets/img/*.svg` then check sizes with `Get-ChildItem assets/img | Select-Object Name, Length`.
Expected: no validation errors; every file ≤ 5120 bytes.

- [ ] **Step 5: Commit**

```bash
git add assets/img
git commit -m "feat: add placeholder SVG assets for projects and social preview"
```

---

### Task 6: Placeholder PDFs

**Files:**
- Create: `assets/pdf/resume_placeholder.pdf`
- Create: `assets/pdf/thesis_placeholder.pdf`

**Interfaces:**
- Consumes: nothing.
- Produces: two valid PDF binaries referenced by Task 7's download buttons.

- [ ] **Step 1: Generate `assets/pdf/resume_placeholder.pdf`**

Hand-author a minimal valid PDF. Use this object structure, with the `xref` offsets computed from the real byte positions of the objects (do not copy a stale offset table):

```
1 0 obj  << /Type /Catalog /Pages 2 0 R >>
2 0 obj  << /Type /Pages /Kids [3 0 R] /Count 1 >>
3 0 obj  << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
4 0 obj  << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
5 0 obj  << /Length N >> stream ... endstream
trailer: << /Size 6 /Root 1 0 R >>
startxref: <byte offset of the xref table>
```

The content stream draws two lines: `[Vorname Nachname]` and `[Lebenslauf – Platzhalterdokument]`. `N` is the stream's exact byte length.

- [ ] **Step 2: Generate `assets/pdf/thesis_placeholder.pdf`**

Same structure, one page, one line: `[Titel der Abschlussarbeit]`.

- [ ] **Step 3: Verify both open and are within budget**

Run: `Get-ChildItem assets/pdf | Select-Object Name, Length` and open each file to confirm a viewer renders it with no repair prompt. A viewer that asks to repair means the `xref` offsets are wrong — fix the offsets, do not ship it.
Expected: each file ≤ 10240 bytes; both open cleanly.

- [ ] **Step 4: Commit**

```bash
git add assets/pdf
git commit -m "feat: add valid placeholder PDFs for CV and publications"
```

---

### Task 7: index.html full markup

**Files:**
- Create: `index.html`

**Interfaces:**
- Consumes: the Translation key inventory and the five SVGs from Tasks 5–6.
- Produces: every element Task 9 wires up, addressed by these IDs:
  `#site-header`, `#nav-toggle`, `#nav-menu`, `#theme-toggle`, `#lang-group` (containing `[data-lang]` buttons), `#project-filter` (containing `[data-filter]` buttons), `#project-grid`, `#filter-status`, `#filter-empty`, `#contact-form`, `#contact-status`, `#contact-mailto`, `#year`.
  Section IDs: `#about`, `#skills`, `#projects`, `#research`, `#contact`.
  Each `<section>` also carries `aria-labelledby` pointing at its own heading's `id`.

- [ ] **Step 1: Write the `<head>`**

Exactly these elements, per spec §4.8: `charset`, `viewport`, `title` carrying `data-i18n="meta.title"` with German text, `meta[name=description]` carrying `data-i18n="meta.description"` **and** `data-i18n-attr="content"` with German text in `content`, `link rel=icon` → `assets/img/favicon.svg`, `link rel=stylesheet` → `assets/css/style.css`, `og:title`/`og:description` (German, no `data-i18n`), `og:type=website`, `og:image` → `assets/img/og-image.png`.

- [ ] **Step 2: Add the theme bootstrap inline script**

An inline `<script>` in `<head>` that runs before paint. It must call `resolveTheme`-equivalent logic *without* depending on `main.js` having loaded — `main.js` is `defer`red and therefore not yet executed. Wrap the `localStorage.getItem` in `try/catch` and guard the `matchMedia` call. Set `document.documentElement.dataset.theme`. This script duplicates the resolution order in `main.js` deliberately; the only way to avoid the duplication would be a blocking script, which the spec's performance budget forbids.

- [ ] **Step 3: Build the header, skip link, and footer**

Skip link is the first element in `<body>`, `href="#main"`, `data-i18n="nav.skip"`. `<header id="site-header">` contains `<nav aria-label>` (`data-i18n-attr="aria-label"`, `data-i18n="nav.label"`), the anchor list to the five section IDs (keys `nav.about`, `nav.skills`, `nav.projects`, `nav.research`, `nav.contact`), `#nav-toggle` (`aria-expanded="false"`, `aria-controls="nav-menu"`, `data-i18n="nav.menu"`; its accessible name must change to `nav.close` when open, per Task 9 Step 3), `#lang-group` with `role="group"`, `data-i18n-attr="aria-label"` / `data-i18n="lang.label"`, and three `<button data-lang="de|en|fr">` each carrying `aria-pressed`. `#theme-toggle` carries `aria-pressed="false"` and a German `aria-label` fallback, with `theme.toDark` / `theme.toLight` supplied by Task 9 Step 2. Footer carries `#year`, `footer.copyright`, and links to `impressum.html` and `datenschutz.html`. `<main id="main" tabindex="-1">` wraps the sections.

- [ ] **Step 4: Build the Hero and Über mich sections**

Hero: `h1` (`hero.name`), role line (`hero.role`), availability (`hero.availability`), intro (`hero.intro`), three actions — `#projects` anchor styled as primary (`hero.cta.projects`), `#contact` anchor as secondary (`hero.cta.contact`), and an `<a download href="assets/pdf/resume_placeholder.pdf">` (`hero.cta.resume`). Add a decorative `<div class="hero__backdrop" aria-hidden="true">`.

Über mich: `about.heading`, two `<p>` (`about.p1`, `about.p2`), and a stat row of three `<div>`s each holding a value and label, using `about.stat1..3`.

- [ ] **Step 5: Build the Kernkompetenzen section**

`skills.*` cards. Each card is an `<article>` with `<h3>`, a `<p>` description, and a `<ul>` of `<li>` badges — one `li` per tag key, with the tag count per card as specified in the inventory (simulation 4, languages 4, tools 5, vcs 4). Each card's icon is inline SVG with `aria-hidden="true"`. The decorative `<ul>`-based badge list means every `li` needs its own key; there are no generic `skills.*.tags` keys.

- [ ] **Step 6: Build the Projekte section**

`projects.heading`. `#project-filter` is a `<div role="group">` with `aria-label` (`filter.label`) holding four `<button data-filter="all|simulation|optimization|web">`, each `aria-pressed` with `all` initially `true`. `#project-grid` holds three `<article class="card" data-category="simulation|simulation|optimization">`. Each card: `<img src="assets/img/project-N.svg" alt="" loading="lazy">`, category chip, `h3`, problem `<p>`, method `<p>`, tag `<ul>`, and a link row (repo + demo, both `target="_blank" rel="noopener noreferrer"`). Then `#filter-status` (`aria-live="polite"`, visually hidden, `filter.result`), and `#filter-empty` with `filter.empty`.

- [ ] **Step 7: Build the Forschung and Kontakt sections**

Forschung: `research.heading` plus two `<article>`s, each with title, `#`-prefixed meta line (`research.N.meta`), abstract `<p>`, and a download `<a download>` pointing at `assets/pdf/thesis_placeholder.pdf` with `research.N.download`.

Kontakt: `contact.heading`, `contact.lead`, `#contact-mailto` (`contact.emailBtn`), and `#contact-form` with `<label for>` for name, subject, and message (keys `contact.name`, `contact.subject`, `contact.message`), a submit button (`contact.submit`), and `#contact-status` (`aria-live="polite"`, visually hidden, `contact.status`). Then links to `[https://github.com/[username]]` and `https://linkedin.com/in/[username]` with keys `contact.github` / `contact.linkedin`.

- [ ] **Step 8: Validate**

Run: `npx html-validate index.html`
Expected: zero errors. Then `Select-String -Path index.html -Pattern 'data-i18n="([^"]+)"' -AllMatches | ForEach-Object { $_.Matches.Groups[1].Value } | Sort-Object -Unique` and diff that list against the Translation key inventory. Expected: no key in the HTML is missing from the inventory, and no inventory key is unused.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat: add one-pager markup with all sections and i18n keys"
```

---

### Task 8: style.css

**Files:**
- Create: `assets/css/style.css`

**Interfaces:**
- Consumes: the class names, IDs, and structure from Task 7.
- Produces: the token names every other task relies on — `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-accent`, `--color-accent-contrast`, `--color-border`, `--space-1..8`, `--radius-sm/md/lg`, `--font-sans`, `--font-mono`, `--text-sm/base/lg/xl/3xl`, `--shadow-1/2`, `--container`, `--header-h`.

- [ ] **Step 1: Write tokens and the dark override**

`:root` defines every token above with light-theme values. `[data-theme="dark"]` re-points **only** the `--color-*` tokens — spacing, radius, type, and layout tokens are shared, which is what keeps the two themes consistent. `--font-sans` is a `system-ui` stack; there is no `@font-face`.

- [ ] **Step 2: Write reset, base, and layout primitives**

Modern reset, `:focus-visible` ring of at least 2 px at 3:1 contrast, `.container`, `.section` (with `scroll-margin-top: calc(var(--header-h) + 1rem)`), `.skip-link` (visually hidden until `:focus`), `.visually-hidden`, and the Grid/Flexbox section layouts.

- [ ] **Step 3: Write components in spec order**

Header, hero (including the CSS-gradient backdrop: radial-gradient mesh over a `repeating-linear-gradient` 32-px grid), buttons, badges, cards, project grid, filter buttons, research list, form, footer. The active filter button must differ by weight **and** an underline, not colour alone.

- [ ] **Step 4: Write responsive refinements**

One breakpoint at 860 px: the nav list collapses and `#nav-toggle` becomes visible. Project grid goes 3 → 2 → 1 columns. Below 480 px, the stat row and footer stack. No horizontal scroll at 360 px.

- [ ] **Step 5: Write the motion and contrast overrides**

`@media (prefers-reduced-motion: reduce)` sets `scroll-behavior: auto` and forces `transition-duration: 0.01ms` / `animation: none`. `@media (prefers-contrast: more)` strengthens `--color-border` and focus rings.

- [ ] **Step 6: Verify contrast in both themes**

Compute the contrast ratio of `--color-text` on `--color-bg` and of `--color-muted` on `--color-surface`, for light and dark, in both the default and `prefers-contrast: more` states.
Expected: body text ≥ 4.5:1, borders ≥ 3:1. Adjust accent lightness until this holds — per Global Constraints, never relax the threshold.

- [ ] **Step 7: Verify the budget**

Run: `Get-Item assets/css/style.css | Select-Object Length`.
Expected: ≤ 20480 bytes.

- [ ] **Step 8: Commit**

```bash
git add assets/css/style.css
git commit -m "feat: add design tokens, layout, and component styles"
```

---

### Task 9: main.js DOM wiring

**Files:**
- Modify: `assets/js/main.js` (fill the `DOMContentLoaded` block)

**Interfaces:**
- Consumes: the four pure functions from Tasks 1–4; every ID from Task 7; `window.I18N` from Task 3.
- Produces: no new exports. All new behaviour is internal to the `DOMContentLoaded` callback.

- [ ] **Step 1: Wire language switching**

On `DOMContentLoaded`, read `portfolio-lang` from `localStorage` (try/catch), validate it is one of `de`/`en`/`fr`, default to `de`. If the resolved language is not `de`, set `document.documentElement.lang` and call `translateDocument(document, I18N[lang])`. Clicking a `[data-lang]` button repeats that, sets the button's `aria-pressed`, and writes `portfolio-lang`. On switching **to** `de`, restore from the HTML by reloading the German text — the simplest correct implementation is to re-run `translateDocument` with `{}`, which leaves every `textContent` as-is and therefore still shows stale EN/FR text, so instead **snapshot the German strings at boot** into a map before any translation, and restore from that snapshot when switching to `de`. Implement the snapshot.

- [ ] **Step 2: Wire the theme toggle**

Read `portfolio-theme` (try/catch) and `prefers-color-scheme`, pass both to `resolveTheme`, and set `document.documentElement.dataset.theme`. Clicking `#theme-toggle` flips the value, updates `dataset.theme`, flips `aria-pressed`, and sets `aria-label` to the `theme.toDark` / `theme.toLight` value from the active language dictionary. Persist. No flash on reload is guaranteed by the Task 7 head script, not here.

- [ ] **Step 3: Wire the mobile nav**

`#nav-toggle` toggles an `open` class on `#nav-menu`, flips `aria-expanded`, swaps its accessible name between `nav.menu` and `nav.close` using the active dictionary, and sets `inert` on `<main>` and `<footer>` while open so Tab cannot reach content behind the menu. Escape closes the menu and returns focus to `#nav-toggle`.

- [ ] **Step 4: Wire anchor focus management**

Per spec §5.6, `:target` moves the viewport but not focus, so keyboard and screen-reader users would land mid-page with focus stranded on the nav link. Add one delegated click handler on the nav anchor list. It calls `preventDefault()`, reads the `href` hash, sets `tabindex="-1"` on the target section, calls `target.scrollIntoView()` (which respects `scroll-margin-top` and the reduced-motion override), and calls `target.focus({ preventScroll: true })` after the scroll settles. Scrolling stays native and un-intercepted otherwise.

- [ ] **Step 5: Wire scroll-spy**

`IntersectionObserver` over the five sections, root margin biased so the viewport centre wins. On change, set `aria-current="true"` on exactly one nav link and remove it from the others.

- [ ] **Step 6: Wire the project filter**

On `[data-filter]` click: read `activeCategory`, call `cardMatchesCategory(cardCategory, activeCategory)` per card, and set/remove the `hidden` **attribute** (not a class) so hidden cards leave the accessibility tree. Update `aria-pressed` on the four buttons. Count visible cards, then write `I18N[lang].filter.result` into `#filter-status` after substituting `{count}` and `{total}`. Toggle `#filter-empty` when the count is zero. Read `#filter-status` and `#filter-empty` copy from the same snapshot restore path as Step 1, so language switching does not strand them.

Also run this filter logic **once on boot** with `all` active. Without it, `#filter-status` is left holding whatever `translateDocument` wrote — the raw `{count} von {total} Projekten` template, with visible braces.

- [ ] **Step 7: Wire the contact form**

`#contact-form` `submit` handler calls `preventDefault()`, then `form.reportValidity()`; on `false`, write `I18N[lang].contact.status` into `#contact-status` and return. On `true`, read the three fields, call `buildMailtoUrl("[name@example.com]", {subject, body})`, and assign `window.location.href`. The message body is the name, subject, and message joined by blank lines. No `fetch`, no storage.

- [ ] **Step 8: Verify manually against spec §9.2 items 3–8**

Keyboard-only pass (Tab order, hamburger, Escape, anchor focus landing, filters, theme, language, form), screen-reader spot check, theme persistence with no flash, language persistence across reload, reduced-motion and prefers-contrast, no-JS render, and the 360/768/1024/1440 px responsive sweep with no horizontal scroll. Also confirm the browser console is error-free on load.

- [ ] **Step 9: Verify the budget**

Run: `Get-Item assets/js/main.js, assets/js/i18n.js | Select-Object Name, Length` and sum.
Expected: combined ≤ 20480 bytes.

- [ ] **Step 10: Commit**

```bash
git add assets/js/main.js
git commit -m "feat: wire language, theme, nav, scroll-spy, filter, and contact form"
```

---

### Task 10: Legal pages

**Files:**
- Create: `impressum.html`
- Create: `datenschutz.html`

**Interfaces:**
- Consumes: the header/footer markup and token set from Tasks 7–8.
- Produces: two German-only pages. Per spec §2.4 they carry the **theme toggle only** — no `#lang-group`, no `#nav-menu`, no filter. `main.js` must not throw when those elements are absent, which is what the `if (element)` guards in Task 9 provide.

- [ ] **Step 1: Create `impressum.html`**

Same `<head>` as `index.html` (including the theme bootstrap script and `main.js`) and the same header markup, minus the language group and nav menu. `<main>` contains a single `<h1>[Impressum]` and placeholder sections referencing DDG § 5: `[Angaben gemäß § 5 DDG]`, `[Name]`, `[Anschrift]`, `[Kontakt]`, `[Verantwortlich für den Inhalt]`. Each is a bracketed placeholder. Footer matches `index.html` but with no `data-i18n` attributes.

- [ ] **Step 2: Create `datenschutz.html`**

Same shell. `<h1>[Datenschutzerklärung]` with `[Verantwortlicher]`, `[Verarbeitete Daten]`, `[Rechtsgrundlage]`, `[Keine Cookies]`, `[Kontakt zur Datenschutzbehörde]`. Add one line of non-placeholder prose stating that this site sets no cookies, no analytics, and no third-party requests — a true and reassuring statement about the shipped build.

- [ ] **Step 3: Validate and verify the theme toggle works on both pages**

Run: `npx html-validate impressum.html datenschutz.html`.
Expected: zero errors. Open each in a browser, toggle the theme, confirm it applies and persists, and confirm the console is error-free.

- [ ] **Step 4: Commit**

```bash
git add impressum.html datenschutz.html
git commit -m "feat: add placeholder Impressum and Datenschutzerklärung pages"
```

---

### Task 11: Maintenance integrity tests

**Files:**
- Create: `tests/maintenance.test.js`

**Interfaces:**
- Consumes: `index.html`, `assets/js/i18n.js`, the key inventory.
- Produces: no runtime exports; guards the invariants that would otherwise rot as placeholders are swapped.

- [ ] **Step 1: Write the failing tests**

Using `node:fs` and `node:path` with `path.join(__dirname, '..')` as the repo root. Assert:

1. Every `data-i18n="..."` value extracted from `index.html` exists in **both** `I18N.en` and `I18N.fr`.
2. Every `I18N.en` key is used somewhere in `index.html` (no dead keys).
3. Every `data-category` value in `index.html` has a matching `[data-filter="..."]` button.
4. Exactly one `<h1>` exists in `index.html`.
5. Every `id` referenced by a `for=` attribute and every `href="#..."` has a matching element `id`.
6. No `href` in `index.html` points at a file under `assets/` that does not exist on disk.
7. `assets/js/main.js` and `assets/js/i18n.js` contain no `http://` or `https://` fetch of an external origin.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test`
Expected: FAIL on at least assertions 1 and 2 — the HTML ships before the dictionaries are fully wired, or a key is mistyped.

- [ ] **Step 3: Fix the HTML or dictionaries until all pass**

Do not weaken an assertion to make it green. If an assertion is genuinely wrong, correct the assertion and say why in the commit body.

- [ ] **Step 4: Run the whole suite**

Run: `node --test`
Expected: PASS — all four unit test files plus maintenance green.

- [ ] **Step 5: Commit**

```bash
git add tests/maintenance.test.js
git commit -m "test: guard i18n key parity and asset link integrity"
```

---

### Task 12: README and final verification

**Files:**
- Create: `README.md` (modify)
- Modify: as needed to fix verification findings

**Interfaces:**
- Consumes: everything built in Tasks 1–11.
- Produces: the user-facing placeholder swap guide (spec §8) and a clean, verified `main`.

- [ ] **Step 1: Write the README swap guide**

Must contain the five procedures from spec §8 in that order, and must state plainly that a placeholder with `data-i18n="hero.name"` lives in **three** places: the German text in `index.html`, `I18N.en`, and `I18N.fr`. Include a worked example: "to change the name, edit `<h1 data-i18n="hero.name">[Vorname Nachname]</h1>`, then `I18N.en["hero.name"]`, then `I18N.fr["hero.name"]`." Also cover: adding a fourth project card, updating the email address in all three places it appears, and the note that the legal pages need legally reviewed text. Add the run instructions: no build step, serve the folder with any static server, run tests with `node --test`.

- [ ] **Step 2: Run the full automated suite**

Run: `node --test`
Expected: PASS, zero failures.

- [ ] **Step 3: Run Lighthouse against a local server**

Serve the folder (`npx http-server . -p 8080`) and run Lighthouse for Accessibility, SEO, Best Practices, Performance.
Expected: ≥ 95 / 95 / 95 / 90. Record the actual numbers. Fix any shortfall before continuing — this is the task most likely to surface real defects.

- [ ] **Step 4: Complete the remaining spec §9.2 checks**

Walk items 3–9 that were not fully covered in Task 9: no-JS render, reduced-motion, prefers-contrast, and the 360/768/1024/1440 px sweep with no horizontal scroll.

- [ ] **Step 5: Verify every budget in spec §7**

Run: `Get-ChildItem -Recurse index.html, impressum.html, datenschutz.html, assets | Select-Object FullName, Length`.
Expected: every figure at or under its §7 budget, and zero third-party requests in the network panel.

- [ ] **Step 6: Commit the README and any fixes**

```bash
git add -A
git commit -m "docs: add placeholder replacement guide"
```

- [ ] **Step 7: Push**

```bash
git push -u origin main
```

Expected: `main` tracks `origin/main` with no rejection. If push fails on authentication, stop and report it rather than switching to a token or rewriting history.