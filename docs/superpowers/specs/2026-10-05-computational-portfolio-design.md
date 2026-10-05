# Computational Portfolio — Design Specification

Date: 2026-10-05
Status: Approved for planning
Repository: `computational-portfolio` (empty, single initial commit)

## 1. Purpose and success criteria

Build a static, dependency-free personal portfolio website for an aspiring engineer in
computational engineering and software development. Every piece of content is a generic
placeholder so the whole site can be re-skinned with real content later without touching
markup structure or CSS.

Success means:

1. A recruiter opening the URL sees name, focus, projects, and contact path within one
   scroll, with no interaction required.
2. A crawler or Applicant Tracking System reading the raw HTML receives all meaningful
   text as static markup. Content must be present without JavaScript execution.
3. The site is deployable to GitHub Pages by pushing to `main` — no build step, no
   bundler, no package manager, no external CDN.
4. A non-technical person can swap every placeholder by following `README.md` alone.
5. Accessibility: keyboard-operable throughout, WCAG 2.1 AA contrast in both themes,
   screen-reader-labelled controls.

Non-goals for v1: blog, CMS, contact-form backend, analytics, view counters, comment
system, project detail sub-pages, PDF generation pipeline.

## 2. Key decisions

### 2.1 Stack: vanilla HTML5 / CSS / JavaScript

No framework, no Tailwind, no Astro. Rationale: GitHub Pages serves static files, the site
has no server component, and a zero-dependency repo cannot break from an upstream release.

* No build step. Edit a file, refresh.
* Total transfer weight target: under 60 KB uncompressed for the landing page.
* System font stack only. No webfont requests.

### 2.2 Structure: one-pager with anchor navigation

All portfolio content lives on `index.html` as sequential `<section>` elements. The
navigation is an in-page anchor list with smooth scrolling and scroll-spy.

Two additional pages exist for legal reasons only, because German law requires them to be
stably and directly reachable — not behind a section anchor or a footer-only link:

* `impressum.html`
* `datenschutz.html`

These are deliberately plain: a shared header with the theme toggle only, a single `<main>`
of placeholder legal copy, and a link back to the portfolio. They are **German-only for v1**
and carry **no language toggle** (see 2.4).

### 2.3 Internationalisation: Approach A (static German HTML + dictionary swap)

Three languages: German (default), English, French. A `DE | EN | FR` toggle sits in the
header, right-aligned next to the theme toggle, and its state is persisted.

Approach A, chosen deliberately:

* `index.html` contains **real German text** as the content of every translatable element.
* Each such element carries a `data-i18n="<key>"` attribute naming its translation key.
* `assets/js/i18n.js` holds the German, English, and French strings for those keys.
* On load and on every language switch, `main.js` walks all `[data-i18n]` elements and sets
  their `textContent` from the active language dictionary.

Consequences accepted knowingly:

* A placeholder must be replaced in **two** places: the German text in `index.html` and
  the `en` / `fr` entries in `i18n.js`. `README.md` documents this as a single repeatable
  procedure.
* The `de` dictionary is **optional and normally omitted**. When the active language is `de`
  — or when a key is absent from the active dictionary — the German HTML text stands. This
  removes the duplication concern while keeping the fallback behaviour.
* With JavaScript disabled the site renders complete and correct in German.
* Search engines and ATS scrapers read the full German content from the raw HTML.
* An element whose key is missing from the active dictionary keeps its German HTML text
  rather than blanking out. Missing translations degrade gracefully instead of producing
  empty sections.

`data-i18n` is applied to text-bearing leaf elements only — never to elements that contain
markup, since `textContent` assignment would destroy child nodes. Multi-line or mixed-content
strings are not supported; if a translation needs emphasis, it uses a separate element with
its own key.

### 2.4 Legal pages: German only

