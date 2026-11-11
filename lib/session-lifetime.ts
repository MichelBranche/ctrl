/**
 * Absolute admin session lengths, shared by the server and the sign-in form.
 * The JWT exp and the cookie Max-Age are the same deadline. Nothing refreshes them on later requests.
 */
export const SESSION_HOURS = 12;
/** Opt-in on a trusted device, issued only after password and 2FA (when 2FA is required). */
export const REMEMBER_HOURS = 72;
