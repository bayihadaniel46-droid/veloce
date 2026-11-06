import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/authContext";
import "../piz-market.css";

const ACTIVITY_LABELS = {
  "post-publication": "Posts publics",
  "status-post": "Statuts",
  "anonymous-post": "Publications anonymes",
  "anonymous-identity-reveal": "Identités révélées au Carrefour",
  "clan-message-identity-reveal": "Identités révélées dans les clans",
  "server-clan-question": "Questions au clan serveur",
  "full-keyboard": "Clavier alphabétique",
  "clan-vote": "Votes pondérés"
};

const money = (amount) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(amount) || 0);

function Market() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(API_BASE_URL + "/market/trends", { headers: { Authorization: "Bearer " + token }, signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Les tendances ne sont pas disponibles.");
        setData(result);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message || "Impossible de charger le marché Piz.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  const maxAmount = Math.max(1, ...(data?.monthly || []).map((entry) => entry.amount));
  const price = data?.reservePricing;

  return <section className="market-page piz-market-page">
    <button type="button" className="market-back" onClick={() => window.dispatchEvent(new Event("veloce:navigate-profile"))}>← Retour au profil</button>
    <header className="market-heading piz-market-heading"><span>ÉCONOMIE VELOCE</span><h1>Tendances du Piz</h1><p>Suivi des soldes, des frais et des mouvements Piz enregistrés sur la plateforme.</p></header>
    {loading ? <p className="market-state">Chargement du registre Piz…</p> : error ? <div className="market-state market-error"><strong>Registre indisponible</strong><p>{error}</p></div> : data && <>
      <div className="piz-market-stats">
        <article><span>Soldes des joueurs</span><strong>{money(data.userBalances)} <small>Piz</small></strong><small>{data.wallets} portefeuilles initialisés</small></article>
        <article><span>Réserve administrative</span><strong>{money(data.administrationReserve)} <small>Piz</small></strong><small>Frais versés au compte de la plateforme</small></article>
        <article><span>Mouvements sur 6 mois</span><strong>{money(data.movementVolumeSixMonths)} <small>Piz</small></strong><small>{data.monthly.reduce((sum, month) => sum + month.transactions, 0)} opérations enregistrées</small></article>
      </div>
      <section className="piz-market-panel">
        <div className="piz-market-panel-heading"><div><span>ACTIVITÉ DU REGISTRE</span><h2>Volume mensuel</h2></div><span className="piz-market-live">● Registre Veloce</span></div>
        <div className="piz-volume-chart" role="img" aria-label="Volume Piz mensuel sur les six derniers mois">
          {data.monthly.map((month) => <div className="piz-volume-column" key={month.month}>
            <strong>{money(month.amount)} Piz</strong>
            <div className="piz-volume-track"><i style={{ height: Math.max(month.amount ? 5 : 0, month.amount / maxAmount * 100) + "%" }} /></div>
            <span>{new Date(month.month + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "short" })}</span>
            <small>{month.transactions} opération{month.transactions === 1 ? "" : "s"}</small>
          </div>)}
        </div>
      </section>
      <section className="piz-market-panel">
        <div className="piz-market-panel-heading"><div><span>RÉPARTITION</span><h2>Où les Piz circulent</h2></div></div>
        {data.activity.length ? <div className="piz-market-activity">{data.activity.map((item) => <article key={item.type}><span>{ACTIVITY_LABELS[item.type] || item.type}</span><strong>{money(item.amount)} Piz</strong><small>{item.transactions} opération{item.transactions === 1 ? "" : "s"}</small></article>)}</div> : <div className="piz-market-empty">Le registre attend ses premiers mouvements.</div>}
      </section>
      <section className="piz-market-panel piz-price-panel">
        <div><span>RÉSERVE ADMINISTRATIVE</span><h2>Prix de référence</h2><p>Le tarif de vente de la réserve varie selon le volume mensuel d’achats.</p></div>
        <div className="piz-price-tiers"><article><strong>15 Piz</strong><span>pour 100 FCFA · période de volume élevé</span></article><article><strong>20 Piz</strong><span>pour 100 FCFA · période de volume faible</span></article></div>
        <p className="piz-market-pricing-state">{price?.currentPizPer100Fcfa ? "Tarif actif : " + price.currentPizPer100Fcfa + " Piz pour 100 FCFA." : "Le seuil qui distingue un volume élevé d’un volume faible reste à configurer par l’administration."}</p>
      </section>
      <p className="piz-market-source">Actualisé le {new Date(data.updatedAt).toLocaleString("fr-FR")}. Ce tableau reflète les mouvements enregistrés dans Veloce. Les achats et échanges effectués dans l’application PIZ s’afficheront lorsque son API transmettra ces opérations à Veloce.</p>
    </>}
  </section>;
}

export default Market;