`impressum.html` and `datenschutz.html` are German-only in v1. They carry placeholder
copy referencing DDG § 5 and DSGVO/GDPR as structure hints, not legal advice. Since the
final text will be replaced with a legally reviewed version, translating placeholder legal
copy is wasted effort.

Because a language toggle that cannot change the page body reads as broken, the language
toggle is **omitted from the legal pages**. They keep the theme toggle, so the site stays
visually consistent across all three pages. This is the authoritative rule for the legal
pages' control set.

### 2.5 Theme: CSS custom properties, `data-theme` on `<html>`

Light and dark themes are two token sets on `:root` / `[data-theme="dark"]`. Choice is
persisted in `localStorage` under `portfolio-theme`. An inline `<script>` in `<head>` reads
that key and sets `data-theme` before first paint, so there is no flash of the wrong theme.
When no stored preference exists, the OS preference (`prefers-color-scheme`) wins.

### 2.6 Contact form: `mailto:` bridge, no backend

GitHub Pages cannot receive form submissions and no third-party form service will be added
(they would conflict with the no-tracking stance of a German privacy-compliant site). The
contact section therefore presents a mailto button as the primary action, plus a small form
whose submit handler composes a `mailto:` URL with prefilled subject and body and hands it to
the visitor's mail client. The form performs no network request and stores nothing.

### 2.7 Icons: inline SVG

All icons are hand-authored inline SVG in the markup, using `currentColor` so they inherit
theme. No icon font, no sprite sheet, no icon library. Icons inherit accessible names from
the surrounding link or button text; genuinely icon-only controls get `aria-label`.

## 3. File layout

```
computational-portfolio/
├── index.html                     one-pager, all portfolio sections, German content
├── impressum.html                 placeholder legal notice (German only)
├── datenschutz.html               placeholder privacy policy (German only)
├── README.md                      placeholder replacement guide (user-facing)
├── assets/
│   ├── css/
│   │   └── style.css              design tokens, layout, components (single stylesheet)
│   ├── js/
│   │   ├── i18n.js                translation dictionary for de / en / fr
│   │   └── main.js                theme, language, nav, scroll-spy, filter, form
│   ├── img/
│   │   ├── project-1.svg          placeholder project artwork
│   │   ├── project-2.svg
│   │   ├── project-3.svg
│   │   ├── og-image.svg           social preview placeholder
│   │   └── favicon.svg
│   └── pdf/
│       └── resume_placeholder.pdf  placeholder CV, valid PDF, ~5 KB
└── docs/
    └── superpowers/specs/
        └── 2026-10-05-computational-portfolio-design.md
```

Deliberately **not** split: the stylesheet stays one file (a single stylesheet cannot
conflict and the total is well under budget), and `main.js` stays one file (its features
share one DOM-ready entry point and are individually small).

### 3.1 CSS layer order

`style.css` is organised in this order so a reader can predict where a rule lives:

1. `@charset` / design tokens (`:root`, `[data-theme="dark"]`)
2. Reset and base element styles
3. Layout primitives (`.container`, `.section`, grid helpers)
4. Components (header, hero, cards, badges, buttons, footer)
5. Utilities and motion
6. `@media` responsive refinements
7. `prefers-reduced-motion` and `prefers-contrast` overrides

Token names follow a `category-property` convention: `--color-bg`, `--color-surface`,
`--color-text`, `--color-muted`, `--color-accent`, `--color-accent-contrast`,
`--color-border`, `--space-1..8`, `--radius-sm/md/lg`, `--font-sans`, `--font-mono`,
`--text-sm/base/lg/xl/3xl`, `--shadow-1/2`, `--container`, `--header-h`.

Dark theme re-points colour tokens only. Spacing, radius, and type tokens are shared, which
is what makes the two themes stay visually consistent.

## 4. Content inventory and placeholder keys

Every user-visible string below is a placeholder in square brackets. This table is the
contract for what must exist and where; `README.md` will reproduce it as a swap checklist.

### 4.1 Hero

