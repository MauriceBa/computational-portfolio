const test = require("node:test");
const assert = require("node:assert/strict");
const { formatFilterResult, pickFilterTemplate } = require("../assets/js/main.js");

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

// Regression: in German the active dictionary is empty (German lives in the
// markup), so the filter status went blank instead of using the DOM template.
test("prefers the active dictionary template", () => {
  assert.equal(
    pickFilterTemplate({ "filter.result": "{count} of {total} projects" }, "{count} von {total} Projekten"),
    "{count} of {total} projects"
  );
});

test("falls back to the DOM template when the dictionary has no entry", () => {
  assert.equal(
    pickFilterTemplate({}, "{count} von {total} Projekten"),
    "{count} von {total} Projekten"
  );
});

test("falls back to the DOM template for an empty or missing dictionary value", () => {
  assert.equal(
    pickFilterTemplate({ "filter.result": "" }, "{count} von {total} Projekten"),
    "{count} von {total} Projekten"
  );
});

test("yields an empty string only when there is no template anywhere", () => {
  assert.equal(pickFilterTemplate({}, ""), "");
  assert.equal(pickFilterTemplate({}, null), "");
  assert.equal(pickFilterTemplate(undefined, undefined), "");
});

test("the resolved template actually renders counts", () => {
  const template = pickFilterTemplate({}, "{count} von {total} Projekten");
  assert.equal(formatFilterResult(template, 1, 3), "1 von 3 Projekten");
});
