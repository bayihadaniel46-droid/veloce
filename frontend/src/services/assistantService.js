import { API_BASE_URL } from "../config";

const API_URL = `${API_BASE_URL}/assistant`;
const request = async (path, token, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "La requête a échoué.");
  return data;
};
export const getAssistant = (token) => request("/profile", token);
export const updateAssistant = (token, profile) => request("/profile", token, { method: "PUT", body: JSON.stringify(profile) });
export const getAssistantDrafts = (token) => request("/drafts", token);
export const subscribeAssistant = (token, operationId) => request("/subscribe", token, { method: "POST", body: JSON.stringify({ operationId }) });
export const generateAssistantDrafts = (token, { query = "", requestId }) => request("/generate", token, { method: "POST", body: JSON.stringify({ query, requestId }) });
export const publishAssistantDraft = (token, id) => request(`/drafts/${id}/publish`, token, { method: "POST", body: JSON.stringify({}) });
export const dismissAssistantDraft = (token, id) => request(`/drafts/${id}`, token, { method: "DELETE" });
