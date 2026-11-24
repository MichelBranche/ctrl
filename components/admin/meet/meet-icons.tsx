/* Stroke icons for Riunioni (24px grid, currentColor). Usable from server and client components. */
export const MI = {
  video: "M3 7h12v10H3zM15 10l6-3v10l-6-3",
  plus: "M12 5v14M5 12h14",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  client: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  cal: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  ext: "M7 17L17 7M8 7h9v9",
  check: "M5 12l5 5L20 7",
  alert: "M12 8v5M12 16.5h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  plug: "M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5",
  left: "M15 18l-6-6 6-6",
  right: "M9 6l6 6-6 6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 18l-6-6 6-6",
  note: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3",
  title: "M4 7V5h16v2M9 19h6M12 5v14",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
};
export type IconName = keyof typeof MI;

export function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
