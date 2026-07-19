const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  DEFAULT_SETTINGS,
  normalizeSettings,
  computeColumnWidth,
  planMasonry,
} = require("../src/content/layout.js");

test("normalizeSettings uses defaults for missing or invalid values", () => {
  assert.deepEqual(normalizeSettings(), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({ enabled: "yes", columns: 9 }), DEFAULT_SETTINGS);
});

test("normalizeSettings accepts auto and supported column counts", () => {
  assert.deepEqual(normalizeSettings({ enabled: false, columns: 0 }), {
    enabled: false,
    columns: 0,
  });
  assert.deepEqual(normalizeSettings({ enabled: true, columns: 6 }), {
    enabled: true,
    columns: 6,
  });
});

test("computeColumnWidth accounts for gaps and side padding", () => {
  assert.equal(computeColumnWidth(1000, 3, 16, 8), 317.3333333333333);
  assert.equal(computeColumnWidth(0, 3, 16, 8), 0);
});

test("planMasonry always places the next card in the shortest column", () => {
  const plan = planMasonry([300, 100, 200, 120], 2, 400, 16, 8);

  assert.deepEqual(plan.positions, [
    { x: 8, y: 0, column: 0 },
    { x: 424, y: 0, column: 1 },
    { x: 424, y: 116, column: 1 },
    { x: 8, y: 316, column: 0 },
  ]);
  assert.equal(plan.height, 436);
});

test("planMasonry handles an empty list", () => {
  assert.deepEqual(planMasonry([], 3, 300, 16, 8), {
    positions: [],
    height: 0,
    columnHeights: [0, 0, 0],
  });
});

test("content layout disables Pinterest transform transitions", () => {
  const contentScript = fs.readFileSync(
    path.join(__dirname, "../src/content/content.js"),
    "utf8"
  );

  assert.match(contentScript, /transition: none !important/);
});

test("content layout preserves positions while measuring a new layout", () => {
  const contentScript = fs.readFileSync(
    path.join(__dirname, "../src/content/content.js"),
    "utf8"
  );

  assert.match(contentScript, /POSITION_STYLE_ID/);
  assert.match(
    contentScript,
    /getStyleElement\(POSITION_STYLE_ID\)\.textContent = rules\.join/
  );
  assert.doesNotMatch(contentScript, /getStyleElement\(\)\.textContent \+=/);
});

test("content layout ignores unrelated DOM mutations", () => {
  const contentScript = fs.readFileSync(
    path.join(__dirname, "../src/content/content.js"),
    "utf8"
  );

  assert.match(contentScript, /function mutationNeedsLayout/);
  assert.match(contentScript, /if \(mutationNeedsLayout\(records\)\)/);
});

test("new cards stay hidden until they receive custom coordinates", () => {
  const contentScript = fs.readFileSync(
    path.join(__dirname, "../src/content/content.js"),
    "utf8"
  );

  assert.match(contentScript, /POSITIONED_ATTRIBUTE/);
  assert.match(contentScript, /:not\(\[\$\{POSITIONED_ATTRIBUTE\}\]\)/);
  assert.match(contentScript, /item\.setAttribute\(POSITIONED_ATTRIBUTE/);
});

test("card height measurement does not reuse the extension-owned outer height", () => {
  const contentScript = fs.readFileSync(
    path.join(__dirname, "../src/content/content.js"),
    "utf8"
  );
  const heightFunction = contentScript.match(
    /function getRenderedHeight\(item\) \{([\s\S]*?)\n  \}/
  );

  assert.ok(heightFunction);
  assert.match(contentScript, /pins\.length === 1 \? pins\[0\] : item\.firstElementChild/);
  assert.match(heightFunction[1], /getBoundingClientRect/);
  assert.doesNotMatch(heightFunction[1], /item\.scrollHeight|item\.offsetHeight/);
  assert.doesNotMatch(heightFunction[1], /Math\.max/);
});

test("content size changes trigger a fresh layout", () => {
  const contentScript = fs.readFileSync(
    path.join(__dirname, "../src/content/content.js"),
    "utf8"
  );

  assert.match(contentScript, /new ResizeObserver\(\(\) => scheduleLayout\(60\)\)/);
  assert.match(contentScript, /contentResizeObserver\.observe\(content\)/);
});
