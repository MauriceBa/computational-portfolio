/* The slopes web app, deployed as a static site.
 *
 * It originally depended on api.php to enumerate its tour folders, which works on
 * a PHP host and returns 404 on GitHub Pages. The failure was silent: the fetch
 * was wrapped in try/catch and the app fell back to a hardcoded FALLBACK_FOLDERS
 * array holding 4 of the 31 tours, so 27 tours simply did not exist for a visitor
 * and nothing said so.
 *
 * These tests pin the static behaviour that replaced it. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SLOPES = path.join(ROOT, "slopes");
const APP_DATA = path.join(SLOPES, "app_data");

const readAppData = () => fs.readFileSync(path.join(SLOPES, "index.html"), "utf8");
const readManifest = () =>
  JSON.parse(fs.readFileSync(path.join(APP_DATA, "manifest.json"), "utf8"));

const tourFolders = () =>
  fs.readdirSync(APP_DATA, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

test("the app is at the repository root so GitHub Pages serves it at /slopes/", () => {
  assert.ok(fs.existsSync(path.join(SLOPES, "index.html")),
    "slopes/index.html is missing; the clean URL needs it at the root, not nested");
  assert.equal(fs.existsSync(path.join(ROOT, "assets", "sites", "slopes", "index.html")), false,
    "the app is still nested under assets/sites/");
});

test("there is no PHP left, because GitHub Pages cannot run it", () => {
  assert.equal(fs.existsSync(path.join(SLOPES, "api.php")), false,
    "api.php is still present; it can never execute on GitHub Pages");
  assert.equal(readAppData().includes("api.php"), false,
    "the app still references api.php");
});

test("the manifest lists every tour folder on disk, with no extras and no gaps", () => {
  const manifest = readManifest();
  const onDisk = tourFolders();

  assert.ok(Array.isArray(manifest), "manifest.json must be a JSON array");
  assert.deepEqual(
    [...manifest].sort(),
    onDisk,
    `manifest lists ${manifest.length} folders, disk has ${onDisk.length}`
  );
});

test("the manifest is unique, so no tour is listed twice", () => {
  const manifest = readManifest();
  assert.equal(new Set(manifest).size, manifest.length, "manifest.json contains duplicates");
});

test("the manifest is written as UTF-8, because folder names carry accents", () => {
  // "Val d'Isère" and "Les 3 Vallées" appear on disk as real UTF-8. A file saved
  // as latin-1 or with a broken header would mangle them into folders that do not
  // exist, and the tour would silently fail to load.
  const raw = fs.readFileSync(path.join(APP_DATA, "manifest.json"), "utf8");
  const names = JSON.parse(raw);

  const withAccents = names.filter((n) => /[^\x00-\x7F]/.test(n));
  assert.ok(withAccents.length > 0, "expected accented folder names in the manifest");

  for (const name of withAccents) {
    assert.ok(fs.existsSync(path.join(APP_DATA, name)),
      `manifest names "${name}", which does not exist on disk -- encoding is wrong`);
  }
});

test("every tour folder has the files the app fetches", () => {
  // loadMetadata() reads Metadata.xml, loadGPS() reads GPS.csv then falls back to
  // RawGPS.csv. A folder missing all three loads as an empty day with no error.
  for (const folder of tourFolders()) {
    const dir = path.join(APP_DATA, folder);
    const files = fs.readdirSync(dir);

    assert.ok(files.includes("Metadata.xml"), `${folder}: Metadata.xml is missing`);
    assert.ok(
      files.includes("GPS.csv") || files.includes("RawGPS.csv"),
      `${folder}: neither GPS.csv nor RawGPS.csv is present`
    );
  }
});

test("the app reads the manifest rather than relying on a stale hardcoded list", () => {
  const app = readAppData();

  assert.match(app, /manifest\.json/,
    "the app never requests manifest.json");
  // No server-side enumeration call of any kind, under any spelling.
  assert.equal(/action\s*=\s*['"]?list/.test(app), false,
    "the app still tries to enumerate tours through a server-side action");
  assert.equal(/FALLBACK_FOLDERS/.test(app), true,
    "the emergency fallback list should remain, in case the manifest fails");
});

test("the upload UI is gone, since static hosting cannot accept uploads", () => {
  const app = readAppData();

  assert.equal(/action=upload/.test(app), false, "the upload request is still in the code");
  assert.equal(/id="slopes-upload"/.test(app), false, "the upload form is still in the markup");
  assert.equal(/function uploadSlopes/.test(app), false, "uploadSlopes() is still defined");
});

test("tour folder names are url-encoded at fetch time, not at build time", () => {
  // The app must keep passing the raw name through encodeURIComponent. A manifest
  // that pre-encoded names would double-encode the space in "January 04 2024".
  const app = readAppData();
  assert.match(app, /encodeURIComponent\(folder\)/,
    "folder names are no longer encoded at fetch time");
});

test("the portfolio links to the app at /slopes/ and to its repository", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

  assert.match(html, /href="\/slopes\/"/,
    "no link to /slopes/ in the portfolio");
  assert.match(html, /href="https:\/\/github\.com\/MauriceBa\/VPS_Coding\/tree\/main\/slopes"/,
    "no link to the slopes repository in the portfolio");
});

test("the portfolio demo link is language-translated, like every other card link", () => {
  const { I18N } = require("../assets/js/i18n.js");

  for (const key of ["project6.demo", "project6.repo"]) {
    assert.ok(key in I18N.en, `I18N.en is missing ${key}`);
    assert.ok(key in I18N.fr, `I18N.fr is missing ${key}`);
  }

  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, new RegExp(`data-i18n="project6\\.demo"`));
  assert.match(html, new RegExp(`data-i18n="project6\\.repo"`));
});
