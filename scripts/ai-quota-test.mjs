/**
 * Daily cap stored as a count. No network:
 *   node scripts/ai-quota-test.mjs
 */
import { spawnSync } from "node:child_process";
import { registerHooks } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

if (!process.execArgv.includes("--experimental-transform-types")) {
  const r = spawnSync(process.execPath, ["--experimental-transform-types", "--no-warnings", ...process.execArgv, new URL(import.meta.url).pathname, ...process.argv.slice(2)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

const dir = mkdtempSync(join(tmpdir(), "ai-quota-"));
const file = join(dir, "qa.db");
process.env.TURSO_DATABASE_URL = `file:${file}`;
delete process.env.TURSO_AUTH_TOKEN;
process.env.AI_DAILY_LIMIT = "2";

const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    const parent = ctx.parentURL ?? "";
    if (parent.includes("/node_modules/")) return next(spec, ctx);
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    if ((spec.startsWith("./") || spec.startsWith("../")) && !/\.[a-z]+$/i.test(spec)) return next(`${spec}.ts`, ctx);
    return next(spec, ctx);
  },
});

const assert = (await import("node:assert/strict")).default;
const { takeSlot, releaseSlot, remainingSlots } = await import("../lib/ai/quota.ts");

const first = await takeSlot("qa-michel");
const second = await takeSlot("qa-michel");
const third = await takeSlot("qa-michel");
assert.equal(first.ok, true);
assert.equal(second.ok, true);
assert.deepEqual(third, { ok: false, reason: "quota" });
assert.equal(await remainingSlots("qa-michel"), 0);
assert.equal((await takeSlot("qa-other")).ok, true, "the cap is per user");
await releaseSlot("qa-michel");
const again = await takeSlot("qa-michel");
assert.equal(again.ok, true);
assert.equal(await remainingSlots("qa-michel"), 0);
rmSync(dir, { recursive: true, force: true });
console.log("ai quota: all checks passed");
