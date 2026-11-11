/* Client-safe password strength for the meter on the invite page. */
/** Password strength 0..4 for the meter (server enforces only length >= 12, the meter nudges for more). */
export function passwordScore(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (pw.length < 12) return pw.length >= 8 ? 1 : 0;
  let classes = 0;
  for (const re of [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/]) if (re.test(pw)) classes++;
  let score = 2 + (classes >= 3 ? 1 : 0) + (pw.length >= 16 && classes >= 2 ? 1 : 0);
  if (/^(.)\1+$/.test(pw) || /^(?:password|123456|qwerty)/i.test(pw)) score = 1;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}
