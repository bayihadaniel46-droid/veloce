import { API_BASE_URL } from "../config";

const API_URL = `${API_BASE_URL}/messages`;
const CLAN_URL = `${API_BASE_URL}/clans`;

const clanRequest = async (path, token, options = {}) => {
  const response = await fetch(`${CLAN_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Erreur clan.");
  return data;
};

export const getClans = (token) => clanRequest("/", token);
export const createClan = ({ name, description, memberIds, token }) => clanRequest("/", token, {
  method: "POST", body: JSON.stringify({ name, description, memberIds })
});
export const getClanMessages = ({ clanId, token }) => clanRequest(`/${clanId}/messages`, token);
export const openClanEnvelope = ({ clanId, messageId, token }) => clanRequest(`/${clanId}/messages/${messageId}/open`, token, { method: "POST" });
export const addClanMembers = ({ clanId, memberIds, token }) => clanRequest(`/${clanId}/members`, token, { method: "POST", body: JSON.stringify({ memberIds }) });
export const getClanVotes = ({ clanId, token }) => clanRequest(`/${clanId}/votes`, token);
export const createClanVote = ({ clanId, payload, token }) => clanRequest(`/${clanId}/votes`, token, { method: "POST", body: JSON.stringify(payload) });
export const castClanVote = ({ clanId, voteId, option, token }) => clanRequest(`/${clanId}/votes/${voteId}/cast`, token, { method: "POST", body: JSON.stringify({ option }) });
export const sendClanEnvelope = ({ clanId, content, recipientIds, signed, replyTo, files = [], token }) => {
  const body = new FormData(); body.append("content", content || ""); body.append("recipientIds", JSON.stringify(recipientIds)); body.append("signed", String(signed));
  if (replyTo) body.append("replyTo", replyTo); files.forEach((file) => body.append("files", file));
  return clanRequest(`/${clanId}/messages`, token, { method: "POST", body });
};


export const getConversations =
  async (token) => {
    const response =
      await fetch(
        API_URL,
        {
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
        "Erreur conversations."
      );
    }

    return data;
  };


export const getMessages =
  async ({
    userId,
    token
  }) => {
    const response =
      await fetch(
        `${API_URL}/${userId}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
        "Erreur messages."
      );
    }

    return data;
  };


export const sendMessage =
  async ({
    userId,
    content,
    files = [],
    token
  }) => {
    const response =
      await fetch(
        `${API_URL}/${userId}`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${token}`
          },
          body: (() => { const data = new FormData(); data.append("content", content || ""); files.forEach((file) => data.append("files", file)); return data; })()
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
        "Erreur envoi message."
      );
    }

    return data;
  };

export const deleteMessage = async ({ messageId, token }) => {
  const response = await fetch(`${API_URL}/${messageId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible de supprimer ce message.");
  return data;
};

export const getUnreadMessageCount = async (token) => {
  const response = await fetch(`${API_URL}/unread-count`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Erreur compteur messages.");
  return data.count || 0;
};
