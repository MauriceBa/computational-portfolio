/* Integrity guards. These do not test behaviour -- they test that the pieces
 * still line up with each other, which is exactly what breaks when someone swaps
 * a placeholder or adds a project card. */

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

const matchAll = (src, re) => [...src.matchAll(re)].map((m) => m[1]);
const diff = (a, b) => [...a].filter((x) => !b.has(x)).sort();

/* Dictionary keys written by main.js at runtime. They have no markup to hang
 * off, so "every key must appear in the HTML" would be wrong for them. */
const RUNTIME_ONLY_KEYS = new Set([
  "filter.result",
  "nav.close",
  "nav.menu",
  "theme.toDark",
  "theme.toLight",
  "contact.status"
]);

test("every data-i18n key used in index.html exists in both dictionaries", () => {
  const used = new Set(matchAll(html, /data-i18n="([^"]+)"/g));
  assert.ok(used.size > 50, "expected a substantial number of translated elements");

  for (const key of used) {
    assert.ok(key in I18N.en, `I18N.en is missing ${key}`);
    assert.ok(key in I18N.fr, `I18N.fr is missing ${key}`);
  }
});

test("no dictionary key is dead: each is used in the HTML or is runtime-only", () => {
  const used = new Set(matchAll(html, /data-i18n="([^"]+)"/g));

  for (const lang of ["en", "fr"]) {
    for (const key of Object.keys(I18N[lang])) {
      const ok = used.has(key) || RUNTIME_ONLY_KEYS.has(key);
      assert.ok(ok, `I18N.${lang}["${key}"] is neither used in index.html nor runtime-only`);
    }
  }
});

test("the projects section has no category or filter machinery left", () => {
  // Superseded by tests/projects.test.js, which asserts the same thing plus the
  // card count. Kept here as a cheap regression against the filter creeping back.
  assert.equal(html.includes("data-category="), false, "data-category must not reappear");
  assert.equal(html.includes("data-filter="), false, "data-filter must not reappear");
  assert.ok(
    !matchAll(html, /data-i18n="(filter\.[^"]+)"/g).length,
    "a filter.* translation key is still referenced from the markup"
  );
});

test("index.html has exactly one h1", () => {
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
});

test("every for= and href=# resolves to an existing id", () => {
  const ids = new Set(matchAll(html, /\sid="([^"]+)"/g));

  for (const ref of matchAll(html, /\sfor="([^"]+)"/g)) {
    assert.ok(ids.has(ref), `label for="${ref}" has no matching id`);
  }
  for (const ref of matchAll(html, /href="#([^"]+)"/g)) {
    assert.ok(ids.has(ref), `anchor href="#${ref}" has no matching id`);
  }
});

test("every local asset referenced from any page exists on disk", () => {
  for (const file of ["index.html", "impressum.html", "datenschutz.html"]) {
    const src = read(file);
    for (const asset of matchAll(src, /(?:href|src)="(assets\/[^"]+)"/g)) {
      assert.ok(fs.existsSync(path.join(ROOT, asset)), `${file} references missing ${asset}`);
    }
  }
});

test("no script or stylesheet is loaded from an external origin", () => {
  for (const file of ["index.html", "impressum.html", "datenschutz.html"]) {
    const src = read(file);
    const remote = [
      ...matchAll(src, /<script[^>]*src="(https?:\/\/[^"]+)"/g),
      ...matchAll(src, /<link[^>]*href="(https?:\/\/[^"]+)"/g)
    ];
    assert.deepEqual(remote, [], `${file} loads remote assets: ${remote.join(", ")}`);
  }
});

test("main.js fetches nothing over the network", () => {
  const src = read("assets/js/main.js");
  for (const forbidden of ["fetch(", "XMLHttpRequest", "navigator.sendBeacon", "EventSource"]) {
    assert.equal(src.includes(forbidden), false, `main.js must not use ${forbidden}`);
  }
});

test("every external link is safe against reverse tabnabbing", () => {
  for (const file of ["index.html", "impressum.html", "datenschutz.html"]) {
    const src = read(file);
    for (const tag of src.match(/<a\b[^>]*>/g) || []) {
      if (!/target="_blank"/.test(tag)) continue;
      assert.match(tag, /rel="[^"]*noopener/, `${file}: target=_blank without noopener`);
      assert.match(tag, /rel="[^"]*noreferrer/, `${file}: target=_blank without noreferrer`);
    }
  }
});

