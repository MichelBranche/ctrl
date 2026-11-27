import { getAdmin } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { dbConfigured } from "@/lib/db";
import {
  clearSiteTeamPhoto,
  createSiteTeamMember,
  deleteSiteTeamMember,
  parseInput,
  parsePhotoDataUrl,
  reorderSiteTeam,
  revalidateSiteTeam,
  saveSiteTeamPhoto,
  setSiteTeamActive,
  slugTaken,
  updateSiteTeamMember,
  FIELD_ERROR_IT,
} from "@/lib/site-team";
import { isFounder } from "@/lib/team-types";

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,80}$/;

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try { return Boolean(host) && new URL(origin).host === host; } catch { return false; }
}

async function guard(req: Request) {
  const admin = await getAdmin();
  if (!admin) return { error: json({ error: "Accedi di nuovo per continuare." }, 401) } as const;
  if (!isFounder(admin)) return { error: json({ error: "Questa sezione è riservata ai founder." }, 403) } as const;
  if (!sameOrigin(req)) return { error: json({ error: "Richiesta non valida." }, 403) } as const;
  if (!dbConfigured) return { error: json({ error: "Il database non è disponibile. Riprova più tardi." }, 503) } as const;
  return { admin } as const;
}

type Body = {
  action?: unknown;
  id?: unknown;
  ids?: unknown;
  isActive?: unknown;
  member?: unknown;
  dataUrl?: unknown;
};

/**
 * POST /api/admin/site-team
 * Founders only. Same-origin. Mutations for the public Team section.
 */
export async function POST(req: Request) {
  const gate = await guard(req);
  if ("error" in gate) return gate.error;
  const { admin } = gate;

  let body: Body;
  try { body = await req.json() as Body; } catch { return json({ error: "Richiesta non valida." }, 400); }
  const action = typeof body.action === "string" ? body.action : "";
  const id = typeof body.id === "string" ? body.id : "";
  if (action !== "create" && action !== "reorder" && !ID_RE.test(id)) return json({ error: "Persona non trovata." }, 400);

  try {
    switch (action) {
      case "create": {
        const parsed = parseInput(body.member);
        if (!parsed.ok) return json({ error: FIELD_ERROR_IT[parsed.field], field: parsed.field }, 400);
        if (await slugTaken(parsed.value.slug)) return json({ error: "Esiste già una persona con questo indirizzo interno.", field: "slug" }, 409);
        const member = await createSiteTeamMember(parsed.value);
        revalidateSiteTeam();
        await logAction("site_team.create", { type: "site_team", id: member.id }, { slug: member.slug }, admin);
        return json({ ok: true, member }, 201);
      }
      case "update": {
        const parsed = parseInput(body.member);
        if (!parsed.ok) return json({ error: FIELD_ERROR_IT[parsed.field], field: parsed.field }, 400);
        if (await slugTaken(parsed.value.slug, id)) return json({ error: "Esiste già una persona con questo indirizzo interno.", field: "slug" }, 409);
        const member = await updateSiteTeamMember(id, parsed.value);
        if (!member) return json({ error: "Persona non trovata." }, 404);
        revalidateSiteTeam();
        await logAction("site_team.update", { type: "site_team", id }, { slug: member.slug }, admin);
        return json({ ok: true, member }, 200);
      }
      case "toggle": {
        const member = await setSiteTeamActive(id, body.isActive !== false && body.isActive !== 0);
        if (!member) return json({ error: "Persona non trovata." }, 404);
        revalidateSiteTeam();
        await logAction("site_team.toggle", { type: "site_team", id }, { active: member.isActive }, admin);
        return json({ ok: true, member }, 200);
      }
      case "reorder": {
        const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
        if (!ids.length || ids.some((item) => !ID_RE.test(item))) return json({ error: "Ordine non valido." }, 400);
        if (!(await reorderSiteTeam(ids))) return json({ error: "Ordine non valido. Ricarica la pagina e riprova." }, 409);
        revalidateSiteTeam();
        await logAction("site_team.reorder", { type: "site_team" }, { n: ids.length }, admin);
        return json({ ok: true, ids }, 200);
      }
      case "delete": {
        if (!(await deleteSiteTeamMember(id))) return json({ error: "Persona non trovata." }, 404);
        revalidateSiteTeam();
        await logAction("site_team.delete", { type: "site_team", id }, undefined, admin);
        return json({ ok: true }, 200);
      }
      case "uploadPhoto": {
        if (typeof body.dataUrl !== "string") return json({ error: "Carica un'immagine JPG, PNG o WebP." }, 400);
        const parsed = parsePhotoDataUrl(body.dataUrl);
        if ("error" in parsed) return json({ error: parsed.error === "photoInvalid" ? "Carica un'immagine JPG, PNG o WebP, fino a 8 MB." : "L'immagine è troppo pesante anche dopo la compressione. Prova una foto più piccola." }, 400);
        const member = await saveSiteTeamPhoto(id, parsed.mime, parsed.bytes);
        if (!member) return json({ error: "Persona non trovata." }, 404);
        revalidateSiteTeam();
        await logAction("site_team.photo", { type: "site_team", id }, { mime: parsed.mime }, admin);
        return json({ ok: true, member }, 200);
      }
      case "clearPhoto": {
        const member = await clearSiteTeamPhoto(id);
        if (!member) return json({ error: "Persona non trovata." }, 404);
        revalidateSiteTeam();
        await logAction("site_team.photo_clear", { type: "site_team", id }, undefined, admin);
        return json({ ok: true, member }, 200);
      }
      default:
        return json({ error: "Richiesta non valida." }, 400);
    }
  } catch (error) {
    console.error("[admin] site-team:", error instanceof Error ? error.message : error);
    return json({ error: "Non è stato possibile salvare. Riprova tra poco." }, 500);
  }
}
