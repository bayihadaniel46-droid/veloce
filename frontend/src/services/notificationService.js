import { API_BASE_URL } from "../config";

const API_URL = `${API_BASE_URL}/notifications`;


export const getNotifications =
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
        "Erreur notifications."
      );
    }

    return data;
  };


export const markNotificationAsRead =
  async ({
    id,
    token
  }) => {
    const response =
      await fetch(
        `${API_URL}/${id}/read`,
        {
          method: "PATCH",

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
        "Erreur notification."
      );
    }

    return data;
  };


export const markAllNotificationsAsRead =
  async (token) => {
    const response =
      await fetch(
        `${API_URL}/read-all`,
        {
          method: "PATCH",

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
        "Erreur notifications."
      );
    }

    return data;
  };

export const deleteNotification = async ({ id, token }) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible de supprimer cette notification.");
  return data;
};

export const getUnreadNotificationCount = async (token) => {
  const response = await fetch(`${API_URL}/unread-count`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Erreur compteur notifications.");
  return data.count || 0;
};
