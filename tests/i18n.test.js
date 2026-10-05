const test = require("node:test");
const assert = require("node:assert/strict");
const { translateDocument } = require("../assets/js/main.js");
const { I18N } = require("../assets/js/i18n.js");

// --- dictionary integrity ------------------------------------------------

test("English and French define exactly the same keys", () => {
  assert.deepEqual(Object.keys(I18N.fr).sort(), Object.keys(I18N.en).sort());
});

test("every dictionary value is a non-empty string", () => {
  for (const lang of ["en", "fr"]) {
    for (const [key, value] of Object.entries(I18N[lang])) {
      assert.equal(typeof value, "string", `${lang}.${key} is not a string`);
      assert.ok(value.length > 0, `${lang}.${key} is empty`);
    }
  }
});

test("content values mark their replaceable parts in square brackets", () => {
  // The invariant is "a human can see what still needs replacing", not "the whole
  // string is one placeholder". Composite values such as meta.title
  // ("[First Last] - Computational Engineer") legitimately combine a placeholder
  // with fixed chrome, so require at least one bracketed group.
  //
  // Interface chrome is exempt: it is copy the user never replaces. Spec Global
  // Constraints allow exactly these — skip-link text, aria-label fallbacks, and
  // fixed control labels. Nav item labels count as chrome too, since a site's
  // section names are set once and are not "content still to be written".
  const CHROME = new Set([
    "nav.skip", "nav.label", "nav.menu", "nav.close",
    "nav.about", "nav.skills", "nav.projects", "nav.research", "nav.contact",
    "theme.toDark", "theme.toLight", "lang.label", "filter.label",
    "contact.github", "contact.linkedin",
    // Rendered UI copy, not content: brackets here would show up in the live
    // region as "[3 of 3 projects]".
    "filter.result",
    // Read aloud by a screen reader on a failed submit.
    "contact.status"
  ]);

  for (const lang of ["en", "fr"]) {
    for (const [key, value] of Object.entries(I18N[lang])) {
      if (CHROME.has(key)) continue;
      assert.match(value, /\[[^\]]+\]/, `${lang}.${key} contains no bracketed placeholder`);
    }
  }

  assert.equal(I18N.en["nav.close"], "Close");
  assert.equal(I18N.fr["nav.close"], "Fermer");
});

// --- translateDocument ---------------------------------------------------

function el(key, attr) {
  return {
    key: key,
    attr: attr || null,
    attrs: {},
    textContent: "DEUTSCH",
    getAttribute(n) {
      if (n === "data-i18n") return this.key;
      if (n === "data-i18n-attr") return this.attr;
      return null;
    },
    setAttribute(n, v) {
      this.attrs[n] = v;
    }
  };
}

test("writes textContent for plain elements", () => {
  const node = el("hero.name");
  const doc = { querySelectorAll: () => [node] };

  const written = translateDocument(doc, { "hero.name": "Jane Doe" });

  assert.equal(written, 1);
  assert.equal(node.textContent, "Jane Doe");
});

test("writes an attribute when data-i18n-attr is present", () => {
  const node = el("meta.description", "content");
  const doc = { querySelectorAll: () => [node] };

  const written = translateDocument(doc, { "meta.description": "Desc" });

  assert.equal(written, 1);
  assert.equal(node.attrs.content, "Desc");
  assert.equal(node.textContent, "DEUTSCH", "textContent must not be touched on attr writes");
});

test("a key missing from the dictionary leaves the German text intact", () => {
  const nodes = [el("hero.name"), el("missing.key")];
  const doc = { querySelectorAll: () => nodes };

  const written = translateDocument(doc, { "hero.name": "Jane Doe" });

  assert.equal(written, 1, "skipped elements must not be counted as written");
  assert.equal(nodes[1].textContent, "DEUTSCH");
});

test("an empty dictionary writes nothing at all", () => {
  const nodes = [el("hero.name"), el("about.heading")];
  const doc = { querySelectorAll: () => nodes };

  assert.equal(translateDocument(doc, {}), 0);
  assert.equal(nodes[0].textContent, "DEUTSCH");
  assert.equal(nodes[1].textContent, "DEUTSCH");
});

// Runtime strings are UI copy, not placeholders: brackets would be read aloud by
// a screen reader and shown inside the live region.
const RUNTIME_STRINGS = [
  "nav.close", "nav.menu", "filter.result", "theme.toDark",
  "theme.toLight", "contact.status"
];

test("runtime UI strings are not wrapped in placeholder brackets", () => {
  for (const key of RUNTIME_STRINGS) {
    assert.match(key, /^[a-z]/, `${key} does not look like a translation key`);
    for (const lang of ["en", "fr"]) {
      const value = I18N[lang][key];
      assert.equal(typeof value, "string", `I18N.${lang} is missing ${key}`);
      assert.doesNotMatch(value, /^\[.*\]$/, `I18N.${lang}["${key}"] is bracketed: ${value}`);
      assert.doesNotMatch(value, /[\[\]]/, `I18N.${lang}["${key}"] contains brackets: ${value}`);
    }
  }
});

test("filter.result carries count and total tokens and nothing bracketed", () => {
  for (const lang of ["en", "fr"]) {
    const value = I18N[lang]["filter.result"];
    assert.ok(value.includes("{count}"), `I18N.${lang} filter.result lost {count}`);
    assert.ok(value.includes("{total}"), `I18N.${lang} filter.result lost {total}`);
  }
});