| Element | Placeholder | i18n key |
| --- | --- | --- |
| Name (h1) | `[Vorname Nachname]` | `hero.name` |
| Role line | `[Computational Engineer \| Numerical Simulation & Scientific Computing]` | `hero.role` |
| Availability | `[Verfügbar ab Monat Jahr]` | `hero.availability` |
| Intro sentence | `[Ein kurzer Satz dazu, was ich baue und womit.]` | `hero.intro` |
| CTA primary | `[Projekte ansehen]` | `hero.cta.projects` |
| CTA secondary | `[Kontakt aufnehmen]` | `hero.cta.contact` |
| CV download | `[Lebenslauf herunterladen]` | `hero.cta.resume` |

CV button targets `assets/pdf/resume_placeholder.pdf` with `download` attribute.

### 4.2 Über mich

Two paragraphs plus a three-item stat row.

| Element | Placeholder | i18n key |
| --- | --- | --- |
| Heading | `[Über mich]` | `about.heading` |
| Paragraph 1 — theory | `[Studium, Schwerpunkte, theoretische Grundlagen.]` | `about.p1` |
| Paragraph 2 — practice | `[Praktische Methoden, Werkzeuge, Erfahrung.]` | `about.p2` |
| Stat 1 / 2 / 3 | `[X] Jahre Erfahrung`, `[Y] Projekte`, `[Z] Simulationen` | `about.stat1..3` |

### 4.3 Kernkompetenzen

Four cards, each with a title, one-line description, and tag badges.

| Card | Title key | Tags (placeholders) |
| --- | --- | --- |
| 1 | `skills.simulation.title` | `[Finite-Elemente-Methode]`, `[CFD]`, `[FEM/FVM]`, `[Numerische Integration]` |
| 2 | `skills.languages.title` | `[Python]`, `[C++]`, `[MATLAB]`, `[SQL]` |
| 3 | `skills.tools.title` | `[OpenFOAM]`, `[Ansys]`, `[Git]`, `[Docker]`, `[CI/CD]` |
| 4 | `skills.vcs.title` | `[Git]`, `[GitHub Actions]`, `[Semantic Versioning]`, `[Code-Review]` |

Each badge is a `<li>` inside a `<ul>`, not a bare `<span>`, so assistive technology
announces list cardinality.

### 4.4 Projekte

Filter row of four `<button>` elements, then three `<article>` cards.

Filter categories are fixed: `all`, `simulation`, `optimization`, `web`. Keys:
`filter.all`, `filter.simulation`, `filter.optimization`, `filter.web`.

Each project card contains:

| Element | Placeholder | i18n key |
| --- | --- | --- |
| Image | `assets/img/project-N.svg` | — (decorative, `alt=""`) |
| Category chip | `[Simulation]` | per-project key |
| Title | `[Projekt 1: Titel]` | `project1.title` |
| Problem | `[Welches Problem wurde gelöst?]` | `project1.problem` |
| Method | `[Verwendete Methodik]` | `project1.method` |
| Tech tags | `[Python]`, `[NumPy]`, `[VTK]` | per-project keys |
| Repo link | `[Repository ansehen]` | `project1.repo` |
| Demo link | `[Live-Demo ansehen]` | `project1.demo` |

Project → category mapping for v1:

| Card | Category | Category chip key |
| --- | --- | --- |
| Project 1 | `simulation` | `project1.category` |
| Project 2 | `simulation` | `project2.category` |
| Project 3 | `optimization` | `project3.category` |

The `web` category exists in the filter with no matching card in v1; the section renders an
empty-state message when a filter matches nothing. This is intentional — the filter must be
proven to handle the empty case before real content arrives.

### 4.5 Forschung und Veröffentlichungen

Two entries, each an `<article>` with title, institution, year, three-line clamped abstract,
and a download button.

