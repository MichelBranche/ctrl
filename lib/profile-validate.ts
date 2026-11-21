import "server-only";

/**
 * Profile rules shared by Impostazioni (profile-actions) and the invite onboarding (invite-actions).
 * Returns the admin-i18n `auth.*` key of the first error, or null.
 */
export type ProfileErrorKey = "nameInvalid" | "lastNameInvalid" | "phoneInvalid" | "photoInvalid" | "photoFormat";
const CTRL = /[\x00-\x1f\x7f]/;

export function profileFieldsError(p: { name: string; lastName: string; phone: string }): ProfileErrorKey | null {
  if (!p.name || p.name.length > 100 || CTRL.test(p.name)) return "nameInvalid";
  if (p.lastName.length > 100 || CTRL.test(p.lastName)) return "lastNameInvalid";
  if (p.phone && (p.phone.length > 40 || !/^[+0-9().\s-]{3,40}$/.test(p.phone))) return "phoneInvalid";
  return null;
}

/** Same checks as before: data URL ≤ 140 kB, real WebP or JPEG bytes ≤ 100 kB. */
export function photoError(photo: string): ProfileErrorKey | null {
  if (typeof photo !== "string" || photo.length > 140_000 || !/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)) return "photoInvalid";
  const bytes = Buffer.from(photo.split(",")[1], "base64");
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (bytes.length > 100_000 || (photo.startsWith("data:image/webp") ? !webp : !jpeg)) return "photoFormat";
  return null;
}
