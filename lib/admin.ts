import "server-only";
import { redirect } from "next/navigation";
import { supabaseConfigured } from "@/lib/supabase/config";
import { sessionClient } from "@/lib/supabase/server";

/** Comma separated allowlist from the ADMIN_EMAILS env var. Empty means nobody. */
export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Verifies the session with Supabase (getUser hits the Auth server, so a forged
 * cookie fails) and checks the env allowlist. RLS adds a second, database-side
 * allowlist (public.admin_emails) on every write.
 */
export async function getAdmin() {
  if (!supabaseConfigured) return null;
  const supabase = await sessionClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!email || !adminEmails().includes(email)) return null;
  return { supabase, email };
}

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