test("data-i18n never lands on an element that has child markup", () => {
  // translateDocument writes with textContent, which destroys child nodes. So a
  // translated element must be a leaf. An opening-tag regex alone cannot tell a
  // leaf from a parent, so pair each opening tag with its closing tag and look
  // at what is actually inside.
  const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"]);

  const openings = html.match(/<[a-zA-Z][^>]*\sdata-i18n="[^"]*"[^>]*>/g) || [];
  assert.ok(openings.length > 50, "expected to inspect a substantial number of elements");

  const offenders = [];

  for (const opening of openings) {
    // An element that also declares data-i18n-attr is written with setAttribute,
    // which never touches children -- so only bare text keys are constrained.
    if (/data-i18n-attr=/.test(opening)) continue;

    const name = opening.match(/^<([a-zA-Z][a-zA-Z0-9]*)/)[1];

    if (VOID.has(name)) {
      // A void element has no text node to replace; only an attribute write makes sense.
      if (!/data-i18n-attr=/.test(opening)) {
        offenders.push(`${name} is void but carries a text data-i18n`);
      }
      continue;
    }

    // Match THIS opening tag up to its own closing tag. Anchoring on the
    // opening tag's position matters: a name-based regex would keep matching
    // the first <button> on the page and report its children against every
    // later button that also carries data-i18n.
    const start = html.indexOf(opening);
    const closeTag = `</${name}>`;
    const end = html.indexOf(closeTag, start + opening.length);

    if (start < 0 || end < 0) {
      offenders.push(`<${name}> with data-i18n could not be paired with a closing tag`);
      continue;
    }

    const content = html.slice(start + opening.length, end);

    if (content.includes("<")) {
      offenders.push(`<${name}> with data-i18n contains child markup: ${content.slice(0, 60)}`);
    }
  }

  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("the legal pages omit the language group and nav menu but keep the theme toggle", () => {
  for (const [name, src] of [["impressum.html", impressum], ["datenschutz.html", datenschutz]]) {
    assert.equal(src.includes("data-lang"), false, `${name} must not offer a language switch`);
    assert.equal(src.includes('id="nav-menu"'), false, `${name} must not ship the section nav`);
    assert.match(src, /id="theme-toggle"/, `${name} must keep the theme toggle`);
  }
});

test("all three pages set a theme before paint", () => {
  for (const [name, src] of [["index.html", html], ["impressum.html", impressum], ["datenschutz.html", datenschutz]]) {
    const head = src.slice(0, src.indexOf("</head>"));
    assert.match(head, /localStorage\.getItem\("portfolio-theme"\)/, `${name}: no pre-paint theme script`);
    assert.match(head, /dataset\.theme/, `${name}: theme never applied to <html>`);
  }
});

test("headings descend without skipping a level", () => {
  for (const [name, src] of [["index.html", html], ["impressum.html", impressum], ["datenschutz.html", datenschutz]]) {
    const levels = [...src.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    assert.ok(levels.length > 0, `${name} has no headings`);
    let previous = levels[0];
    for (const level of levels) {
      assert.ok(level <= previous + 1, `${name} jumps from h${previous} to h${level}`);
      previous = level;
    }
  }
});

// ---- Review findings: regression guards ----

test("every section heading uses its own .heading key, not a card title key", () => {
  // Regression: the Kernkompetenzen <h2> was bound to skills.simulation.title,
  // the same key as the first card's <h3>. German was unaffected only because
  // there is no de dictionary, so EN/FR rendered the section heading as
  // "[Simulation methods]".
  const headings = [...html.matchAll(/<h2[^>]*class="section__title"[^>]*>/g)].map((m) => m[0]);
  assert.ok(headings.length >= 4, `expected the section headings, found ${headings.length}`);

  const cardTitles = new Set(matchAll(html, /<h3[^>]*data-i18n="([^"]+)"/g));

  for (const heading of headings) {
    const key = heading.match(/data-i18n="([^"]+)"/)[1];
    assert.match(key, /\.heading$/, `section heading key "${key}" should end in .heading`);
    assert.ok(!cardTitles.has(key), `section heading "${key}" is shared with a card title`);
  }
});

test("every data-i18n key binds to exactly one distinct meaning", () => {
  // A key may legitimately appear on several elements (hero.name is both the
  // header brand and the h1). What must never happen is one key serving two
  // different element *types* with different content -- that silently swaps
  // unrelated strings when translated.
  const byKey = new Map();
  for (const m of html.matchAll(/<(h1|h2|h3|h4|p|li|dt|span|div|title|a|button)\b([^>]*\sdata-i18n="([^"]+)"[^>]*)>/g)) {
    const [, tag, , key] = m;
    if (!byKey.has(key)) byKey.set(key, new Set());
    byKey.get(key).add(tag);
  }
  // hero.name is the documented exception: a span (brand) plus the h1.
  const ALLOWED = new Set(["hero.name"]);
  for (const [key, tags] of byKey) {
    if (tags.size <= 1 || ALLOWED.has(key)) continue;
    assert.fail(`key "${key}" drives ${[...tags].join(", ")} — one key, two meanings`);
  }
});
