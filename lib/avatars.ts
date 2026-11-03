/** URLs only: avatar image data is served behind the admin session. */
export function avatarFor(id: string, hasPhoto: boolean, updatedAt: unknown, email: string): string | null {
  if (hasPhoto) return `/admin/team/avatar?id=${encodeURIComponent(id)}&v=${encodeURIComponent(String(updatedAt ?? ""))}`;
  const known: Record<string, string> = { "michel.lavoro@gmail.com": "/team/photo-b.webp", "kallebesiqueira@gmail.com": "/team/photo-a.webp" };
  return known[email.toLowerCase()] ?? null;
}
