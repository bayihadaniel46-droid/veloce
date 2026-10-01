import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/authContext";

function Market() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/market/trends`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Les tendances ne sont pas disponibles.");
        setData(result);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message || "Impossible de charger le marché.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  return <section className="market-page">
    <button type="button" className="market-back" onClick={() => window.dispatchEvent(new Event("veloce:navigate-profile"))}>← Retour au profil</button>
    <header className="market-heading"><span>INFORMATIONS FINANCIÈRES</span><h1>Tendances du marché</h1><p>Consulte quelques repères de marché et leurs dernières variations.</p></header>
    {loading ? <p className="market-state">Chargement des cours…</p> : error ? <div className="market-state market-error"><strong>Données indisponibles</strong><p>{error}</p><small>La clé de données de marché doit être configurée sur le serveur.</small></div> : <>
      <div className="market-cards">{data.quotes.map((quote) => <article className="market-card" key={quote.symbol}>
        <div><span>{quote.label}</span><b>{quote.symbol}</b></div>
        <strong>{new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(quote.price)} <small>{quote.currency}</small></strong>
        <em className={quote.changePercent >= 0 ? "market-up" : "market-down"}>{quote.changePercent >= 0 ? "▲" : "▼"} {Math.abs(quote.changePercent).toFixed(2)}%</em>
        <small className="market-time">Dernier relevé : {quote.asOf || "date fournie par la source"}</small>
      </article>)}</div>
      <p className="market-source">Source : {data.source}. Actualisation : {new Date(data.updatedAt).toLocaleString("fr-FR")}. Les cours peuvent être différés.</p>
    </>}
    <aside className="market-disclaimer">Ces données sont fournies à titre informatif et ne constituent pas un conseil financier. Veloce ne permet ici aucun dépôt, retrait ou ordre d’achat.</aside>
  </section>;
}

export default Market;
