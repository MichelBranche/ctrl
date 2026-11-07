/**
 * Shapes shared by the server guard (lib/crm-outreach.ts) and the in-app warning dialog. No server imports here.
 *
 * - `owner_other`: the contact has a responsible person who is not you (active colleague or former member).
 * - `contacted_unassigned`: already contacted (stage past "nuovo" or an email on record) but nobody is responsible.
 * - `recent`: an email went to the contact in the last 24 hours, or a colleague wrote in the last 14 days.
 * - `uncertain`: the last send attempt ended with an unknown outcome (it may or may not have left): check Inviati first.
 */
export type OutreachReason = "uncertain" | "owner_other" | "contacted_unassigned" | "recent";

export type OutreachContactWarning = {
  id: string;
  name: string;
  reason: OutreachReason;
  ownerName: string | null;
  /** false when the responsible person left the team; null without owner. */
  ownerActive: boolean | null;
  lastSentAt: string | null;
  lastSentByName: string | null;
  /** The contact's email list in the CRM (never a new message). */
  mailHref: string;
};

export type OutreachWarning = {
  /** Detailed only for people who can open the CRM; Email-only users get a generic notice (no names, ids or links). */
  contacts: OutreachContactWarning[];
  generic: boolean;
  /** Opaque consent bound to the current state of every matched contact and to you; invalid as soon as anything changes. */
  ack: string;
  /** true when a consent was sent but the state changed since it was given. */
  updated: boolean;
};
