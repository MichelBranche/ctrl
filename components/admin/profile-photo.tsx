"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
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

export function ProfilePhoto({ current, name }: { current: string | null; name: string }) {
  const { t } = useAdminLocale();
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (value: string | null) => start(async () => {
    const result = await saveProfilePhoto(value);
    setMessage(result.error ?? t.profile.photoUpdated);
    if (!result.error) { setPhoto(null); router.refresh(); window.dispatchEvent(new Event("ctrl-mail-changed")); }
  });
  return <div className="profile-photo-form">
    <div className="profile-photo-preview">{photo || current ? <Image src={photo || current!} alt={interpolate(t.profile.photoAlt, { name })} width={80} height={80} unoptimized /> : <span>{name.slice(0, 2).toUpperCase()}</span>}</div>
    <label className="adm-field"><span>{t.profile.photo}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      setMessage("");
      if (!photoFileOk(file)) { setMessage(t.profile.photoInvalid); return; }
      try { setPhoto(await squarePhoto(file)); }
      catch { setMessage(t.profile.photoUnreadable); }
    }} /></label>
    <div className="adm-row-actions"><button className="adm-btn adm-btn-primary" type="button" disabled={!photo || pending} onClick={() => save(photo)}>{pending ? t.profile.saving : t.profile.savePhoto}</button>{current ? <button className="adm-btn" type="button" disabled={pending} onClick={() => save(null)}>{t.profile.removePhoto}</button> : null}</div>
    <p role="status" className="adm-muted">{message}</p>
  </div>;
}
