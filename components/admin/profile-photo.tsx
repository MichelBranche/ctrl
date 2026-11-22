"use client";

import Image from "next/image";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProfilePhoto } from "@/app/admin/profile-actions";
import { useAdminLocale } from "@/components/admin/locale-provider";
import { interpolate } from "@/lib/admin-i18n";

/** Allowed upload: JPG, PNG or WebP up to 5 MB (re-encoded below, the server re-checks the result). */
export const photoFileOk = (file: File) => file.size <= 5 * 1024 * 1024 && ["image/jpeg", "image/png", "image/webp"].includes(file.type);

/** Center-crops to a 256×256 JPEG data URL (what saveProfilePhoto and the invite onboarding accept). */
export async function squarePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256;
  const context = canvas.getContext("2d"); if (!context) { bitmap.close(); throw new Error("no canvas"); }
  const side = Math.min(bitmap.width, bitmap.height);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", .85);
}

/** Photo row for the profile card: preview, choose, save or remove. Same server action as before. */
export function ProfilePhoto({ current, name }: { current: string | null; name: string }) {
  const { t } = useAdminLocale();
  const id = useId();
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (value: string | null) => start(async () => {
    const result = await saveProfilePhoto(value);
    setMessage(result.error ? { text: result.error, tone: "error" } : { text: t.profile.photoUpdated, tone: "ok" });
    if (!result.error) { setPhoto(null); router.refresh(); window.dispatchEvent(new Event("ctrl-mail-changed")); }
  });
  return (
    <div className="st-row st-photo">
      <span className="st-row-label"><b>{t.settings.photoLabel}</b><small>{t.settings.photoHint}</small></span>
      <span className="st-row-control st-photo-control">
        <span className="st-photo-preview" data-new={photo ? "" : undefined}>
          {photo || current ? <Image src={photo || current!} alt={interpolate(t.profile.photoAlt, { name })} width={64} height={64} unoptimized /> : <span>{name.slice(0, 2).toUpperCase()}</span>}
        </span>
        <span className="st-photo-actions">
          <label className="rb-btn st-file" htmlFor={id} aria-disabled={pending || undefined}>
            {t.settings.photoChoose}
            <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} aria-label={t.profile.photo} onChange={async (event) => {
              const file = event.target.files?.[0]; if (!file) return;
              setMessage(null);
              if (!photoFileOk(file)) { setMessage({ text: t.profile.photoInvalid, tone: "error" }); return; }
              try { setPhoto(await squarePhoto(file)); }
              catch { setMessage({ text: t.profile.photoUnreadable, tone: "error" }); }
            }} />
          </label>
          {photo ? <button className="rb-cta rb-cta-sm" type="button" disabled={pending} onClick={() => save(photo)}>{pending ? t.profile.saving : t.profile.savePhoto}</button> : null}
          {photo ? <button className="rb-btn rb-btn-quiet" type="button" disabled={pending} onClick={() => setPhoto(null)}>{t.twoFactor.cancel}</button> : null}
          {current && !photo ? <button className="rb-btn rb-btn-quiet" type="button" disabled={pending} onClick={() => save(null)}>{t.profile.removePhoto}</button> : null}
        </span>
        <span role="status" className="st-status st-photo-msg" data-tone={message?.tone}>{message?.text ?? ""}</span>
      </span>
    </div>
  );
}
