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

test("no runtime or chrome string carries placeholder brackets", () => {
  // Runtime strings and interface chrome are rendered verbatim: a bracket in a
  // live region shows up on screen, and a bracket in an accessible name is read
  // aloud. tests/placeholders.test.js covers the content side of this.
  const MUST_BE_CLEAN = new Set([
    "nav.skip", "nav.label", "nav.menu", "nav.close",
    "nav.about", "nav.skills", "nav.projects", "nav.research", "nav.contact",
    "theme.toDark", "theme.toLight", "lang.label",
    "contact.github", "contact.linkedin",
    "contact.status", "contact.email",
    "contact.sending", "contact.success", "contact.error"
  ]);

  for (const lang of ["en", "fr"]) {
    for (const key of MUST_BE_CLEAN) {
      const value = I18N[lang][key];
      assert.equal(typeof value, "string", `I18N.${lang} is missing ${key}`);
      assert.doesNotMatch(value, /[\[\]]/, `I18N.${lang}["${key}"] contains brackets: ${value}`);
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
  "nav.close", "nav.menu", "theme.toDark",
  "theme.toLight", "contact.status",
  "contact.sending", "contact.success", "contact.error"
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

test("no filter translation keys survived the section rewrite", () => {
  // The projects section no longer filters, so filter.* is dead weight that would
  // silently rot. A new key here is a sign something was reintroduced half-way.
  for (const lang of ["en", "fr"]) {
    const stale = Object.keys(I18N[lang]).filter((k) => k.startsWith("filter."));
    assert.deepEqual(stale, [], `I18N.${lang} still has filter keys: ${stale.join(", ")}`);
  }
});
