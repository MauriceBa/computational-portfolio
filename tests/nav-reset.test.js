/* Regression guard for the mobile-nav `inert` trap.
 *
 * While the menu is open, <main> and <footer> are inert so Tab cannot reach the
 * content behind it. The only control that clears that state is #nav-toggle --
 * and that button is display:none above the 54rem breakpoint. Without an
 * explicit reset, crossing the breakpoint with the menu open leaves the entire
 * page inert and unclickable, with no visible affordance explaining why.
 *
 * The decision is pure, so it is tested without a DOM. */

const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldResetNav } = require("../assets/js/main.js");

test("crossing to a wide viewport closes an open menu", () => {
  assert.equal(shouldResetNav(true, true), true);
});

test("a closed menu needs no reset on a wide viewport", () => {
  assert.equal(shouldResetNav(true, false), false);
});

test("resizing within the narrow range leaves the menu alone", () => {
  assert.equal(shouldResetNav(false, true), false);
  assert.equal(shouldResetNav(false, false), false);
});

test("the menu is never reset while still narrow, however the sizes land", () => {
  // The only thing that matters is that the viewport reached the wide state.
  for (const isWide of [false]) {
    assert.equal(shouldResetNav(isWide, true), false);
  }
});
