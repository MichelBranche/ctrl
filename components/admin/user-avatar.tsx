"use client";

import Image from "next/image";
import { useState } from "react";

/** Decorative when paired with a visible account name or labelled account control. */
export function UserAvatar({ name, src, small = false }: { name: string; src?: string | null; small?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  return <span className={`adm-user-avatar${small ? " is-small" : ""}`} aria-hidden="true">
    {src && src !== failed ? <Image src={src} alt="" width={36} height={36} unoptimized onError={() => setFailed(src)} /> : initials}
  </span>;
}
