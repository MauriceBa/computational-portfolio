const test = require("node:test");
const assert = require("node:assert/strict");
const { cvPath, cvDownloadName } = require("../assets/js/main.js");
// Regression: the CV is now one file per language. A single hard-coded href would
// hand a German-speaking visitor an English CV (or, after a language switch, hand
// a French visitor whichever file the markup happened to point at).
test("each language maps to its own CV file", () => {
  assert.equal(cvPath("de"), "assets/pdf/CV_DE_Maurice_Bastard.pdf");
  assert.equal(cvPath("en"), "assets/pdf/CV_EN_Maurice_Bastard.pdf");
  assert.equal(cvPath("fr"), "assets/pdf/CV_FR_Maurice_Bastard.pdf");
});

test("an unknown language falls back to the German CV rather than breaking", () => {
  assert.equal(cvPath("es"), "assets/pdf/CV_DE_Maurice_Bastard.pdf");
  assert.equal(cvPath(""), "assets/pdf/CV_DE_Maurice_Bastard.pdf");
  assert.equal(cvPath(null), "assets/pdf/CV_DE_Maurice_Bastard.pdf");
});

test("the download attribute is set so browsers save instead of opening", () => {
  // Returning the filename keeps the saved file named CV_DE_... rather than
  // something the browser invents from the URL.
  assert.equal(cvDownloadName("de"), "CV_DE_Maurice_Bastard.pdf");
  assert.equal(cvDownloadName("xx"), "CV_DE_Maurice_Bastard.pdf");
});

test("the CV link in the markup starts on the German file", () => {
  // Without JS the anchor must still work, so the default href has to be a real
  // file rather than an empty value that main.js would have filled in.
  const html = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "index.html"),
    "utf8"
  );

  assert.match(html, /id="cv-download"[\s\S]{0,200}href="assets\/pdf\/CV_DE_Maurice_Bastard\.pdf"/);

  // Exactly one href, so main.js updates a single element. Counting the
  // download attribute too would double-count: it carries the same filename.
  const hrefs = [...html.matchAll(/href="(assets\/pdf\/[^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ["assets/pdf/CV_DE_Maurice_Bastard.pdf"]);
});

test("the CV switch is wired into the language change, not just defined", () => {
  // Guards against updateCvLink() existing but never being called: the pure
  // functions above would pass either way, and the bug would only show up as a
  // French visitor downloading the German CV.
  const main = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "assets", "js", "main.js"),
    "utf8"
  );

  assert.match(main, /function updateCvLink\(\)/);
  assert.match(main, /updateCvLink\(\);/, "updateCvLink must actually be invoked");
});

test("absolute social-preview URLs match the CNAME", () => {
  // The CNAME makes the site live at a custom domain. og:image and og:url are
  // absolute, so if the domain changes and these do not, Facebook/LinkedIn/Slack
  // request the preview from a host that no longer serves it and show nothing.
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.join(__dirname, "..");

  const cname = fs.readFileSync(path.join(root, "CNAME"), "utf8").trim();
  assert.match(cname, /^[a-z0-9.-]+\.[a-z]{2,}$/, `CNAME is not a hostname: ${cname}`);

  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const origin = `https://${cname}`;

  assert.match(html, new RegExp(`<meta property="og:url" content="${origin}/?">`));
  assert.match(html, new RegExp(`<meta property="og:image" content="${origin}/assets/img/og-image\\.png">`));

  // Nothing may still point at the old Pages host.
  assert.equal(html.includes("mauriceba.github.io"), false,
    "a mauriceba.github.io URL survived the CNAME change");
});
