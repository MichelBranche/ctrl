import { ShopProductForm } from "@/components/admin/shop/product-form";
import { requireAdmin } from "@/lib/admin";
import { dbConfigured } from "@/lib/db";
import { getShopProduct } from "@/lib/shop";

export default async function ShopAdminPage() {
  await requireAdmin();
  const product = await getShopProduct();
  return (
    <main className="adm-main">
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Shop</h1>
          <p className="adm-muted">Gestisci il prodotto visibile nello store. Gli ordini vengono realizzati su richiesta, senza gestione di scorte.</p>
        </div>
        <a className="adm-btn" href="/shop" target="_blank" rel="noopener noreferrer">Apri lo shop</a>
      </header>
      {!dbConfigured ? <p className="adm-note">Database non configurato: le modifiche non possono essere salvate.</p> : null}
      <ShopProductForm product={product} />
      <section className="adm-panel">
        <h2 className="adm-h2">Fornitura e checkout</h2>
        <p className="adm-muted">La pagina pubblica mostra il prodotto e raccoglie richieste via email. Checkout automatico e inoltro al fornitore si attivano quando è collegato un servizio di pagamento e fulfillment.</p>
      </section>
    </main>
  );
}
