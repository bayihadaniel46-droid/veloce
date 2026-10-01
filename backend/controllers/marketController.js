const SYMBOLS = [
  { symbol: "SPY", label: "S&P 500 (ETF)" },
  { symbol: "QQQ", label: "Nasdaq 100 (ETF)" },
  { symbol: "AAPL", label: "Apple" },
  { symbol: "MSFT", label: "Microsoft" }
];

let cache = { expiresAt: 0, data: null };

const getMarketTrends = async (_req, res) => {
  const apiKey = process.env.TWELVE_DATA_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({
      message: "Les données de marché ne sont pas encore configurées sur le serveur.",
      configured: false
    });
  }
  if (cache.data && cache.expiresAt > Date.now()) return res.json(cache.data);

  try {
    const quotes = await Promise.all(SYMBOLS.map(async ({ symbol, label }) => {
      const url = new URL("https://api.twelvedata.com/quote");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("apikey", apiKey);
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const data = await response.json();
      if (!response.ok || data.status === "error" || data.code) {
        throw new Error(data.message || `Réponse invalide pour ${symbol}`);
      }
      const price = Number(data.close || data.price);
      const change = Number(data.percent_change);
      if (!Number.isFinite(price) || !Number.isFinite(change)) throw new Error(`Données indisponibles pour ${symbol}`);
      return { symbol, label, price, changePercent: change, currency: data.currency || "USD", asOf: data.datetime || data.timestamp || null };
    }));
    const result = { quotes, source: "Twelve Data", updatedAt: new Date().toISOString(), delayed: true };
    cache = { data: result, expiresAt: Date.now() + 10 * 60 * 1000 };
    return res.json(result);
  } catch (error) {
    console.error("Erreur données de marché :", error.message);
    return res.status(502).json({ message: "Impossible de récupérer les tendances du marché pour le moment." });
  }
};

module.exports = { getMarketTrends };
