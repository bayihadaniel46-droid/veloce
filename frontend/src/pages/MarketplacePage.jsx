import "./MarketplacePage.css";
import "./MarketplacePage.compat.css";

function MarketplacePage({ onBack }) {
  return <section className="marketplace-shell">
    <header className="marketplace-shell-heading">
      <div className="marketplace-mark" aria-hidden="true">M</div>
      <div><span>PISTON · CRÉATIONS NUMÉRIQUES</span><h1>ForgeMarket</h1><p>Découvre, partage et vends des projets, ressources et créations numériques.</p></div>
      <button type="button" className="marketplace-back" onClick={() => onBack?.()}>Accueil</button>
    </header>
    <div className="marketplace-frame-toolbar"><span><i /> Marketplace intégré à Veloce</span><small>Compte, vitrine, coffre et ventes restent dans cet espace.</small></div>
    <iframe className="marketplace-frame" src="/forge-market/" title="ForgeMarket intégré à Veloce" loading="lazy" allow="clipboard-read; clipboard-write" />
  </section>;
}

export default MarketplacePage;
