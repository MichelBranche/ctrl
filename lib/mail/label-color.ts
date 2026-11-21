const DOTS = ["#8b5cf6", "#f26522", "#9ca3af", "#22a06b", "#3b82f6", "#e5a50a", "#ec4899", "#14b8a6"];
/** Stable color per label name (Gmail label colors are not exposed over IMAP). Shared by server and client. */
export function labelColor(name: string): string {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return DOTS[h % DOTS.length];
}
