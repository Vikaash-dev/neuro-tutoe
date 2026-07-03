import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("recall friction font hook uses Sans Forgetica with safe fallbacks", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(css, /--recall-font:/);
  assert.match(css, /Sans Forgetica/);
  assert.match(css, /\.recall-friction-text/);
  assert.doesNotMatch(css, /letter-spacing:\s*-/);
});
