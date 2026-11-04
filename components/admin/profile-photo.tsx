"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProfilePhoto } from "@/app/admin/profile-actions";

export function ProfilePhoto({ current, name }: { current: string | null; name: string }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (value: string | null) => start(async () => {
    const result = await saveProfilePhoto(value);
    setMessage(result.error ?? "Foto profilo aggiornata.");
    if (!result.error) { setPhoto(null); router.refresh(); window.dispatchEvent(new Event("ctrl-mail-changed")); }
  });
  return <div className="profile-photo-form">
    <div className="profile-photo-preview">{photo || current ? <Image src={photo || current!} alt={`Foto di ${name}`} width={80} height={80} unoptimized /> : <span>{name.slice(0, 2).toUpperCase()}</span>}</div>
    <label className="adm-field"><span>Foto profilo</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      setMessage("");
      if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMessage("Scegli una foto JPG, PNG o WebP fino a 5 MB."); return; }
      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256;
        const context = canvas.getContext("2d"); if (!context) { bitmap.close(); throw new Error(); }
        const side = Math.min(bitmap.width, bitmap.height);
        context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
        bitmap.close(); let url = canvas.toDataURL("image/webp", .82); if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", .85); setPhoto(url);
      } catch { setMessage("Impossibile leggere questa immagine. Scegli un’altra foto."); }
    }} /></label>
    <div className="adm-row-actions"><button className="adm-btn adm-btn-primary" type="button" disabled={!photo || pending} onClick={() => save(photo)}>{pending ? "Salvataggio…" : "Salva foto"}</button>{current ? <button className="adm-btn" type="button" disabled={pending} onClick={() => save(null)}>Rimuovi foto</button> : null}</div>
    <p role="status" className="adm-muted">{message}</p>
  </div>;
}
