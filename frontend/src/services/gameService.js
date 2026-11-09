import { API_BASE_URL } from "../config";

const request = async (url, { token, ...options }) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Le service de jeu est indisponible.");
  return data;
};

export const startEmojiRushRun = ({ token }) => request(`${API_BASE_URL}/games/runs`, {
  token,
  method: "POST",
  body: JSON.stringify({ gameKey: "emoji-rush" })
});

export const openEmojiRushGift = ({ token, runId, score, giftCount }) => request(`${API_BASE_URL}/games/runs/${encodeURIComponent(runId)}/gift`, {
  token,
  method: "POST",
  body: JSON.stringify({ score, giftCount })
});
