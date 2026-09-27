import { API_BASE_URL } from "../config";

const API_URL = `${API_BASE_URL}/auth`;

// ============================================================
// INSCRIPTION
// ============================================================

export const registerUser = async ({
  username,
  email,
  password
}) => {

  const response = await fetch(
    `${API_URL}/register`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        username,
        email,
        password
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Erreur lors de l'inscription."
    );
  }

  return data;
};


// ============================================================
// CONNEXION
// ============================================================

export const loginUser = async ({
  email,
  password
}) => {

  const response = await fetch(
    `${API_URL}/login`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        email,
        password
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Erreur lors de la connexion."
    );
  }

  return data;
};
