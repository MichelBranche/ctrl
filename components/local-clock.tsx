"use client";

import { useSyncExternalStore } from "react";

const formatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Europe/Rome",
});

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 1000);
  return () => window.clearInterval(id);
}

const getSnapshot = () => formatter.format(new Date());
// Server and hydration render an empty-width placeholder; the client clock takes over right after.
const getServerSnapshot = () => "";

export function LocalClock() {
  const time = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <time suppressHydrationWarning aria-live="off">
      {time || "\u00a0"}
    </time>
  );
}

const noop = () => () => {};

/** Current year on the client, a stable build year during prerender. */
export function CurrentYear() {
  const year = useSyncExternalStore(
    noop,
    () => String(new Date().getFullYear()),
    () => "2026",
  );
  return <>{year}</>;
}
