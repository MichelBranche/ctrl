"use client";

import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import { deleteShopProduct, saveShopProduct, uploadShopImage, type ActionState } from "@/app/admin/dashboard-actions";
import type { ShopProduct } from "@/lib/shop";

async function compress(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", .84));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
  } catch { return file; }
}

export function ShopProductForm({ product }: { product?: ShopProduct }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveShopProduct, {});
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, startUpload] = useTransition();
  const [deleting, startDelete] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const isNew = !product;

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    startUpload(async () => {
      const picked = Array.from(files).slice(0, Math.max(0, 6 - images.length));
      if (!picked.length) { setUploadMessage("Puoi caricare al massimo 6 immagini."); return; }
      for (const original of picked) {
        if (!original.type.startsWith("image/")) { setUploadMessage("Il file selezionato non è un’immagine."); continue; }
        setUploadMessage("Ottimizzazione e caricamento immagine…");
        const form = new FormData();
        form.set("file", await compress(original));
        const result = await uploadShopImage(form);
        if (result.url) setImages((current) => [...current, result.url!]);
        else setUploadMessage(result.error ?? "Caricamento non riuscito.");
      }
      setUploadMessage("Immagini aggiornate.");
    });
  }

  return <form action={action} className="adm-panel adm-form shop-admin-product">
    {product ? <input type="hidden" name="id" value={product.id} /> : null}
    {product ? <input type="hidden" name="slug" value={product.slug} /> : null}
    <input type="hidden" name="images" value={JSON.stringify(images)} />
    <div className="shop-admin-product-head"><div><h2 className="adm-h2">{isNew ? "Aggiungi un prodotto" : product.titleIt}</h2>{product ? <p className="adm-muted">URL: /shop/{product.slug}</p> : null}</div>
      {product ? <button type="button" className="adm-btn adm-btn-danger" disabled={deleting} onClick={() => { if (confirm(`Eliminare “${product.titleIt}” dallo shop?`)) startDelete(async () => { await deleteShopProduct(product.id); window.location.reload(); }); }}>{deleting ? "Eliminazione…" : "Elimina"}</button> : null}
    </div>
    <label className="adm-toggle"><input type="checkbox" name="published" defaultChecked={product?.published ?? true} /><span>Pubblicato nello shop</span></label>
    <div className="shop-admin-images">
      {images.map((url, index) => <div className="shop-admin-image" key={`${url}-${index}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded product image */}
        <img src={url} alt={`Anteprima immagine ${index + 1}`} />
        <button type="button" className="adm-btn adm-btn-danger" aria-label={`Rimuovi immagine ${index + 1}`} onClick={() => setImages((current) => current.filter((_, i) => i !== index))}>×</button>
      </div>)}
      {images.length < 6 ? <button type="button" className="shop-admin-upload" onClick={() => fileInput.current?.click()} disabled={uploading}><span>＋</span><span>Carica immagini</span></button> : null}
      <input ref={fileInput} className="adm-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
    </div>
    <p className="adm-muted" role="status">{uploadMessage || "Carica fino a 6 immagini (JPG, PNG, WebP o AVIF; max 5 MB ciascuna)."}</p>
    <div className="adm-grid2">
      <label className="adm-field"><span>Titolo (italiano)</span><input className="adm-input" name="titleIt" defaultValue={product?.titleIt ?? ""} maxLength={100} required /></label>
      <label className="adm-field"><span>Titolo (inglese)</span><input className="adm-input" name="titleEn" defaultValue={product?.titleEn ?? ""} maxLength={100} required /></label>
      <label className="adm-field"><span>Descrizione (italiano)</span><textarea className="adm-input" name="descriptionIt" defaultValue={product?.descriptionIt ?? ""} maxLength={1000} rows={4} required /></label>
      <label className="adm-field"><span>Descrizione (inglese)</span><textarea className="adm-input" name="descriptionEn" defaultValue={product?.descriptionEn ?? ""} maxLength={1000} rows={4} required /></label>
      <label className="adm-field"><span>Prezzo in euro</span><input className="adm-input" name="price" type="number" min="0.01" max="99999" step="0.01" defaultValue={product?.price ?? ""} required /></label>
    </div>
    <div className="adm-row-actions"><button className="adm-btn adm-btn-primary" disabled={pending || uploading || images.length === 0}>{pending ? "Salvataggio…" : isNew ? "Aggiungi prodotto" : "Salva modifiche"}</button><p role="status" className={state.error ? "adm-error" : "adm-ok"}>{state.error ?? state.ok ?? ""}</p></div>
  </form>;
}
