"use client";

import type { ReactNode } from "react";
import { useAdminLocale } from "@/components/admin/locale-provider";

type BusyKey = "loading" | "loadingCrm" | "loadingRubrica" | "loadingPipeline" | "loadingContactMail" | "loadingRadar";

export function CrmBusy({ k = "loading", className, children }: { k?: BusyKey; className?: string; children?: ReactNode }) {
  const { t } = useAdminLocale();
  return (
    <div className={className} aria-busy="true" aria-label={t.crm[k]}>
      {children ?? <p className="adm-muted">{t.crm[k]}</p>}
    </div>
  );
}
