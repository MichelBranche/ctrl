"use client";

import { startTransition, useActionState } from "react";
import { saveShopProduct, type ActionState } from "@/app/admin/dashboard-actions";
import type { ShopProduct } from "@/lib/shop";

export function ShopProductForm({ product }: { product: ShopProduct }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveShopProduct, {});
  return (
    <form
      className="adm-panel adm-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <label className="adm-toggle">
        <input type="checkbox" name="published" defaultChecked={product.published} />
        <span>Prodotto visibile nello shop</span>
      </label>
      <div className="adm-grid2">
        <label className="adm-field">
          <span>Titolo (italiano)</span>
          <input className="adm-input" name="titleIt" defaultValue={product.titleIt} maxLength={100} required />
        </label>
        <label className="adm-field">
          <span>Titolo (inglese)</span>
          <input className="adm-input" name="titleEn" defaultValue={product.titleEn} maxLength={100} required />
        </label>
        <label className="adm-field">
          <span>Descrizione (italiano)</span>
          <textarea className="adm-input" name="descriptionIt" defaultValue={product.descriptionIt} maxLength={500} rows={4} required />
        </label>
        <label className="adm-field">
          <span>Descrizione (inglese)</span>
          <textarea className="adm-input" name="descriptionEn" defaultValue={product.descriptionEn} maxLength={500} rows={4} required />
        </label>
        <label className="adm-field">
          <span>Prezzo in euro</span>
          <input className="adm-input" name="price" type="number" min="0.01" max="99999" step="0.01" defaultValue={product.price} required />
        </label>
      </div>
      <div className="adm-row-actions">
        <button className="adm-btn adm-btn-primary" disabled={pending}>
          {pending ? "Salvataggio…" : "Salva prodotto"}
        </button>
        <p role="status" className={state.error ? "adm-error" : "adm-ok"}>{state.error ?? state.ok ?? ""}</p>
      </div>
    </form>
  );
}
