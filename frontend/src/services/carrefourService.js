import { API_BASE_URL } from "../config";

const request = async (path, token, options = {}) => {
  const response = await fetch(API_BASE_URL + "/carrefour" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible de charger le Carrefour.");
  return data;
};

export const getCarrefour = (token) => request("/", token);
export const publishStatus = ({ content, token }) => request("/status", token, { method: "POST", body: JSON.stringify({ content }) });
export const publishAnonymousPost = ({ content, token }) => request("/anonymous", token, { method: "POST", body: JSON.stringify({ content }) });
export const revealCarrefourAuthor = ({ itemId, token }) => request("/anonymous/" + itemId + "/reveal", token, { method: "POST" });
