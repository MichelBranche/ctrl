import { canAccess, type Perms } from "@/lib/team-types";

/**
 * What the Panoramica may load for a user. Founders see studio-wide totals and revenue; members only the blocks of the
 * sections their area already opens. Used to decide which queries run at all, so nothing outside the scope is even
 * fetched on the server (hiding UI alone would still stream the numbers in the RSC payload).
 */
export type OverviewScope = {
  traffic: boolean;
  requests: boolean;
  subscribers: boolean;
  posts: boolean;
  /** Shop revenue and order totals. */
  revenue: boolean;
  /** Activity kinds for the feed; undefined = all (founder). */
  activity: ("post" | "request" | "subscriber" | "order")[] | undefined;
};

export function overviewScope(me: Perms): OverviewScope {
  const founder = me.role === "founder";
  const kinds = (["post", "request", "subscriber", "order"] as const).filter((k) =>
    canAccess(me, ({ post: "journal", request: "requests", subscriber: "newsletter", order: "shop" } as const)[k]),
  );
  return {
    traffic: canAccess(me, "stats"),
    requests: canAccess(me, "requests"),
    subscribers: canAccess(me, "newsletter"),
    posts: canAccess(me, "journal"),
    revenue: founder,
    activity: founder ? undefined : [...kinds],
  };
}
