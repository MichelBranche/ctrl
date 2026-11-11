import "server-only";
import { db } from "@/lib/db";
import { ensureCrmSchema } from "@/lib/migrate";
import { parseRubricaQuery, rubricaSearch, type RubricaQuery } from "@/lib/crm-nav";

export type SavedView = { id: string; ownerId: string; name: string; params: string; shared: boolean; mine: boolean };

const NAME = /^.{2,40}$/u;

/** Canonical filter string: segment, search, filters, sort and layout. No open contact and no page. */
export function viewParams(search: string): string | null {
  if (search.length > 1000) return null;
  const parsed = parseRubricaQuery(new URLSearchParams(search.replace(/^\?/, "")));
  const clean: RubricaQuery = { ...parsed, c: "", tab: "dettagli", p: 1 };
  return rubricaSearch(clean).replace(/^\?/, "");
}

export async function listSavedViews(userId: string): Promise<SavedView[]> {
  await ensureCrmSchema();
  const res = await db().execute({
    sql: `SELECT id, owner_id, name, params, shared FROM crm_saved_views
      WHERE owner_id = ? OR shared = 1 ORDER BY shared, name COLLATE NOCASE`,
    args: [userId],
  });
  return res.rows.map((r) => ({
    id: String(r.id), ownerId: String(r.owner_id), name: String(r.name), params: String(r.params),
    shared: Number(r.shared) === 1, mine: String(r.owner_id) === userId,
  }));
}

export async function createSavedView(input: { ownerId: string; name: string; search: string; shared: boolean; founder: boolean }): Promise<{ ok: true; id: string } | { error: string }> {
  const name = input.name.trim();
  if (!NAME.test(name)) return { error: "Il nome deve avere tra 2 e 40 caratteri." };
  if (input.shared && !input.founder) return { error: "Solo un founder può condividere una vista col team." };
  const params = viewParams(input.search);
  if (params === null) return { error: "Filtri troppo lunghi." };
  await ensureCrmSchema();
  const id = crypto.randomUUID();
  await db().execute({
    sql: "INSERT INTO crm_saved_views (id, owner_id, name, params, shared) VALUES (?, ?, ?, ?, ?)",
    args: [id, input.ownerId, name, params, input.shared ? 1 : 0],
  });
  return { ok: true, id };
}

async function loadView(id: string): Promise<SavedView | null> {
  const res = await db().execute({ sql: "SELECT id, owner_id, name, params, shared FROM crm_saved_views WHERE id = ?", args: [id] });
  const r = res.rows[0];
  if (!r) return null;
  return { id: String(r.id), ownerId: String(r.owner_id), name: String(r.name), params: String(r.params), shared: Number(r.shared) === 1, mine: false };
}

function canEdit(view: SavedView, userId: string, founder: boolean): boolean {
  if (view.ownerId === userId) return true;
  return founder && view.shared;
}

export async function renameSavedView(input: { id: string; userId: string; founder: boolean; name: string }): Promise<{ ok: true } | { error: string }> {
  const name = input.name.trim();
  if (!NAME.test(name)) return { error: "Il nome deve avere tra 2 e 40 caratteri." };
  await ensureCrmSchema();
  const view = await loadView(input.id);
  if (!view) return { error: "Vista non trovata." };
  if (!canEdit(view, input.userId, input.founder)) return { error: "Puoi rinominare solo le tue viste." };
  await db().execute({
    sql: "UPDATE crm_saved_views SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    args: [name, input.id],
  });
  return { ok: true };
}

export async function deleteSavedView(input: { id: string; userId: string; founder: boolean }): Promise<{ ok: true } | { error: string }> {
  await ensureCrmSchema();
  const view = await loadView(input.id);
  if (!view) return { error: "Vista non trovata." };
  if (!canEdit(view, input.userId, input.founder)) return { error: "Puoi eliminare solo le tue viste." };
  await db().execute({ sql: "DELETE FROM crm_saved_views WHERE id = ?", args: [input.id] });
  return { ok: true };
}
