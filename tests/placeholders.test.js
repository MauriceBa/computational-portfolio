/* Placeholder sweep.
 *
 * Earlier this suite asserted the opposite: that every content value still
 * carried square brackets, marking it as unfinished. That was the right check
 * while the site was a template. Now that real content has landed, the useful
 * invariant is the inverse -- nothing may still look like a placeholder, because
 * a leftover "[Vorname Nachname]" ships to a recruiter exactly like real text
 * does and nobody catches it in review.
 *
 * A bracket alone is not a defect: `[Project 1]` is legitimate copy. What is a
 * defect is a bracket combined with a placeholder marker word, or a value that
 * is *only* a marker. Those are listed explicitly below.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { I18N } = require("../assets/js/i18n.js");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const html = read("index.html");
const impressum = read("impressum.html");
const datenschutz = read("datenschutz.html");
const mainJs = read("assets/js/main.js");

/* Marker words that only ever appeared inside a placeholder. A value carrying
 * one of these is unfinished, whatever brackets it does or does not have. */
const MARKERS = [
  "Vorname", "Nachname", "First Last", "Prénom Nom",          // name
  "name@example", "[username]", "[repo]",                      // contact / profiles
  "Monat Jahr", "Month Year", "mois année",                    // availability
  // NB: "Lebenslauf herunterladen" is the real German CV button label, not a
  // placeholder. Only the bracketed form was ever a placeholder.
  "[Projekt", "Projekt 1", "Projekt 2", "Projekt 3",            // project titles
  "Project 1", "Project 2", "Project 3",
  "Titel der Abschluss", "Titel des Berichts", "Titel du mémoire",
  "Title of the thesis", "Titre du mémoire",
  "Kurzfassung, etwa", "Résumé, environ", "Summary, roughly",
  "Hochschule]", "Université]", "Établissement]",
  "Platzhalter", "placeholder document"
];

/* Deliberate exceptions: text that is still bracketed on purpose.
 *
 * The postal address is the one thing that cannot be filled in without the
 * person it belongs to. German law requires a physical address in the Impressum,
 * and inventing one would be worse than leaving a visible marker: a wrong
 * address in a legal notice is a real problem, an obviously unfinished one is
 * just unfinished. Everything here needs a lawyer's review before publishing
 * anyway, which is called out in the README. */
const ALLOWED_REMAINING = new Set([
  "[Straße und Hausnummer]",
  "[Straße, Hausnummer, PLZ Ort]",
  "[PLZ Ort]",
  "[Telefonnummer]",
  "[Die vollständigen Anbieterangaben nach § 5 DDG sind vor der Veröffentlichung zu ergänzen und anwaltlich zu prüfen.]",
  "[Dieser Text ist noch unvollständig. Die Verantwortlichen- und Aufsichtsbehördenangaben sind vor der Veröffentlichung zu ergänzen und anwaltlich zu prüfen.]"
]);

function assertNoMarkers(label, text) {
  // Report the bracketed leftovers verbatim, not as a marker-word match, so the
  // allowlist reads as an inventory of what is genuinely still outstanding.
  const leftovers = [...new Set([...text.matchAll(/\[([^\]]{2,80})\]/g)].map((m) => m[1]))]
    .filter((inner) => !ALLOWED_REMAINING.has(`[${inner}]`));

  const found = MARKERS.filter((m) => text.includes(m));
  assert.deepEqual(found, [], `${label} still contains marker words: ${found.join(", ")}`);
  assert.deepEqual(leftovers, [], `${label} still contains unexpected placeholders: ${leftovers.join(", ")}`);
}

test("no placeholder markers survive in the German source of truth", () => {
  assertNoMarkers("index.html", html);
});

test("no placeholder markers survive in the legal pages", () => {
  assertNoMarkers("impressum.html", impressum);
  assertNoMarkers("datenschutz.html", datenschutz);
});

test("no placeholder markers survive in the dictionaries", () => {
  for (const lang of ["en", "fr"]) {
    for (const [key, value] of Object.entries(I18N[lang])) {
      const found = MARKERS.filter((m) => value.includes(m));
      assert.deepEqual(found, [], `I18N.${lang}["${key}"] still contains: ${found.join(", ")}`);
    }
  }
});

test("the contact address is real and consistent everywhere", () => {
  const EMAIL = "contact@mauricebastard.de";
  const occurrences = [
    html, impressum, datenschutz, mainJs
  ].map((src) => src.split(EMAIL).length - 1);

  assert.ok(
    occurrences.reduce((a, b) => a + b, 0) >= 5,
    `expected the address in all 5 former placeholder slots, found ${occurrences}`
  );

  for (const [i, src] of [html, impressum, datenschutz, mainJs].entries()) {
    assert.equal(
      src.includes("[name@example.com]"), false,
      `file ${i} still contains the old address placeholder`
    );
  }

  // main.js is the one place the address is behavioural rather than markup, so
  // a stale copy there breaks the contact form silently.
  assert.match(mainJs, /contact@mauricebastard\.de/);
});

test("project cards only link to things that actually exist", () => {
  // The GitHub *profile* is a real, working page and stays. What must not exist
  // is any repository or demo link: the simulation work is internal, and a card
  // pointing at a private or nonexistent repo is worse than no link at all.
  const repoLinks = [...html.matchAll(/href="(https:\/\/github\.com\/[^"]*\/)"/g)].map((m) => m[1]);
  assert.deepEqual(repoLinks, [], "project repo links must not exist for internal work");

  assert.ok(
    html.includes('href="https://github.com/MauriceBa"'),
    "the GitHub profile link is missing"
  );
  assert.ok(
    html.includes('href="https://www.linkedin.com/in/maurice-bastard-658ba7161"'),
    "the LinkedIn profile link is missing"
  );

  // The one external link that does exist.
  assert.ok(
    html.includes("https://doi.org/10.1016/j.cherd.2026.06.054"),
    "the DOI link for the journal publication is missing"
  );
});

test("internal work has no download button, so no button points at a placeholder PDF", () => {
  const pdfLinks = [...html.matchAll(/href="(assets\/pdf\/[^"]*)"/g)].map((m) => m[1]);

  // Only the CV remains downloadable; the thesis and report were pulled back.
  assert.deepEqual(pdfLinks, ["assets/pdf/resume_placeholder.pdf"]);
});

test("the German text and the dictionaries agree on the person's name", () => {
  const NAME = "Maurice Bastard";

  assert.ok(html.includes(NAME), "index.html must contain the real name");
  assert.equal(I18N.en["hero.name"], NAME);
  assert.equal(I18N.fr["hero.name"], NAME);

  // A single h1, so a stale name cannot hide in a second heading.
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
});
