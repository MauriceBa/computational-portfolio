const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveTheme } = require("../assets/js/main.js");

test("stored dark wins over a light OS preference", () => {
  assert.equal(resolveTheme("dark", false), "dark");
});

test("stored light wins over a dark OS preference", () => {
  assert.equal(resolveTheme("light", true), "light");
});

test("no stored value falls through to the dark OS preference", () => {
  assert.equal(resolveTheme(null, true), "dark");
});

test("no stored value and no dark OS preference resolves to light", () => {
  assert.equal(resolveTheme(undefined, false), "light");
});

test("empty string is not a valid stored value", () => {
  assert.equal(resolveTheme("", true), "dark");
});

test("stored value is matched case-insensitively", () => {
  assert.equal(resolveTheme("DARK", true), "dark");
});

test("unknown stored value falls through to the OS preference", () => {
  assert.equal(resolveTheme("auto", true), "dark");
  assert.equal(resolveTheme("auto", false), "light");
});
