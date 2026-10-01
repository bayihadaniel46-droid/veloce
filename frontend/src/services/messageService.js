import { API_BASE_URL } from "../config";

const API_URL = `${API_BASE_URL}/messages`;
const CLAN_URL = `${API_BASE_URL}/clans`;

const clanRequest = async (path, token, options = {}) => {
  const response = await fetch(`${CLAN_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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
export const sendClanEnvelope = ({ clanId, content, recipientIds, signed, replyTo, token }) => clanRequest(`/${clanId}/messages`, token, {
  method: "POST", body: JSON.stringify({ content, recipientIds, signed, replyTo })
});


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
    token
  }) => {
    const response =
      await fetch(
        `${API_URL}/${userId}`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`
          },

          body: JSON.stringify({
            content
          })
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
