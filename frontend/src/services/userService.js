import { API_BASE_URL } from "../config";

const API_URL = `${API_BASE_URL}/users`;


export const searchUsers = async ({
  q,
  token,
  signal
}) => {
  const response =
    await fetch(
      `${API_URL}/search?q=${encodeURIComponent(q)}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`
        },
        signal
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
      "Erreur de recherche."
    );
  }

  return data;
};


export const getSuggestions =
  async (token) => {
    const response =
      await fetch(
        `${API_URL}/suggestions`,
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
        "Erreur suggestions."
      );
    }

    return data;
  };


export const toggleFollow =
  async ({
    userId,
    token
  }) => {
    const response =
      await fetch(
        `${API_URL}/${userId}/follow`,
        {
          method: "POST",

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
        "Erreur suivi."
      );
    }

    return data;
  };


export const getUserStats =
  async (token) => {
    const response =
      await fetch(
        `${API_URL}/stats`,
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
        "Erreur statistiques."
      );
    }

    return data;
  };

export const getPizTransactions = async ({ token, page = 1, limit = 25 }) => {
  const response = await fetch(`${API_URL}/piz-transactions?page=${page}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible de charger l’historique Piz.");
  return data;
};
