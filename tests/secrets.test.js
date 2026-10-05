/* Credentials must never live in the repository.
 *
 * A Cesium Ion token shipped in slopes/index.html once went to GitHub with the
 * rest of the app. For a site with no build step that token is readable from
 * view-source anyway, so hiding it in a file changes nothing for an attacker --
 * but keeping it out of git still matters: git history is permanent, cloned by
 * everyone, and outlives the rotation you do after a leak.
 *
 * The pattern that replaced it: the token is configuration, not source. It is
 * read from a gitignored slopes/ion-token.js locally, and written into the
 * deploy artifact from a repository secret by the Pages workflow.
 *
 * These tests fail on the next literal credential that lands in a file. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

/* Shapes credentials actually have -- not the word "token", which appears
 * everywhere in a design-token codebase. */
const CREDENTIAL_SHAPES = [
  ["Cesium Ion / generic JWT", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/],
  ["GitHub personal access token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ["OpenAI-style secret key", /\bsk-[A-Za-z0-9]{32,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["private key block", /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ["hard-coded Ion token assignment", /defaultAccessToken\s*=\s*["'][^"']{20,}["']/]
];

const SCANNED_EXTENSIONS = new Set([".html", ".js", ".cjs", ".mjs", ".css", ".yml", ".yaml", ".json", ".md"]);

/* assets/sites holds other, untracked applications that are not part of this
 * site; slopes/ion-token.js is the gitignored file that is *supposed* to hold
 * a token. */
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", "assets/sites"]);
const SKIPPED_FILES = new Set(["slopes/ion-token.js", "hot-air-balloon-tracking/ion-token.js"]);

function sourceFiles(dir = ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(ROOT, abs).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(rel)) sourceFiles(abs, out);
    } else if (SCANNED_EXTENSIONS.has(path.extname(entry.name)) && !SKIPPED_FILES.has(rel)) {
      out.push(rel);
    }
  }
  return out;
}

test("no credential-shaped string appears in any source file", () => {
  const offenders = [];
  for (const rel of sourceFiles()) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    for (const [label, pattern] of CREDENTIAL_SHAPES) {
      const match = text.match(pattern);
      if (match) offenders.push(`${rel}: ${label} -> ${match[0].slice(0, 18)}...`);
    }
  }
  assert.deepEqual(offenders, [], `credential material found:\n  ${offenders.join("\n  ")}`);
});

test("the Ion token is injected as configuration, not written into the markup", () => {
  const app = fs.readFileSync(path.join(ROOT, "slopes", "index.html"), "utf8");
  assert.match(app, /src="ion-token\.js"/,
    "the app no longer loads the token file");
  assert.match(app, /window\.ION_TOKEN/,
    "the app no longer reads the token from configuration");
  assert.equal(fs.existsSync(path.join(ROOT, "slopes", "ion-token.example.js")), true,
    "the committed template is missing, so nobody can set the token up");
});

test("the token file is gitignored, and .gitignore exists to hold that rule", () => {
  const ignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  assert.match(ignore, /^slopes\/ion-token\.js$/m,
    ".gitignore no longer excludes slopes/ion-token.js; the next commit would publish it");
});

test("the deploy workflow takes the token from a repository secret", () => {
  const workflow = path.join(ROOT, ".github", "workflows", "deploy.yml");
  assert.ok(fs.existsSync(workflow), "the Pages deploy workflow is missing");
  const yml = fs.readFileSync(workflow, "utf8");
  assert.match(yml, /secrets\.CESIUM_ION_TOKEN/,
    "the workflow does not read CESIUM_ION_TOKEN from the secret store");
  assert.match(yml, /write[rs]?\s+slopes\/ion-token\.js|>\s*slopes\/ion-token\.js/,
    "the workflow never writes slopes/ion-token.js into the artifact");
});

test("a missing token degrades instead of breaking the 3D view", () => {
  const app = fs.readFileSync(path.join(ROOT, "slopes", "index.html"), "utf8");
  assert.match(app, /const hasIon = Boolean\(window\.ION_TOKEN\)/,
    "the viewer no longer branches on the token being present");
  assert.match(app, /EllipsoidTerrainProvider/,
    "there is no token-free terrain fallback, so an unset secret breaks the demo");
});
