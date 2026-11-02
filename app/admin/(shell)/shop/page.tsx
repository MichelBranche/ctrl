import { ShopProductForm } from "@/components/admin/shop/product-form";
import { requireAdmin } from "@/lib/admin";
import { dbConfigured } from "@/lib/db";
import { getShopProductsAdmin } from "@/lib/shop";
import { translationConfigured } from "@/lib/translate";

export default async function ShopAdminPage() {
  await requireAdmin();
  const products = await getShopProductsAdmin();
  const translationReady = translationConfigured();
  return <main className="adm-main">
    <header className="adm-top"><div><h1 className="adm-h1">Shop</h1><p className="adm-muted">Prodotti, immagini, prezzi, testi IT/EN e dati fornitore. I pagamenti non sono ancora attivi.</p></div><a className="adm-btn" href="/shop" target="_blank" rel="noopener noreferrer">Apri lo shop</a></header>
    {!dbConfigured ? <p className="adm-note">Database non configurato: in questa anteprima le modifiche non possono essere salvate.</p> : null}
    <ShopProductForm key={`new-${products.length}`} translationReady={translationReady} />
    <h2 className="adm-h2">Prodotti nello shop</h2>
    {products.length ? products.map((product) => <ShopProductForm key={`${product.id}-${product.updatedAt}`} product={product} translationReady={translationReady} />) : <p className="adm-note">Nessun prodotto. Usa il modulo sopra per aggiungerne uno.</p>}
    <section className="adm-panel"><h2 className="adm-h2">Fornitura e pagamenti</h2><p className="adm-muted">Il carrello del sito è solo un’anteprima salvata nel browser. Quando verrà attivato il pagamento, il totale sarà sempre ricalcolato sul server dai prezzi salvati qui (mai da quelli inviati dal browser).</p></section>
  </main>;
}
