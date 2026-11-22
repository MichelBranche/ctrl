import "@/components/ds/admin-ui.css";
import { AgendaDetail, QuotesDetail } from "../view";
import { requireSection } from "@/lib/admin";
import { getAdminLocale } from "@/lib/admin-locale";
import { adminDict } from "@/lib/admin-i18n";
import { fetchQuotesMetrics, isEcosystemApp } from "@/lib/ecosystem-metrics";
import { notFound } from "next/navigation";

export default async function EcosistemaAppPage({ params }: { params: Promise<{ app: string }> }) {
  await requireSection("ecosistema");
  const { app } = await params;
  if (!isEcosystemApp(app)) notFound();
  const lang = await getAdminLocale();
  const t = adminDict[lang].ecosystem;
  if (app === "agenda") {
    return (
      <main className="eco">
        <AgendaDetail t={t} />
      </main>
    );
  }
  const quotes = await fetchQuotesMetrics();
  return (
    <main className="eco">
      <QuotesDetail t={t} lang={lang} result={quotes} />
    </main>
  );
}
