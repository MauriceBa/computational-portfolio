const test = require("node:test");
const assert = require("node:assert/strict");
const { cardMatchesCategory } = require("../assets/js/main.js");

test("'all' matches every category", () => {
  assert.equal(cardMatchesCategory("simulation", "all"), true);
  assert.equal(cardMatchesCategory("optimization", "all"), true);
  assert.equal(cardMatchesCategory("web", "all"), true);
});

test("an exact category match returns true", () => {
  assert.equal(cardMatchesCategory("optimization", "optimization"), true);
  assert.equal(cardMatchesCategory("simulation", "simulation"), true);
});

test("a different category returns false", () => {
  assert.equal(cardMatchesCategory("optimization", "simulation"), false);
  assert.equal(cardMatchesCategory("simulation", "optimization"), false);
});

test("a category with no cards matches nothing rather than throwing", () => {
  // The "web" filter has no card in v1 by design. The predicate must stay
  // well-defined so the empty-state path is reachable.
  assert.equal(cardMatchesCategory("simulation", "web"), false);
  assert.equal(cardMatchesCategory("optimization", "web"), false);
});
