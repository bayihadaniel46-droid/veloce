import { useEffect, useRef, useState } from "react";
import marketTheme from "./forge-market-integrated.css?inline";
import "./MarketplacePage.css";

const marketStylePaths = ["styles.css", "market-controls.css", "mobile.css", "market-pages.css"];

function scopeMarketCss(css) {
  return css
    .replace(/:root/g, ":host")
    .replace(/(^|[{},]\s*)html\b/gm, "$1.forge-market-root")
    .replace(/(^|[{},]\s*)body\b/gm, "$1.forge-market-root");
}

function MarketplacePage({ onBack }) {
  const mountRef = useRef(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    let marketRoot;
    const mount = async () => {
      try {
        marketRoot = mountRef.current.shadowRoot || mountRef.current.attachShadow({ mode: "open" });
        marketRoot.innerHTML = '<style>:host{display:block}.market-inline-loading{min-height:180px;display:grid;place-items:center;color:#718090;font:12px system-ui}</style><p class="market-inline-loading">Préparation de la vitrine…</p>';
        const response = await fetch("/forge-market/", { credentials: "same-origin" });
        if (!response.ok) throw new Error("La vitrine est momentanément indisponible.");
        const html = await response.text();
        const page = new DOMParser().parseFromString(html, "text/html");
        marketRoot.replaceChildren();

        const fontLink = page.querySelector('link[href*="fonts.googleapis.com"]');
        if (fontLink) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = fontLink.href;
          marketRoot.append(link);
        }

        const cssTexts = await Promise.all(marketStylePaths.map(async (name) => {
          const styleResponse = await fetch(`/forge-market/${name}`, { credentials: "same-origin" });
          if (!styleResponse.ok) throw new Error("Impossible de charger les styles de la vitrine.");
          return scopeMarketCss(await styleResponse.text());
        }));
        if (!active) return;

        const style = document.createElement("style");
        style.textContent = `${cssTexts.join("\n")}\n${page.querySelector("style")?.textContent || ""}\n${marketTheme}`;
        marketRoot.append(style);

        const surface = document.createElement("div");
        surface.className = "forge-market-root";
        surface.dataset.page = "home";
        surface.innerHTML = page.body.innerHTML;
        marketRoot.append(surface);

        const { initForgeMarket } = await import("./forgeMarketApp.js");
        if (active) await initForgeMarket(marketRoot, { search: window.location.search });
      } catch (error) {
        if (active) setLoadError(error.message || "Impossible d’ouvrir ForgeMarket.");
      }
    };

    void mount();
    return () => { active = false; marketRoot?.replaceChildren(); };
  }, [reloadToken]);

  return <section className="marketplace-page">
    <header className="marketplace-page-heading">
      <div className="marketplace-page-mark" aria-hidden="true">M</div>
      <div><span>ATELIER NUMÉRIQUE · PISTON</span><h1>Marketplace</h1><p>Découvre, partage et vends des créations numériques.</p></div>
      {onBack && <button type="button" className="marketplace-page-back" onClick={onBack}>Accueil</button>}
    </header>
    {loadError ? <div className="marketplace-page-error" role="alert"><strong>La vitrine n’a pas pu s’ouvrir.</strong><span>{loadError}</span><button type="button" onClick={() => { setLoadError(""); setReloadToken((value) => value + 1); }}>Réessayer</button></div> : <div className="marketplace-page-content" ref={mountRef}><p className="marketplace-page-loading">Préparation de la vitrine…</p></div>}
  </section>;
}

export default MarketplacePage;
