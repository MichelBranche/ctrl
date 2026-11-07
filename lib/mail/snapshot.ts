/**
 * Short-lived memory cache for one mailbox on one warm server instance.
 * Fresh reads do not touch the network. Stale reads return immediately and refresh behind them.
 * A failed refresh keeps the last snapshot. invalidate() drops everything, including a load still in flight.
 */

export const LIST_FRESH_MS = 20_000;
export const LIST_STALE_MS = 90_000;
export const STALE_WARNING = "Aggiornamento non riuscito. Mostro l'ultima lista disponibile.";

export type CacheAge = "fresh" | "stale" | "live";
export type CacheHit<T> = { value: T; age: CacheAge; warning?: string };

export class SnapshotCache<T> {
  private entries = new Map<string, { value: T; at: number }>();
  private flights = new Map<string, Promise<T>>();
  private failed = new Set<string>();
  private epoch = 0;
  private freshMs: number;
  private staleMs: number;
  private max: number;
  private now: () => number;

  constructor(freshMs = LIST_FRESH_MS, staleMs = LIST_STALE_MS, max = 12, now: () => number = () => Date.now()) {
    this.freshMs = freshMs;
    this.staleMs = staleMs;
    this.max = max;
    this.now = now;
  }

  peek(key: string): { value: T; age: "fresh" | "stale" } | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    const age = this.now() - entry.at;
    if (age <= this.freshMs) return { value: entry.value, age: "fresh" };
    if (age <= this.staleMs) return { value: entry.value, age: "stale" };
    this.entries.delete(key);
    this.failed.delete(key);
    return null;
  }

  /** Drops stored lists and ignores a load that started before this call. */
  invalidate() {
    this.epoch += 1;
    this.entries.clear();
    this.flights.clear();
    this.failed.clear();
  }

  touch(fn: (value: T) => void) {
    for (const entry of this.entries.values()) fn(entry.value);
  }

  private store(key: string, value: T) {
    if (this.entries.size >= this.max && !this.entries.has(key)) {
      const first = this.entries.keys().next().value;
      if (first) this.entries.delete(first);
    }
    this.failed.delete(key);
    this.entries.set(key, { value, at: this.now() });
  }

  /** One network load per key. A newer invalidate() discards the result. */
  load(key: string, run: () => Promise<T>): Promise<T> {
    const existing = this.flights.get(key);
    if (existing) return existing;
    const epoch = this.epoch;
    const flight = (async () => {
      try {
        const value = await run();
        if (epoch === this.epoch) this.store(key, value);
        return value;
      } catch (error) {
        if (epoch === this.epoch && this.entries.has(key)) this.failed.add(key);
        throw error;
      } finally {
        if (this.flights.get(key) === flight) this.flights.delete(key);
      }
    })();
    this.flights.set(key, flight);
    return flight;
  }

  async read(key: string, run: () => Promise<T>): Promise<CacheHit<T>> {
    const hit = this.peek(key);
    if (hit?.age === "fresh") return { value: hit.value, age: "fresh" };
    if (hit?.age === "stale") {
      if (!this.flights.has(key)) void this.load(key, run).catch(() => {});
      return { value: hit.value, age: "stale", warning: this.failed.has(key) ? STALE_WARNING : undefined };
    }
    try {
      const value = await this.load(key, run);
      return { value, age: "live" };
    } catch (error) {
      const again = this.peek(key);
      if (again) return { value: again.value, age: again.age, warning: STALE_WARNING };
      throw error;
    }
  }
}
