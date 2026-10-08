/* The reactor band: an airlift loop reactor canvas animation that acts as the
 * graphical abstract of the first publication and sits between the projects
 * and the research section.
 *
 * The animation only runs in a browser, so these tests pin the parts that
 * fail silently: its place in the page, the wiring that keeps it labelled and
 * translatable, the guards that stop it wasting cycles, and the stylesheet
 * rules that keep the portrait canvas usable on narrow viewports. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { I18N } = require("../assets/js/i18n.js");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "assets", "css", "style.css"), "utf8");
const reactor = fs.readFileSync(path.join(ROOT, "assets", "js", "reactor.js"), "utf8");

test("the band sits between the projects and the research section", () => {
  const projects = html.indexOf('<section id="projects"');
  const band = html.indexOf('<section id="reactor-band"');
  const research = html.indexOf('<section id="research"');
  assert.ok(projects > -1 && band > -1 && research > -1, "all three sections exist");
  assert.ok(projects < band && band < research, "expected projects < band < research");
});

test("the band's canvas is labelled for screen readers and translated", () => {
  const canvas = html.match(/<canvas id="reactor"[\s\S]*?<\/canvas>/);
  assert.ok(canvas, "the reactor canvas exists");
  assert.match(canvas[0], /role="img"/);
  assert.match(canvas[0], /aria-label="/);
  assert.match(canvas[0], /data-i18n="reactor\.canvasLabel"/);
  assert.match(canvas[0], /data-i18n-attr="aria-label"/);
});

test("reactor.js is deferred and initialises only once the DOM is ready", () => {
  assert.match(html, /<script src="assets\/js\/reactor\.js" defer><\/script>/);
  assert.match(reactor, /document\.addEventListener\("DOMContentLoaded", initReactor\)/);
});

test("the animation pauses when it would not be seen", () => {
  assert.match(reactor, /prefers-reduced-motion/, "one still frame when motion is reduced");
  assert.match(reactor, /IntersectionObserver/, "pauses while the band is off screen");
  assert.match(reactor, /document\.hidden/, "pauses while the tab is hidden");
  assert.match(reactor, /refreshVisibility/, "guards recombine, so it resumes after a tab switch");
  assert.match(reactor, /Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/, "DPR capped at 2");
});

test("the canvas ignores a missing host element or 2d context", () => {
  assert.match(reactor, /if \(!canvas \|\| !canvas\.getContext\) \{ return; \}/);
  assert.match(reactor, /if \(!ctx\) \{ return; \}/);
});

test("every band string is translated", () => {
  for (const key of ["reactor.heading", "reactor.text", "reactor.canvasLabel"]) {
    assert.ok(I18N.en[key], `I18N.en is missing ${key}`);
    assert.ok(I18N.fr[key], `I18N.fr is missing ${key}`);
  }
});

test("the band styles live in the stylesheet, not in the page", () => {
  const band = html.slice(
    html.indexOf('<!-- =========================== AIRLIFT-REAKTOR'),
    html.indexOf('<!-- ==================== FORSCHUNG')
  );
  assert.ok(band.length > 0, "the band markup is between its two comments");
  assert.doesNotMatch(band, /<style/, "the band brings no inline styles");

  assert.match(css, /\.reactor-band__grid \{/);
  assert.match(css, /\.reactor-band__stage \{/);
  /* stacks to a single column on narrow viewports */
  assert.match(css, /\.reactor-band__grid \{\s*grid-template-columns: minmax\(0, 1fr\);/);
});
