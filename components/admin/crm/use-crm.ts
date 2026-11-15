"use client";

import { useAdminLocale } from "@/components/admin/locale-provider";
import {
  adminCrmActivityKindLabel,
  adminCrmMailReturnLabel,
  adminCrmPanelTabLabel,
  adminCrmPriorityLabel,
  adminCrmSourceLabel,
  adminCrmStageHint,
  adminCrmStageLabel,
  interpolate,
  type AdminDict,
  type AdminLocale,
} from "@/lib/admin-i18n";
import { day, eur } from "@/components/admin/crm/crm-ui";

export function useCrm(): {
  t: AdminDict;
  lang: AdminLocale;
  stage: (value: string) => string;
  stageHint: (value: string) => string;
  source: (value: string) => string;
  priority: (value: string) => string;
  kind: (value: string) => string;
  tab: (value: string) => string;
  mailReturn: (value: string) => string;
  eur: (value: number | null) => string;
  day: (iso: string | null) => string;
  i: (template: string, vars?: Record<string, unknown>) => string;
} {
  const { t, lang } = useAdminLocale();
  return {
    t,
    lang,
    stage: (value) => adminCrmStageLabel(lang, value),
    stageHint: (value) => adminCrmStageHint(lang, value),
    source: (value) => adminCrmSourceLabel(lang, value),
    priority: (value) => adminCrmPriorityLabel(lang, value),
    kind: (value) => adminCrmActivityKindLabel(lang, value),
    tab: (value) => adminCrmPanelTabLabel(lang, value),
    mailReturn: (value) => adminCrmMailReturnLabel(lang, value),
    eur: (value) => eur(value, lang),
    day: (iso) => day(iso, lang),
    i: (template, vars = {}) => interpolate(template, vars),
  };
}
