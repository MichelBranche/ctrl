import { list, type ListBlobResultBlob } from "@vercel/blob";
import { Suspense } from "react";
import { MediaRow } from "@/components/admin/media-row";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export default function MediaPage() {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true"><p className="adm-muted">Caricamento…</p></main>}>
      <Body />
    </Suspense>
  );
}

const kb = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

async function Body() {
  await requireAdmin();
  const header = (
    <header className="adm-top">
      <div>
        <h1 className="adm-h1">Media</h1>
        <p className="adm-muted">Copertine caricate su Vercel Blob. Si caricano dall&apos;editor di un articolo.</p>
      </div>
    </header>
  );
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return (
      <main className="adm-main">
        {header}
        <p className="adm-note">Storage non configurato: manca BLOB_READ_WRITE_TOKEN.</p>
      </main>
    );
  }
  let blobs: ListBlobResultBlob[] = [];
  let error = false;
  try {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "covers/", cursor, limit: 1000 });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor && blobs.length < 5000);
    blobs = blobs.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
  } catch {
    error = true;
  }
  const usedBy = new Map<string, string[]>();
  try {
    const res = await db().execute("SELECT title, cover_url FROM posts WHERE cover_url IS NOT NULL AND cover_url != ''");
    for (const r of res.rows) {
      const u = String(r.cover_url);
      usedBy.set(u, [...(usedBy.get(u) ?? []), String(r.title)]);
    }
  } catch {
    // Without the DB we cannot warn about usage; the confirm dialog still asks.
  }
  const total = blobs.reduce((a, b) => a + b.size, 0);
  return (
    <main className="adm-main">
      {header}
      {error ? (
        <p className="adm-error" role="alert">Impossibile leggere lo storage.</p>
      ) : blobs.length === 0 ? (
        <p className="adm-note">Nessuna immagine caricata.</p>
      ) : (
        <>
          <p className="adm-muted">
            {blobs.length} file · {kb(total)}
          </p>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th aria-label="Anteprima" />
                  <th>File</th>
                  <th className="adm-num">Peso</th>
                  <th>Caricata</th>
                  <th>Usata da</th>
                  <th aria-label="Azioni" />
                </tr>
              </thead>
              <tbody>
                {blobs.map((b) => (
                  <MediaRow
                    key={b.url}
                    url={b.url}
                    name={b.pathname.replace(/^covers\//, "")}
                    size={kb(b.size)}
                    uploaded={new Date(b.uploadedAt).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}
                    usedBy={usedBy.get(b.url) ?? []}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
