/* The hot air balloon tracker: static data pipeline plus web viewer.
 *
 * The app runs entirely on GitHub Pages: a scheduled Action appends
 * FlightRadar24 observations to app-data/*.json and the viewer reads them as
 * plain static files. Nothing here may assume a server, a build step, or a
 * committed credential -- the Telegram bot that used to live next to the data
 * shipped a hard-coded token and is gone. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { I18N } = require("../assets/js/i18n.js");

const ROOT = path.join(__dirname, "..");
const APP = path.join(ROOT, "hot-air-balloon-tracking");
const DATA = path.join(APP, "app-data");

const readApp = () => fs.readFileSync(path.join(APP, "index.html"), "utf8");

test("the viewer sits at the clean URL so Pages serves /hot-air-balloon-tracking/", () => {
  assert.ok(fs.existsSync(path.join(APP, "index.html")),
    "hot-air-balloon-tracking/index.html is missing");
});

test("the static data files the viewer fetches exist and parse", () => {
  for (const name of ["balloon_tracks.json", "balloon_history.json", "manifest.json"]) {
    const file = path.join(DATA, name);
    assert.ok(fs.existsSync(file), `app-data/${name} is missing`);
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.ok(parsed !== null, `app-data/${name} does not parse`);
  }
});

test("every history shard listed in the manifest exists on disk", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(DATA, "manifest.json"), "utf8"));

  assert.ok(Array.isArray(manifest.shards) && manifest.shards.length > 0,
    "manifest.shards must list at least the active history file");
  for (const shard of manifest.shards) {
    assert.ok(shard.file, "a manifest shard has no file name");
    assert.ok(fs.existsSync(path.join(DATA, shard.file)),
      `manifest lists ${shard.file}, which does not exist`);
  }
  // Newest last, so the viewer can lazy-load older shards from the front.
  const files = manifest.shards.map((s) => s.file);
  assert.equal(files[files.length - 1], "balloon_history.json",
    "the active history file must be the newest (last) shard");
});

test("the viewer reads the manifest and falls back to the active history file", () => {
  const app = readApp();

  assert.match(app, /app-data\/manifest\.json/,
    "the viewer never requests the manifest");
  assert.match(app, /app-data\/balloon_tracks\.json/,
    "the viewer never requests the live tracks");
  assert.match(app, /balloon_history\.json/,
    "the viewer has no static fallback when the manifest is missing");
});

test("the viewer reuses the shared Ion token setup instead of embedding a token", () => {
  const app = readApp();

  assert.match(app, /src="\.\.\/slopes\/ion-token\.js"/,
    "the viewer no longer loads the shared ion-token.js");
  assert.match(app, /window\.ION_TOKEN/,
    "the viewer no longer reads the token from configuration");
  assert.match(app, /EllipsoidTerrainProvider/,
    "there is no token-free terrain fallback, so an unset secret breaks 3D");
  assert.match(app, /UrlTemplateImageryProvider/,
    "the token-free imagery fallback must not rely on a deprecated provider");
  assert.match(app, /try \{\s*state\.cesium = new Cesium\.Viewer/,
    "viewer creation is not wrapped, so a Cesium failure kills the 3D tab");
});

test("the 2D and 3D views are both present and switchable", () => {
  const app = readApp();

  assert.match(app, /id="map2d"/, "no 2D Leaflet container");
  assert.match(app, /id="map3d"/, "no 3D Cesium container");
  assert.match(app, /L\.map\("map2d"/, "the Leaflet map is never initialised");
  assert.match(app, /Cesium\.Viewer\("map3d"/, "the Cesium viewer is never initialised");
  assert.match(app, /tile\.openstreetmap\.org/, "no OpenStreetMap base layer");
});

test("the viewer offers playback over the observation timeline", () => {
  const app = readApp();

  assert.match(app, /id="play-slider"/, "no time slider");
  assert.match(app, /id="btn-play"/, "no play/pause control");
  for (const speed of ["1x", "5x", "20x"]) {
    assert.match(app, new RegExp(`>${speed}<`), `missing playback speed ${speed}`);
  }
});

test("the viewer scopes map and playback to a selected day", () => {
  const app = readApp();

  assert.match(app, /id="date-filter"/, "no date filter next to the balloon filter");
  assert.match(app, /Alle Tage/, "the all-days option is missing");
  assert.match(app, /function dayPoints/, "points are not scoped to the selected day");
  assert.match(app, /state\.dateTouched/,
    "the newest-day default could not be overridden by the user");
  assert.match(app, /rebuildTimeline\(\)/,
    "the playback timeline is not rebuilt from the day's timestamps");
  // The balloon options must narrow down to the balloons actually flying that day.
  assert.match(app, /activeBalloons\(\)\.map/,
    "the balloon filter is not restricted to the selected day");
});

test("the portfolio links to the app and to its repository directory", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

  assert.match(html, /href="\/hot-air-balloon-tracking\/"/,
    "no link to /hot-air-balloon-tracking/ in the portfolio");
  assert.match(html,
    /href="https:\/\/github\.com\/MauriceBa\/computational-portfolio\/tree\/main\/hot-air-balloon-tracking"/,
    "no link to the balloon tracker repository directory");

  for (const key of ["project7.demo", "project7.repo", "project7.title", "project7.live"]) {
    assert.ok(key in I18N.en, `I18N.en is missing ${key}`);
    assert.ok(key in I18N.fr, `I18N.fr is missing ${key}`);
  }
});

test("the scheduled workflow appends data and commits it back", () => {
  const file = path.join(ROOT, ".github", "workflows", "track_balloons.yml");
  assert.ok(fs.existsSync(file), "the balloon tracking workflow is missing");
  const yml = fs.readFileSync(file, "utf8");

  assert.match(yml, /cron:/, "the workflow is not on a schedule");
  assert.match(yml, /contents:\s*write/, "the workflow cannot push the fresh data");
  assert.match(yml, /tracker\.py/, "the workflow does not run the scanner");
  assert.match(yml, /balloon_\*\.json/, "the workflow does not stage the data files");
  assert.match(yml, /diff --cached --quiet/,
    "the workflow commits even when nothing changed, creating empty commits");
});

test("the scanner is headless: no Telegram, no geopy, no hard-coded token", () => {
  const src = fs.readFileSync(path.join(APP, "tracker.py"), "utf8");

  assert.equal(fs.existsSync(path.join(DATA, "ballon_bot.py")), false,
    "ballon_bot.py with its hard-coded Telegram token is back");
  assert.doesNotMatch(src, /^\s*(from telegram|import telegram)/m,
    "the scanner still imports Telegram");
  assert.doesNotMatch(src, /^\s*(from geopy|import geopy)/m,
    "the scanner still depends on geopy");
  assert.doesNotMatch(src, /\b\d{8,}:[A-Za-z0-9_-]{30,}\b/,
    "a bot-token-shaped literal is embedded in the scanner");
  // Same API family the proven bot used.
  assert.match(src, /from FlightRadar24 import FlightRadar24API/);
});

test("the scanner shards the history file before it grows without bound", () => {
  const src = fs.readFileSync(path.join(APP, "tracker.py"), "utf8");

  assert.match(src, /SHARD_LIMIT_BYTES/, "no rotation threshold");
  assert.match(src, /manifest\.json/, "the manifest is never rewritten");
});
