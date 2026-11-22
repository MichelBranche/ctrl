import "@/components/ds/admin-ui.css";
import "@/components/ds/rubrica.css";
import "@/components/ds/settings.css";
import { Suspense } from "react";
import { SocialForm } from "@/components/admin/social-form";
import { SettingsNav } from "@/components/admin/settings-ui";
import { requireSection } from "@/lib/admin";
import { readSettings, SOCIAL_KEYS, SOCIAL_LABEL } from "@/lib/settings";
import { getAdminCopy } from "@/lib/admin-locale";
import { settingsNav } from "@/lib/settings-nav";

/** Free-API notes per network; `cost` only colours the label (free, review needed, paid or none). */
const API_NOTES: Record<string, { cost: "free" | "review" | "paid" | "none"; note: string }> = {
  instagram: { cost: "review", note: "Graph API gratuita, ma serve un account Business/Creator collegato a una Pagina Facebook e la revisione dell'app Meta." },
  linkedin: { cost: "review", note: "API gratuita solo per app approvate; leggere i post di una pagina richiede la Community Management API (revisione)." },
  x: { cost: "paid", note: "Il piano gratuito non permette di leggere i post; la lettura è a pagamento. Escluso dalla regola costo zero." },
  tiktok: { cost: "review", note: "Display API gratuita dopo la revisione dell'app TikTok for Developers." },
  youtube: { cost: "free", note: "YouTube Data API v3 gratuita con una chiave API (quota giornaliera). La più semplice da collegare." },
  behance: { cost: "none", note: "Nessuna API pubblica: le nuove chiavi non vengono più rilasciate." },
  github: { cost: "free", note: "REST API gratuita, anche senza token per i dati pubblici (limiti orari)." },
};
const COST_LABEL = { free: "Gratuita", review: "Con revisione", paid: "A pagamento", none: "Nessuna API" } as const;

export default function SocialPage() {
  return (
    <Suspense fallback={<main className="ds-page rb st" aria-busy="true"><div className="st-layout"><div className="st-skel st-skel-nav" /><div className="st-body"><div className="st-skel" style={{ height: "24rem" }} /></div></div></main>}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const [, { t }] = await Promise.all([requireSection("social"), getAdminCopy()]);
  let values: Record<string, string> = {};
  let error = false;
  try {
    values = await readSettings(SOCIAL_KEYS.map((k) => `social.${k}`));
  } catch {
    error = true;
  }
  const initial = Object.fromEntries(SOCIAL_KEYS.map((k) => [k, values[`social.${k}`] ?? ""]));
  const shown = SOCIAL_KEYS.filter((k) => initial[k]).length;
  return (
    <main className="ds-page rb st">
      <div className="st-layout">
        <SettingsNav items={settingsNav(t, { social: true, onMain: false })} current="sito" label={t.settings.navLabel} />
        <div className="st-body">
          <header className="st-head">
            <p className="rb-kicker">{t.settings.title} · {t.settings.navGroupWorkspace}</p>
            <h1>{t.settings.navSite}</h1>
            <p className="st-lead">Gli URL salvati compaiono nel footer e nella pagina contatti. I campi vuoti restano nascosti.</p>
          </header>
          {error ? <p className="st-alert" role="alert">Impossibile leggere le impostazioni.</p> : null}

          <section className="st-card" aria-labelledby="st-social-h">
            <div className="st-card-head">
              <div><h2 id="st-social-h">Profili social</h2><p>Un indirizzo completo per rete, con https://.</p></div>
              <span className="st-badge" data-tone={shown ? "ok" : "quiet"}><i aria-hidden="true" />{shown} su {SOCIAL_KEYS.length} visibili</span>
            </div>
            <SocialForm keys={[...SOCIAL_KEYS]} labels={SOCIAL_LABEL} initial={initial} />
          </section>

          <section className="st-card" aria-labelledby="st-api-h">
            <div className="st-card-head">
              <div><h2 id="st-api-h">Collegamenti automatici</h2><p>Per ora nessun collegamento via OAuth: i pulsanti sono segnaposto. Note sulle API gratuite.</p></div>
            </div>
            <ul className="st-rows st-api">
              {SOCIAL_KEYS.map((k) => (
                <li key={k} className="st-row">
                  <span className="st-row-label"><b>{SOCIAL_LABEL[k]}</b><span className="st-cost" data-cost={API_NOTES[k]?.cost}>{COST_LABEL[API_NOTES[k]?.cost ?? "none"]}</span></span>
                  <span className="st-row-control st-api-control">
                    <small>{API_NOTES[k]?.note}</small>
                    <button type="button" className="rb-btn" disabled title="Non ancora disponibile">Collega</button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
