/*
 * Mailbox list cache, no network and no mailbox credentials:
 *   node scripts/mail-speed-test.mjs
 * Cold load waits on the provider. A second read inside the fresh window does not.
 * Stale data returns immediately and refreshes behind it. A failed refresh keeps the list.
 * invalidate() drops an in-flight result. Two caches and two users do not share rows.
 */
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

const { SnapshotCache, STALE_WARNING } = await import("../lib/mail/snapshot.ts");
const { clearMailMemory, mailListKey, noteMailOwner, readMailList, rememberMailList } = await import("../lib/mail/list-memory.ts");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const summary = (subject) => ({
  folder: "inbox", uid: 1, key: "k", from: { name: "A", address: "a@example.test" }, to: [],
  subject, date: "2026-11-07T09:00:00.000Z", seen: false, hasAttachments: false, threadId: null,
});

// 1. Cold vs warm, measured on this machine with a 40ms fake provider. Not a Gmail latency.
{
  let calls = 0;
  const cache = new SnapshotCache(1_000, 5_000);
  const load = () => {
    calls += 1;
    return wait(40).then(() => "headers");
  };
  const coldStart = performance.now();
  const cold = await cache.read("inbox", load);
  const coldMs = performance.now() - coldStart;
  const warmStart = performance.now();
  const warm = await cache.read("inbox", load);
  const warmMs = performance.now() - warmStart;
  assert.equal(cold.value, "headers");
  assert.equal(cold.age, "live");
  assert.equal(warm.age, "fresh");
  assert.equal(calls, 1, "warm read does not call the provider");
  assert.ok(coldMs >= 35, `cold ${coldMs.toFixed(1)}ms should include the 40ms provider`);
  assert.ok(warmMs < 15, `warm ${warmMs.toFixed(1)}ms should be memory only`);
  console.log(`ok cold/warm  provider=${coldMs.toFixed(1)}ms  memory=${warmMs.toFixed(1)}ms`);
}

// 2. Concurrent readers share one load. A new key does not.
{
  let calls = 0;
  const cache = new SnapshotCache(1_000, 5_000);
  const load = () => {
    calls += 1;
    return wait(30).then(() => "same");
  };
  const [a, b, c] = await Promise.all([cache.read("inbox", load), cache.read("inbox", load), cache.read("inbox", load)]);
  assert.equal(calls, 1);
  assert.deepEqual([a.value, b.value, c.value], ["same", "same", "same"]);
  await cache.read("sent", () => { calls += 1; return Promise.resolve("other"); });
  assert.equal(calls, 2);
  console.log("ok concurrent dedupe");
}

// 3. Stale returns before the slow refresh. A failed refresh keeps the old list and says so.
{
  let t = 0;
  let mode = "ok";
  const cache = new SnapshotCache(20, 100, 12, () => t);
  const load = () => mode === "fail" ? Promise.reject(new Error("down")) : Promise.resolve(mode);
  assert.equal((await cache.read("inbox", load)).age, "live");
  t = 30;
  mode = "fail";
  const start = performance.now();
  const stale = await cache.read("inbox", load);
  const staleMs = performance.now() - start;
  assert.equal(stale.age, "stale");
  assert.equal(stale.value, "ok");
  assert.ok(staleMs < 15, `stale returned in ${staleMs.toFixed(1)}ms`);
  await wait(0);
  const again = await cache.read("inbox", load);
  assert.equal(again.value, "ok");
  assert.equal(again.warning, STALE_WARNING);
  t = 200;
  const fresh = await cache.read("inbox", async () => "new");
  assert.equal(fresh.value, "new");
  assert.equal(fresh.age, "live");
  console.log(`ok stale/error  staleReturn=${staleMs.toFixed(1)}ms`);
}

// 4. Cold failure has nothing to show. invalidate() forgets an in-flight result.
{
  const cache = new SnapshotCache(1_000, 5_000);
  await assert.rejects(() => cache.read("inbox", () => Promise.reject(new Error("down"))), /down/);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const abandoned = cache.read("inbox", () => gate.then(() => "old"));
  cache.invalidate();
  release();
  assert.equal((await abandoned).value, "old");
  const next = await cache.read("inbox", async () => "new");
  assert.equal(next.value, "new");
  assert.equal(next.age, "live");
  console.log("ok abort/reentry");
}

// 5. Two mailbox caches, and the tab memory, stay apart. Logout drops the tab memory.
{
  const agency = new SnapshotCache(1_000, 5_000);
  const other = new SnapshotCache(1_000, 5_000);
  await agency.read("inbox", async () => "agency");
  await other.read("inbox", async () => "other");
  assert.equal((await agency.read("inbox", async () => "nope")).value, "agency");
  assert.equal((await other.read("inbox", async () => "nope")).value, "other");

  const row = summary("Bozza homepage");
  rememberMailList("user-a", mailListKey("inbox", 1, "", ""), { list: [row], total: 1, folders: [], labels: [] });
  assert.equal(readMailList("user-a", mailListKey("inbox", 1, "", "")).list[0].subject, "Bozza homepage");
  assert.equal(readMailList("user-b", mailListKey("inbox", 1, "", "")), null);
  assert.equal("html" in row, false);
  noteMailOwner("user-b");
  assert.equal(readMailList("user-a", mailListKey("inbox", 1, "", "")), null, "account switch drops the previous list");
  rememberMailList("user-b", mailListKey("inbox", 1, "", ""), { list: [summary("Altro")], total: 1, folders: [], labels: [] });
  clearMailMemory();
  assert.equal(readMailList("user-b", mailListKey("inbox", 1, "", "")), null, "logout drops the list");
  console.log("ok isolation");
}

console.log("mail-speed-test: all passed");