| Element | Placeholder | i18n key |
| --- | --- | --- |
| Heading | `[Forschung & Veröffentlichungen]` | `research.heading` |
| Entry 1 title | `[Titel der Abschlussarbeit]` | `research.1.title` |
| Entry 1 abstract | `[Kurzfassung, etwa 40 Wörter.]` | `research.1.abstract` |
| Entry 1 download | `[PDF herunterladen]` | `research.1.download` |
| Entry 2 | same shape | `research.2.*` |

Download buttons point at `assets/pdf/` placeholder PDFs. Abstract clamping uses
`-webkit-line-clamp` with a standard `max-height` fallback.

### 4.6 Kontakt

| Element | Placeholder | i18n key |
| --- | --- | --- |
| Heading | `[Kontakt]` | `contact.heading` |
| Lead | `[Am einfachsten erreichbar ich per E-Mail.]` | `contact.lead` |
| Mailto button | `[E-Mail schreiben]` | `contact.emailBtn` |
| Form name / subject / message | `[Dein Name]`, `[Betreff]`, `[Deine Nachricht]` | `contact.name`, `contact.subject`, `contact.message` |
| Submit | `[Nachricht per E-Mail vorbereiten]` | `contact.submit` |
| GitHub / LinkedIn | `[GitHub]`, `[LinkedIn]` | `contact.github`, `contact.linkedin` |

Email address and both profile URLs are placeholders `[name@example.com]`,
`https://github.com/[username]`, `https://linkedin.com/in/[username]`. All external links
carry `rel="noopener noreferrer"` and `target="_blank"`.

### 4.7 Footer

Copyright `[© [Jahr] [Vorname Nachname]]`, plus links to `impressum.html` and
`datenschutz.html` with keys `footer.imprint` and `footer.privacy`.

### 4.8 Document head

Shared by all three pages, present in markup rather than injected:

| Element | Value |
| --- | --- |
| `<meta charset>` | `utf-8` |
| `<meta name="viewport">` | `width=device-width, initial-scale=1` |
| `<meta name="description">` | German text, `data-i18n="meta.description"`, keys `meta.title` / `meta.description` translate it |
| `<title>` | German text, `data-i18n="meta.title"` |
| `<link rel="icon">` | `assets/img/favicon.svg`, `type="image/svg+xml"` |
| `<meta property="og:title">` / `og:description` / `og:image` | German text via `meta.title` / `meta.description`; image `assets/img/og-image.svg` |
| `<meta property="og:type">` | `website` |
| Theme bootstrap | inline `<script>` setting `data-theme` before paint |

`<meta name="description">` and `<title>` use `data-i18n` keys that `main.js` writes to the
element's `content` / `textContent` respectively, since those two are not text nodes in a
way `textContent` alone would reach. `og:*` tags are left German-only in v1: social scrapers
do not execute the page's JavaScript, so a JS-translated `og:description` would never be seen.
That is correct behaviour, not a gap.

## 5. Component behaviour

### 5.1 Header and navigation

* Sticky at top, `backdrop-filter: blur()` with a semi-transparent surface, hairline bottom
  border that appears only after 8 px of scroll.
* Anchor links: `#about`, `#skills`, `#projects`, `#research`, `#contact`.
* Active link is marked with `aria-current="true"` and an underline indicator, driven by an
  `IntersectionObserver` on the sections with a root margin that biases toward the viewport
  centre. The observer's most-visible intersecting section wins; ties break toward the
  section further down the document.
* Below 860 px the links collapse behind a hamburger `<button>` with
  `aria-expanded`/`aria-controls`. Opening the menu sets `inert` on the rest of the document
  so Tab cannot escape into hidden content, and Escape closes it.
* Skip-to-content link is the first focusable element and becomes visible on focus.

### 5.2 Language switch

* Three buttons in a `role="group"` labelled `Sprache / Language / Langue` via `aria-label`.
* The active language button carries `aria-pressed="true"` and is visually emphasised; the
  other two are `aria-pressed="false"`.
