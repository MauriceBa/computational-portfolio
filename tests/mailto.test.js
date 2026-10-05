const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMailtoUrl } = require("../assets/js/main.js");

test("builds a mailto URL from subject and body", () => {
  assert.equal(
    buildMailtoUrl("a@b.de", { subject: "Hi", body: "Hello" }),
    "mailto:a@b.de?subject=Hi&body=Hello"
  );
});

test("omits the query string entirely when both fields are empty", () => {
  assert.equal(buildMailtoUrl("a@b.de", { subject: "", body: "" }), "mailto:a@b.de");
});

test("encodes reserved characters in subject and body", () => {
  const tricky = "Müller & Söhne = 100%?\nZeile 2";
  const url = buildMailtoUrl("a+b@c.de", { subject: tricky, body: tricky });

  assert.ok(url.startsWith("mailto:a+b@c.de?"), "literal + in address survives unencoded");
  assert.ok(!url.includes("& Söhne"), "raw & must not survive into the query string");
  assert.equal(decodeURIComponent(url.split("body=")[1]), tricky);
  assert.equal(decodeURIComponent(url.split("subject=")[1].split("&body=")[0]), tricky);
});

test("encodes a single field when the other is empty", () => {
  assert.equal(
    buildMailtoUrl("a@b.de", { subject: "Nur Betreff", body: "" }),
    "mailto:a@b.de?subject=Nur%20Betreff&body="
  );
});
