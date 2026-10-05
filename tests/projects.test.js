/* Projects section, after the filter was removed in favour of showing all work.
 *
 * These guard the two structural facts the section now depends on: every card
 * is reachable by scrolling (there is no filter that could hide one), and each
 * card's media file actually exists. A missing image on a portfolio is worse than
 * a plain card -- it renders as a broken icon. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { I18N } = require("../assets/js/i18n.js");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* [^"]* after the two base classes: the ski visualiser card carries an extra
 * project--featured class, and a stricter pattern would silently stop seeing it
 * -- turning a layout change into a "missing project" failure. */
const cards = [...html.matchAll(/<article class="card project[^"]*"[\s\S]*?<\/article>/g)].map((m) => m[0]);

test("all seven projects are present", () => {
  assert.equal(cards.length, 7, `expected 7 project cards, found ${cards.length}`);
});

test("no project card is hidden behind a filter", () => {
  // The filter used to hide cards by setting the `hidden` attribute. With seven
  // cards that span several disciplines, filtering by category hid real work
  // behind a click, so the grid is now static and nothing may be hidden.
  for (const card of cards) {
    assert.equal(/\shidden(\s|=|>)/.test(card), false,
      "a project card still carries the hidden attribute");
  }
});

test("no filter controls remain in the markup", () => {
  assert.equal(html.includes('id="project-filter"'), false, "#project-filter still exists");
  assert.equal(html.includes('id="filter-status"'), false, "#filter-status still exists");
  assert.equal(html.includes("data-filter="), false, "filter buttons still exist");
  assert.equal(html.includes("data-category="), false,
    "categories are gone, so data-category should be gone with them");
});

test("no filter empty-state remains either", () => {
  assert.equal(html.includes('id="filter-empty"'), false,
    "#filter-empty is unreachable now that every card is always shown");
});

test("the filter code is gone from main.js, not just hidden in the markup", () => {
  const main = fs.readFileSync(path.join(ROOT, "assets", "js", "main.js"), "utf8");

  assert.equal(main.includes("cardMatchesCategory"), false,
    "cardMatchesCategory is dead code once filtering is gone");
  assert.equal(main.includes("formatFilterResult"), false,
    "formatFilterResult is dead code once filtering is gone");
  assert.equal(main.includes("pickFilterTemplate"), false,
    "pickFilterTemplate is dead code once filtering is gone");
  assert.equal(main.includes("applyFilter"), false,
    "applyFilter is dead code once filtering is gone");
});

test("every project's media file exists", () => {
  for (const card of cards) {
    const src = (card.match(/<img[^>]*\ssrc="([^"]+)"/) || [])[1];
    assert.ok(src, "a project card has no image");

    assert.ok(
      fs.existsSync(path.join(ROOT, src)),
      `missing image: ${src}`
    );
  }
});

test("every project's i18n keys resolve in both languages", () => {
  for (const card of cards) {
    for (const key of [...card.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1])) {
      assert.ok(key in I18N.en, `I18N.en is missing ${key}`);
      assert.ok(key in I18N.fr, `I18N.fr is missing ${key}`);
    }
  }
});

test("every project has title, text and tags in the markup", () => {
  for (const card of cards) {
    const keys = [...card.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);

    assert.ok(keys.some((k) => k.endsWith(".title")), `no title key in card`);
    assert.ok(keys.some((k) => k.endsWith(".institution")), `no institution key in card`);
    assert.ok(keys.some((k) => /tag\d$/.test(k)), `no tag keys in card`);

    const tagCount = keys.filter((k) => /tag\d$/.test(k)).length;
    assert.ok(tagCount >= 3 && tagCount <= 6,
      `card has ${tagCount} tags, expected 3-6`);
  }
});

test("the published project links to exactly one real paper", () => {
  // The DOI appears twice on purpose: once on the project card, once in the
  // research section. Both point at the same paper, and neither is a placeholder.
  const doiLinks = [...html.matchAll(/href="(https:\/\/doi\.org\/[^"]+)"/g)].map((m) => m[1]);

  assert.ok(doiLinks.length >= 1, "the DOI link is missing entirely");
  for (const link of doiLinks) {
    assert.equal(link, "https://doi.org/10.1016/j.cherd.2026.06.054",
      `unexpected DOI target: ${link}`);
  }

  // No repository or demo links: that work is internal or self-built, and a card
  // pointing at a private repo reads worse than none.
  assert.equal(/href="https:\/\/github\.com\/[^"]*\/"/.test(html), false,
    "a project repo link reappeared");
});

test("every card names the institution it was done at", () => {
  // Attribution is the only provenance shown on cards without a public link, so
  // every card needs one. Cards that do have links carry both.
  for (const card of cards) {
    assert.match(card, /class="project__note"/, "a card has no institution note");
  }
});

test("only the three public projects carry a link row", () => {
  // The reactor paper links its DOI, the ski visualiser and the balloon tracker
  // link their live demos and sources. The other four are academic or internal
  // work with nothing to link to, so they carry the institution note alone --
  // a dead button would be worse than no button.
  const withLink = cards.filter((c) => /class="project__links"/.test(c));

  assert.equal(withLink.length, 3,
    `expected 3 cards with links, found ${withLink.length}`);
  assert.match(withLink[0], /project2/, "the DOI link row must be on the reactor card");
  assert.match(withLink[1], /project6/, "the demo link row must be on the ski visualiser card");
  assert.match(withLink[2], /project7/, "the demo link row must be on the balloon tracker card");
});

test("the ski visualiser links to the deployed app, not a guessed path", () => {
  const ski = cards.find((c) => c.includes("project6"));
  assert.ok(ski, "the ski visualiser card is missing");

  // Root-relative, so it resolves at the custom domain rather than breaking under
  // a project-page subpath.
  assert.match(ski, /href="\/slopes\/"/);
  assert.match(ski, /href="https:\/\/github\.com\/MauriceBa\/computational-portfolio\/tree\/main\/slopes"/);

  // Both links need the same protection as every other external link on the site.
  for (const tag of ski.match(/<a\b[^>]*>/g) || []) {
    assert.match(tag, /rel="[^"]*noopener/);
    assert.match(tag, /rel="[^"]*noreferrer/);
  }
});