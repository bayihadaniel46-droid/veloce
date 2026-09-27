import { API_BASE_URL } from "../config";

const API_URL = `${API_BASE_URL}/messages`;


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
