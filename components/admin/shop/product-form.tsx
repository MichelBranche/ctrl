"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteShopProduct, discardShopImage, saveShopProduct, uploadShopImage, type ShopActionState } from "@/app/admin/shop-actions";
import { benefitsToText, SHOP_CATEGORIES, SHOP_CATEGORY_LABEL, type ShopProductAdmin } from "@/lib/shop-data";

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

const FLASH = "ctrl-shop-admin-flash";

export function ShopProductForm({ product, translationReady }: { product?: ShopProductAdmin; translationReady: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ShopActionState, FormData>(saveShopProduct, {});
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, startUpload] = useTransition();
  const [deleting, startDelete] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const savedImages = useRef(new Set(product?.images ?? []));
  const isNew = !product;
  const formKey = product?.id ?? "new";

  // Message survives the remount that follows a save (the page re-renders the form with the stored values).
  const [flash] = useState<ShopActionState>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = sessionStorage.getItem(FLASH);
      const data = raw ? (JSON.parse(raw) as ShopActionState & { key?: string }) : null;
      if (data?.key !== formKey) return {};
      sessionStorage.removeItem(FLASH);
      return data;
    } catch { return {}; }
  });
  useEffect(() => {
    if (!state.ok) return;
    try { sessionStorage.setItem(FLASH, JSON.stringify({ ...state, key: formKey })); } catch { /* storage disabled */ }
    router.refresh();
  }, [state, formKey, router]);

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
      setUploadMessage("Immagini aggiornate. Salva per confermare.");
    });
  }

  function removeImage(index: number) {
    const url = images[index];
    setImages((current) => current.filter((_, i) => i !== index));
    // Never-saved uploads are deleted now; saved ones are deleted from storage when the product is saved without them.
    if (!savedImages.current.has(url)) void discardShopImage(url);
  }

  const shown = state.ok ? {} : state;
  const message = shown.error ?? flash.ok ?? "";
  const warning = shown.warning ?? flash.warning;
  const d = product?.details;

  return <form action={action} className="adm-panel adm-form shop-admin-product">
    {product ? <input type="hidden" name="id" value={product.id} /> : null}
    <input type="hidden" name="images" value={JSON.stringify(images)} />
    <div className="shop-admin-product-head"><div><h2 className="adm-h2">{isNew ? "Aggiungi un prodotto" : product.titleIt}</h2>{product ? <p className="adm-muted">URL: /shop/{product.slug} · Inglese: {product.enAuto ? "tradotto automaticamente" : "modificato a mano"}</p> : null}</div>
      {product ? <button type="button" className="adm-btn adm-btn-danger" disabled={deleting} onClick={() => { if (confirm(`Eliminare “${product.titleIt}” dallo shop? Anche le immagini caricate verranno eliminate.`)) startDelete(async () => { await deleteShopProduct(product.id); router.refresh(); }); }}>{deleting ? "Eliminazione…" : "Elimina"}</button> : null}
    </div>
    <label className="adm-toggle"><input type="checkbox" name="published" defaultChecked={product?.published ?? true} /><span>Pubblicato nello shop</span></label>
    <div className="shop-admin-images">
      {images.map((url, index) => <div className="shop-admin-image" key={`${url}-${index}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded product image */}
        <img src={url} alt={`Anteprima immagine ${index + 1}`} />
        <button type="button" className="adm-btn adm-btn-danger" aria-label={`Rimuovi immagine ${index + 1}`} onClick={() => removeImage(index)}>×</button>
      </div>)}
      {images.length < 6 ? <button type="button" className="shop-admin-upload" onClick={() => fileInput.current?.click()} disabled={uploading}><span>＋</span><span>Carica immagini</span></button> : null}
      <input ref={fileInput} className="adm-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
    </div>
    <p className="adm-muted" role="status">{uploadMessage || "Carica fino a 6 immagini (JPG, PNG, WebP o AVIF; max 5 MB ciascuna). La prima è la copertina."}</p>

    <div className="adm-grid2">
      <label className="adm-field"><span>URL (slug)</span><input className="adm-input" name="slug" defaultValue={product?.slug ?? ""} maxLength={70} pattern="[a-zA-Z0-9\- ]*" placeholder="Generato dal titolo se vuoto" /></label>
      <label className="adm-field"><span>Categoria</span><select className="adm-input" name="category" defaultValue={product?.category ?? "tech"}>{SHOP_CATEGORIES.map((c) => <option key={c} value={c}>{SHOP_CATEGORY_LABEL.it[c]}</option>)}</select></label>
      <label className="adm-field"><span>Prezzo in euro</span><input className="adm-input" name="price" type="number" min="0.01" max="99999" step="0.01" defaultValue={product?.price ?? ""} required /></label>
    </div>

    <h3 className="adm-h2 shop-admin-sub">Italiano</h3>
    <div className="adm-grid2">
      <label className="adm-field"><span>Titolo</span><input className="adm-input" name="titleIt" defaultValue={product?.titleIt ?? ""} maxLength={100} required /></label>
      <label className="adm-field"><span>Etichetta sopra il titolo</span><input className="adm-input" name="label_it" defaultValue={d?.it.label ?? ""} maxLength={40} placeholder="es. Cards" /></label>
      <label className="adm-field"><span>Descrizione</span><textarea className="adm-input" name="descriptionIt" defaultValue={product?.descriptionIt ?? ""} maxLength={1000} rows={4} required /></label>
      <label className="adm-field"><span>Titolo sezione vantaggi</span><input className="adm-input" name="heading_it" defaultValue={d?.it.heading ?? ""} maxLength={120} /></label>
      <label className="adm-field"><span>Vantaggi (uno per riga: Titolo | testo, max 6)</span><textarea className="adm-input" name="benefits_it" defaultValue={benefitsToText(d?.it.benefits ?? [])} rows={5} /></label>
      <label className="adm-field"><span>Punti chiave accanto al prezzo (uno per riga, max 4)</span><textarea className="adm-input" name="highlights_it" defaultValue={(d?.it.highlights ?? []).join("\n")} rows={4} /></label>
    </div>

    <h3 className="adm-h2 shop-admin-sub">Inglese</h3>
    <p className="adm-muted">{translationReady ? "Si aggiorna da solo con DeepL quando salvi l’italiano. Se lo modifichi a mano resta com’è; “Ritraduci in inglese” lo rigenera." : "DeepL non configurato: compila l’inglese a mano."}</p>
    <div className="adm-grid2">
      <label className="adm-field"><span>Title</span><input className="adm-input" name="titleEn" defaultValue={product?.titleEn ?? ""} maxLength={100} /></label>
      <label className="adm-field"><span>Label</span><input className="adm-input" name="label_en" defaultValue={d?.en.label ?? ""} maxLength={40} /></label>
      <label className="adm-field"><span>Description</span><textarea className="adm-input" name="descriptionEn" defaultValue={product?.descriptionEn ?? ""} maxLength={1000} rows={4} /></label>
      <label className="adm-field"><span>Benefits heading</span><input className="adm-input" name="heading_en" defaultValue={d?.en.heading ?? ""} maxLength={120} /></label>
      <label className="adm-field"><span>Benefits (Title | text)</span><textarea className="adm-input" name="benefits_en" defaultValue={benefitsToText(d?.en.benefits ?? [])} rows={5} /></label>
      <label className="adm-field"><span>Highlights</span><textarea className="adm-input" name="highlights_en" defaultValue={(d?.en.highlights ?? []).join("\n")} rows={4} /></label>
    </div>

    <details className="shop-admin-supplier" open={Boolean(product?.supplierName || product?.supplierCost || product?.supplierProductUrl || product?.supplierSku)}>
      <summary className="adm-h2">Fornitore (dropshipping, solo admin)</summary>
      <p className="adm-muted">Questi dati non vengono mai mostrati sul sito.</p>
      <div className="adm-grid2">
        <label className="adm-field"><span>Nome fornitore</span><input className="adm-input" name="supplierName" defaultValue={product?.supplierName ?? ""} maxLength={120} /></label>
        <label className="adm-field"><span>SKU fornitore</span><input className="adm-input" name="supplierSku" defaultValue={product?.supplierSku ?? ""} maxLength={120} /></label>
        <label className="adm-field"><span>Costo fornitore per pezzo (€)</span><input className="adm-input" name="supplierCost" inputMode="decimal" defaultValue={product?.supplierCost ?? ""} placeholder="es. 2,10" /></label>
        <label className="adm-field"><span>Link prodotto fornitore</span><input className="adm-input" name="supplierProductUrl" type="url" defaultValue={product?.supplierProductUrl ?? ""} maxLength={500} placeholder="https://" /></label>
      </div>
    </details>

    <div className="adm-row-actions">
      <button className="adm-btn adm-btn-primary" disabled={pending || uploading || images.length === 0}>{pending ? "Salvataggio…" : isNew ? "Aggiungi prodotto" : "Salva modifiche"}</button>
      {translationReady ? <button type="submit" name="retranslate" value="1" className="adm-btn" disabled={pending || uploading || images.length === 0}>Ritraduci in inglese</button> : null}
      <p role="status" className={shown.error ? "adm-error" : "adm-ok"} suppressHydrationWarning>{message}</p>
      {warning ? <p role="status" className="adm-error" suppressHydrationWarning>{warning}</p> : null}
    </div>
  </form>;
}
