import type { FolderId, MailLabel, MailSummary } from "@/lib/mail/types";

/**
 * Last lists for the signed-in person, in this tab's memory only.
 * Not localStorage: a copied browser profile must not keep the mailbox,
 * and logout / a different account drops it. Summaries only, never HTML or attachments.
 */
export type ListSnap = {
  list: MailSummary[];
  total: number;
  folders: { id: FolderId; unread: number; total: number }[];
  labels: MailLabel[];
};

const MAX = 8;
let owner = "";
const entries = new Map<string, ListSnap>();
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };

export function subscribeMailMemory(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const mailListKey = (folder: string, page: number, search: string, category: string) =>
  `${folder}|${page}|${search}|${category}`;

export function noteMailOwner(id: string) {
  if (owner && owner !== id) {
    owner = "";
    entries.clear();
  }
  owner = id;
  emit();
}

export function clearMailMemory() {
  owner = "";
  entries.clear();
  emit();
}

export function rememberMailList(userId: string, key: string, snap: ListSnap) {
  if (!userId) return;
  if (owner !== userId) {
    entries.clear();
    owner = userId;
  }
  entries.set(key, snap);
  while (entries.size > MAX) {
    const first = entries.keys().next().value;
    if (!first) break;
    entries.delete(first);
  }
  emit();
}

export function readMailList(userId: string, key: string): ListSnap | null {
  if (!userId || owner !== userId) return null;
  return entries.get(key) ?? null;
}

/** Used by the route loading UI, which has no user prop. Empty after logout. */
export function readOwnList(key: string): ListSnap | null {
  if (!owner) return null;
  return entries.get(key) ?? null;
}
