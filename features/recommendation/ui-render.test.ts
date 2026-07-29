/**
 * Frontend structure tests. These inspect the source rather than mounting a
 * browser DOM so the repository's lightweight Node test runner stays enough.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rowSource = readFileSync("components/search/ranked-result-row.tsx", "utf8");
const experienceSource = readFileSync("components/search/search-experience.tsx", "utf8");
const languageSource = readFileSync("components/search/search-language.ts", "utf8");
const stylesSource = readFileSync("components/search/search-results.module.css", "utf8");

test("ranked row exposes expansion state without making the whole row a button", () => {
  assert.match(rowSource, /<article/);
  assert.match(rowSource, /aria-expanded=\{expanded\}/);
  assert.match(rowSource, /aria-controls=\{panelId\}/);
  assert.doesNotMatch(rowSource, /<button[^>]*>\s*<article/);
});

test("visit, save, compare, and expansion are separate controls", () => {
  assert.match(rowSource, /saveAriaLabel\(item, saveState, isAuthenticated\)/);
  assert.match(rowSource, /saveActionCopy\(saveState, isAuthenticated\)/);
  assert.match(rowSource, /onClick=\{onSave\}/);
  assert.match(rowSource, /Visit \$\{item\.name\}/);
  assert.match(rowSource, /Compare/);
  assert.match(rowSource, /Details/);
});

test("the UI requests the ranked contract and supports loading another page", () => {
  assert.match(experienceSource, /contract: "ranked"/);
  assert.match(experienceSource, /limit: 12/);
  assert.match(experienceSource, /cursor: response\.nextCursor/);
  assert.match(experienceSource, /loadingMore/);
});

test("public search UI does not contain legacy model or fit-score language", () => {
  const publicSource = `${rowSource}\n${experienceSource}\n${languageSource}`;
  assert.doesNotMatch(publicSource, /Understood as|Moderate confidence|Fit score|Semantic fit|Candidate source/);
  assert.doesNotMatch(experienceSource, /title=\{response\.title\}|body=\{response\.message\}/);
  assert.match(experienceSource, /searchStateCopy/);
});

test("ranked-list styles cover target breakpoints and reduced motion", () => {
  for (const breakpoint of ["1160px", "920px", "760px", "480px"]) {
    assert.ok(stylesSource.includes(breakpoint), `missing responsive breakpoint ${breakpoint}`);
  }
  assert.match(stylesSource, /prefers-reduced-motion: reduce/);
  assert.match(stylesSource, /overflow-x: auto/);
});