* Switching sets `<html lang="de|en|fr">`, replaces `textContent` of every `[data-i18n]`
  element, and writes `localStorage["portfolio-lang"]`.
* `<title>` and `<meta name="description">` are also translated, via dedicated keys
  `meta.title` and `meta.description`.
* No full page reload. The URL is not changed; language state lives in `localStorage`.
  Deep-linking to a language is out of scope for v1.

### 5.3 Theme switch

* A single `<button>` toggling light/dark, `aria-pressed` reflects the dark state, the
  visible label is an inline SVG sun/moon pair selected by CSS, and `aria-label` names the
  *action to take next*, not the current state — `theme.toDark` while light is active,
  `theme.toLight` while dark is active. Because the label changes with both theme and
  language, it starts as a German `aria-label` in markup and is rewritten by `main.js` on
  both state changes.
* Persists to `localStorage["portfolio-theme"]` as `"light"` or `"dark"`.
* The head inline script resolves the initial theme: stored value, else
  `prefers-color-scheme: dark`, else light.

### 5.4 Project filter

* Buttons, not a `<select>`; each carries `aria-pressed`.
* Selecting a category sets `hidden` on every non-matching card and removes it from matching
  ones. `hidden` (not `display:none` via a class) is used so assistive technology drops the
  cards from the tree.
* The live region announces the result count, e.g. `filter.result` with a count argument:
  `"1 von 3 Projekten"`.
* If zero cards match, a styled empty-state block appears with key `filter.empty`.
* `all` restores every card.

### 5.5 Contact form

* Fields: name (text, required), subject (text, required), message (textarea, required).
  Labels are real `<label for>` elements, not placeholders.
* Submit handler calls `preventDefault()`, validates via `form.reportValidity()`, then builds
  `mailto:[name@example.com]?subject=...&body=...` with `encodeURIComponent` applied to the
  field values, and assigns it to `window.location.href`.
* Invalid fields get the native browser validation UI; a visually hidden status region
  receives a translated message on failed validation so the failure is announced.
* No `fetch`, no storage of message content.

### 5.6 Scroll behaviour

* `scroll-behavior: smooth` on `html`, disabled inside a `prefers-reduced-motion: reduce`
  media query.
* Anchor scrolling is native — no JS scroll interception and no custom easing.
* `scroll-margin-top` on each `section` equals `var(--header-h)` plus a gap so headings are
  never hidden under the sticky header.
* Because `:target` moves the viewport but not focus, a single click handler on the nav
  anchor list calls `preventDefault()` **only** to move focus: it sets `tabindex="-1"` on
  the target `section` and calls `.focus({ preventScroll: true })` after the smooth scroll
  settles. Without it, keyboard and screen-reader users land mid-page with focus still on
  the nav link.

## 6. Accessibility requirements

* One `<h1>` per page; heading levels descend without skipping.
* Landmarks: `header`, `nav`, `main`, `footer`, plus `aria-labelledby` on every `<section>`.
* All interactive controls reachable and operable by keyboard, with a visible focus indicator
  of at least 2 px and 3:1 contrast against its background.
* Body text contrast ≥ 4.5:1; large text and UI borders ≥ 3:1 — verified in both themes.
* Colour is never the sole carrier of meaning: the filter's active state is conveyed by
  `aria-pressed`, an underline, and a weight change, not colour alone.
* Decorative SVG is `aria-hidden="true"`; meaningful images get real `alt` text. Project
  placeholder images are decorative because the adjacent heading carries the title.
* Status changes (filter counts, validation failures) go through `aria-live="polite"`.
* `prefers-reduced-motion: reduce` removes smooth scrolling and all transitions.
* Language of content is set on `<html>` and switches with the UI language; German copy is
  marked `lang="de"` explicitly where the page language differs.

## 7. Performance budget

