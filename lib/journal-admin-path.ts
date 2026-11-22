/** Canonical admin URLs for the journal editor and its media library. */
export const JOURNAL_NEW = "/admin/journal/new";
export const JOURNAL_MEDIA = "/admin/journal/media";

export function journalEditPath(id: string, warning?: string) {
  const query = warning ? `?tw=${encodeURIComponent(warning)}` : "";
  return `/admin/journal/${id}${query}`;
}
