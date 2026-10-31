import { Suspense } from "react";
import { SocialForm } from "@/components/admin/social-form";
import { requireAdmin } from "@/lib/admin";
import { readSettings, SOCIAL_KEYS, SOCIAL_LABEL } from "@/lib/settings";

const API_NOTES: Record<string, string> = {
  instagram: "Graph API gratuita, ma serve un account Business/Creator collegato a una Pagina Facebook e la revisione dell'app Meta.",
  linkedin: "API gratuita solo per app approvate; leggere i post di una pagina richiede la Community Management API (revisione).",
  x: "Il piano gratuito non permette di leggere i post; la lettura è a pagamento. Escluso dalla regola costo zero.",
  tiktok: "Display API gratuita dopo la revisione dell'app TikTok for Developers.",
  youtube: "YouTube Data API v3 gratuita con una chiave API (quota giornaliera). La più semplice da collegare.",
  behance: "Nessuna API pubblica: le nuove chiavi non vengono più rilasciate.",
  github: "REST API gratuita, anche senza token per i dati pubblici (limiti orari).",
};

export default function SocialPage() {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true"><p className="adm-muted">Caricamento…</p></main>}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  await requireAdmin();
  let values: Record<string, string> = {};
  let error = false;
  try {
    values = await readSettings(SOCIAL_KEYS.map((k) => `social.${k}`));
  } catch {
    error = true;
  }
  return (
    <main className="adm-main">
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Social</h1>
          <p className="adm-muted">Gli URL salvati compaiono nel footer e nella pagina contatti. I campi vuoti restano nascosti.</p>
        </div>
      </header>
      {error ? <p className="adm-error" role="alert">Impossibile leggere le impostazioni.</p> : null}
      <SocialForm keys={[...SOCIAL_KEYS]} labels={SOCIAL_LABEL} initial={Object.fromEntries(SOCIAL_KEYS.map((k) => [k, values[`social.${k}`] ?? ""]))} />
      <section className="adm-panel">
        <h2 className="adm-h2">Collegamenti automatici</h2>
        <p className="adm-muted">Per ora nessun collegamento via OAuth: questi pulsanti sono segnaposto. Note sulle API gratuite:</p>
        <ul className="adm-list">
          {SOCIAL_KEYS.map((k) => (
            <li key={k} className="adm-api-row">
              <strong>{SOCIAL_LABEL[k]}</strong>
              <span className="adm-muted">{API_NOTES[k]}</span>
              <button type="button" className="adm-btn adm-btn-sm" disabled title="Non ancora disponibile">
                Collega
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
