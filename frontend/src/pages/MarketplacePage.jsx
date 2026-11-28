import "./MarketplacePage.css";

const configuredUrl = String(import.meta.env.VITE_MARKETPLACE_URL || "").trim().replace(/\/+$/, "");
const marketplaceUrl = configuredUrl || (import.meta.env.DEV ? "http://localhost:4300" : "");

function MarketplacePage({ onBack }) {
  return <section className="marketplace-shell">
    <header className="marketplace-shell-heading">
      <div className="marketplace-mark" aria-hidden="true">M</div>
      <div><span>PISTON · CRÉATIONS NUMÉRIQUES</span><h1>ForgeMarket</h1><p>Découvre, partage et vends des projets, ressources et créations numériques.</p></div>
      <button type="button" className="marketplace-back" onClick={() => onBack?.()}>Accueil</button>
    </header>
    {marketplaceUrl ? <>
      <div className="marketplace-frame-toolbar"><span><i /> Marketplace active</span><a href={marketplaceUrl} target="_blank" rel="noreferrer">Ouvrir dans un nouvel onglet ↗</a></div>
      <iframe className="marketplace-frame" src={marketplaceUrl} title="ForgeMarket — vitrine de ressources numériques" loading="lazy" allow="clipboard-read; clipboard-write" sandbox="allow-forms allow-scripts allow-same-origin allow-downloads allow-popups" />
    </> : <div className="marketplace-setup-card"><span aria-hidden="true">↗</span><h2>ForgeMarket est prêt à être relié</h2><p>Ajoute l’adresse publique de ForgeMarket dans la variable <code>VITE_MARKETPLACE_URL</code> des paramètres du site Veloce. La boutique gardera son compte, ses paiements PIZ et ses ressources tout en s’ouvrant depuis ce logo.</p></div>}
  </section>;
}

export default MarketplacePage;
