/** URLs only: avatar image data is served behind the admin session. */
export function avatarFor(id: string, hasPhoto: boolean, updatedAt: unknown, email: string): string | null {
  if (hasPhoto) return `/admin/team/avatar?id=${encodeURIComponent(id)}&v=${encodeURIComponent(String(updatedAt ?? ""))}`;
  // JPEG for email clients (Outlook etc. often skip WebP in signatures).
  const known: Record<string, string> = { "michel.lavoro@gmail.com": "/team/photo-b.jpg", "kallebesiqueira@gmail.com": "/team/photo-a.jpg" };
  return known[email.toLowerCase()] ?? null;
}
