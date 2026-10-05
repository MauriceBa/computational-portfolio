/* The interaction layer added on top of the static page: the hero flow field,
 * the card reveal, the pointer glow, the featured demo card, and the lightbox.
 *
 * None of it can be exercised without a browser, so these tests pin the parts
 * that fail silently in a browser and are invisible to the eye: the guards that
 * keep content visible when JS or a motion preference says no, the keyboard
 * paths of the dialog, and the i18n wiring of every new string. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { I18N } = require("../assets/js/i18n.js");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "assets", "css", "style.css"), "utf8");
const main = fs.readFileSync(path.join(ROOT, "assets", "js", "main.js"), "utf8");

test("every project image is a keyboard-reachable lightbox trigger", () => {
  const triggers = [...html.matchAll(/<button class="project__zoom"[\s\S]*?<\/button>/g)];

  assert.equal(triggers.length, 6, `expected 6 zoom triggers, found ${triggers.length}`);
  for (const [trigger] of triggers) {
    assert.match(trigger, /<img class="project__media"/, "a trigger does not wrap the image");
    assert.match(trigger, /data-i18n-attr="aria-label"/,
      "the accessible name is not translated");
    assert.match(trigger, /type="button"/, "a trigger would submit a form without type");
  }
});

test("the lightbox is a modal dialog with a translated close control", () => {
  assert.match(html, /id="lightbox"[^>]*role="dialog"/, "no dialog role on #lightbox");
  assert.match(html, /id="lightbox"[^>]*aria-modal="true"/, "#lightbox is not modal");
  assert.match(html, /aria-labelledby="lightbox-caption"/, "the dialog is not labelled");
  assert.match(html, /id="lightbox-close"[^>]*data-i18n="lightbox.close"/,
    "the close button has no translation key");

  for (const dict of [I18N.en, I18N.fr]) {
    assert.ok("lightbox.close" in dict, "lightbox.close missing from a dictionary");
    assert.ok("project.zoom" in dict, "project.zoom missing from a dictionary");
  }
});

test("the dialog closes on Escape and restores focus and scrolling", () => {
  assert.match(main, /event\.key === "Escape"/, "no Escape handler for the lightbox");
  assert.match(main, /\[data-lightbox-dismiss\]/, "clicking the backdrop does nothing");
  assert.match(main, /doc\.documentElement\.style\.overflow = rootOverflow/,
    "the viewport scroll lock is never released on the root element");
  assert.match(main, /doc\.body\.style\.overflow = bodyOverflow/,
    "scrolling is never restored after close");
  assert.match(main, /doc\.documentElement\.style\.overflow = "hidden"/,
    "locking only <body> leaves the page scrollable behind the dialog");
  assert.match(main, /lastFocus\.focus\(\)/, "focus is not returned to the trigger");
  assert.match(main, /event\.preventDefault\(\);\s*\n\s*closeBtn\.focus\(\)/,
    "Tab is free to leave the modal dialog");
});

test("the reveal never hides content the visitor cannot or should not wait for", () => {
  // The class that hides the cards exists only behind two guards: an observer
  // to unhide them, and a motion preference check. Losing either one would leave
  // the portfolio's work invisible.
  assert.match(main, /classList\.add\("reveal"\)/, "the reveal class is never applied");
  assert.ok(
    main.indexOf('window.matchMedia("(prefers-reduced-motion: reduce)").matches') <
      main.indexOf('classList.add("reveal")'),
    "the reduced-motion check does not precede the reveal"
  );
  // Anchor on the reveal's own observe call: a bare "observer.observe" would
  // match the scroll spy, which sits earlier in the file and proves nothing.
  assert.ok(main.indexOf("observer.observe(cards[k])") > main.indexOf('classList.add("reveal")'),
    "cards are hidden before anything is registered to reveal them");

  // And CSS forces them visible if the preference arrives later, or on paper.
  assert.match(css, /@media print[\s\S]*?\.reveal \.project \{\s*opacity: 1 !important/,
    "print output would ship invisible cards");
  assert.match(css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.reveal \.project \{\s*opacity: 1 !important/,
    "reduced motion would ship invisible cards");
});

test("the flow field stops animating when nobody can see it", () => {
  assert.match(html, /<canvas class="hero__mesh"><\/canvas>/, "the hero canvas is missing");
  assert.match(html, /class="hero__backdrop" aria-hidden="true"/,
    "the backdrop is exposed to assistive tech");

  assert.match(main, /IntersectionObserver/, "the field runs while off screen");
  assert.match(main, /visibilitychange/, "the field runs while the tab is hidden");
  assert.match(main, /new Float32Array/, "per-frame allocation crept into the field");
  assert.match(main, /prefers-reduced-motion: reduce/,
    "the field does not honour reduced motion");
});

test("the ski visualiser is the one featured card, and it spans the grid", () => {
  const featured = [...html.matchAll(/<article class="([^"]*project--featured[^"]*)"/g)];

  assert.equal(featured.length, 1, `expected 1 featured card, found ${featured.length}`);

  const block = html.match(/<article class="[^"]*project--featured[^"]*">[\s\S]*?<\/article>/);
  assert.ok(block, "the featured card could not be read");
  assert.match(block[0], /project6\.title/, "the featured card is not the ski visualiser");
  assert.match(block[0], /class="project__live"/, "the featured card lost its live badge");

  assert.match(css, /\.project--featured \{\s*grid-column: 1 \/ -1/,
    "the featured card does not span the grid");
});

test("the live badge and the demo button carry the right semantics", () => {
  assert.equal((html.match(/class="project__live"/g) || []).length, 1,
    "the live badge must appear exactly once");
  assert.match(html, /class="project__live-dot" aria-hidden="true"/,
    "the pulsing dot is not hidden from screen readers");
  assert.match(html, /<a class="btn btn--primary" href="\/slopes\/"/,
    "the live demo link is not styled as the card's primary action");

  assert.ok("project6.live" in I18N.en && "project6.live" in I18N.fr,
    "project6.live missing from a dictionary");
});
