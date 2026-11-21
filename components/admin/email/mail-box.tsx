"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MailboxId } from "@/lib/mail/mailbox-types";

/** The mailbox the page shows. Client actions pass it to the server, which re-checks the permission. */
const BoxContext = createContext<MailboxId>("hello");
export function MailBoxProvider({ box, children }: { box: MailboxId; children: ReactNode }) {
  return <BoxContext.Provider value={box}>{children}</BoxContext.Provider>;
}
export const useMailBox = () => useContext(BoxContext);
