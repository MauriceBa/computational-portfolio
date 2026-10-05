const test = require("node:test");
const assert = require("node:assert/strict");
const { formatFilterResult } = require("../assets/js/main.js");

test("substitutes count and total into the template", () => {
  assert.equal(
    formatFilterResult("{count} von {total} Projekten", 1, 3),
    "1 von 3 Projekten"
  );
});

test("substitutes a zero count without leaving braces behind", () => {
  assert.equal(formatFilterResult("{count} of {total} projects", 0, 3), "0 of 3 projects");
});

test("substitutes every occurrence of a repeated token", () => {
  assert.equal(formatFilterResult("{count}/{count} of {total}", 2, 5), "2/2 of 5");
});

test("a template missing a token is returned untouched rather than half-substituted", () => {
  // Better a visible untranslated template than a string missing its count.
  assert.equal(formatFilterResult("Projekte", 1, 3), "Projekte");
});

test("a missing template yields an empty string rather than undefined", () => {
  assert.equal(formatFilterResult(undefined, 1, 3), "");
});