| Item | Budget |
| --- | --- |
| `index.html` | ≤ 40 KB |
| `style.css` | ≤ 20 KB |
| `main.js` + `i18n.js` | ≤ 20 KB combined |
| Each SVG | ≤ 5 KB |
| `resume_placeholder.pdf` | ≤ 10 KB |
| Third-party requests | 0 |

No fonts, no images other than the SVG placeholders, no analytics, no CDN, no polyfills.
Modern-baseline JavaScript only (`IntersectionObserver`, `localStorage`, optional chaining) —
no transpilation, targeting evergreen browsers.

## 8. Placeholder swap procedure

`README.md` must let a non-technical user replace everything, and must state plainly:

1. **Single-language content** (nav labels, footer, headings) lives only in `index.html` plus
   the `de`/`en`/`fr` entries in `i18n.js`.
2. **Multi-language content** requires editing German text in `index.html` *and* the three
   dictionaries in `i18n.js`, keyed by the `data-i18n` attribute of the same element. The
   key is the contract; grep the key to find all three translations at once.
3. **Project cards** are static markup: to add a fourth project, copy an existing
   `<article>`, give it a new `data-category`, add `project4.*` keys to all three
   dictionaries, and add a new SVG.
4. **Personal data** (name, email, GitHub/LinkedIn URLs, availability date) lives in Hero,
   Kontakt, and Footer — all three must be updated together so the footer credit matches the
   hero name.
5. **Legal pages** require legally reviewed text; the shipped copy is structure only.

## 9. Verification plan

No test framework ships with the repo. Verification is manual and scripted, not automated CI:

1. `npx html-validate` on the three HTML files — zero errors. Ad-hoc tooling only; see §10.
2. Lighthouse against a local static server — Accessibility, SEO, Best Practices ≥ 95;
   Performance ≥ 90.
3. Keyboard-only pass: Tab order from page load, hamburger open/close, Escape, filter
   toggling, theme toggle, language toggle, form submit. No focus trap outside the mobile
   menu, no invisible focus targets.
4. Screen-reader spot check (NVDA or VoiceOver) on: hero, filter group, project grid,
   research list, contact form.
5. Theme: toggle, reload, confirm persistence; confirm no flash of light theme on reload;
   confirm OS preference applies on first visit with empty `localStorage`.
6. Language: switch DE→EN→FR, confirm `<html lang>` updates, `aria-label`s and `<title>`
   translate, and a reload restores the choice.
7. `prefers-reduced-motion: reduce` and `prefers-contrast: more` — confirm transitions are
   dropped and borders strengthen.
8. No-JS test: disable JavaScript, confirm full German content renders, nav anchors work,
   theme stays on the default.
9. Responsive check at 360, 768, 1024, 1440 px — no horizontal scroll at any width.
10. Confirm total page weight against §7 and confirm zero third-party requests.

## 10. Resolved implementation choices

Recorded here so implementation does not reopen them:

* **Palette.** Accent is a single hue reused in both themes at different lightness/chroma
  steps; surfaces are a neutral grey ramp. Exact values are picked during implementation to
  clear 4.5:1 body-text contrast in both themes, verified by the Lighthouse pass in §9. If a
  chosen accent cannot clear 4.5:1 on the surface in one theme, it is darkened/lightened
  rather than the contrast requirement being relaxed.
* **Hero backdrop.** Pure CSS: a radial-gradient mesh layered over a faint 32 px grid drawn
  with `repeating-linear-gradient`. No canvas, no SVG mesh, no animation.
* **`resume_placeholder.pdf`.** A minimal hand-authored single-page PDF containing one line of
  placeholder text, committed as a real binary file. It must open in a standard viewer
  without error, since the download button is a shipped feature.
* **Reduced-motion scope.** The reduced-motion override removes `scroll-behavior: smooth`,
  all `transition-duration`, and all `animation`. It does not remove state changes.
* **`html-validate`.** Used only as an ad-hoc `npx` check during verification. It is not a
  project dependency, no `package.json` is created, and nothing in the repo depends on it.