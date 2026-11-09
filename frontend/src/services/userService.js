import { API_BASE_URL } from "../config";

const API_URL = `${API_BASE_URL}/users`;

export const getAdminOverview = async (token) => {
  const response = await fetch(`${API_BASE_URL}/admin/overview`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Accès au panneau administratif impossible.");
  return data;
};

const getAdminCollection = async (token, path, { page = 1, q = "", status = "" } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (q.trim()) params.set("q", q.trim());
  if (status) params.set("status", status);
  const response = await fetch(`${API_BASE_URL}/admin/${path}?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible de charger ces données d’administration.");
  return data;
};

export const getAdminMembers = (token, params) => getAdminCollection(token, "members", params);
export const getAdminPosts = (token, params) => getAdminCollection(token, "posts", params);
export const getAdminClans = (token, params) => getAdminCollection(token, "clans", params);
export const getAdminPizTransactions = (token, params) => getAdminCollection(token, "piz-transactions", params);
export const getAdminAppeals = (token, params) => getAdminCollection(token, "appeals", params);
export const getAdminAuditLog = (token, params) => getAdminCollection(token, "audit-log", params);

const sendAdminAction = async (token, path, method = "POST", body = {}) => {
  const response = await fetch(`${API_BASE_URL}/admin/${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible d’enregistrer cette action administrative.");
  return data;
};

export const suspendAdminMember = ({ token, userId, duration, reason }) => sendAdminAction(token, `members/${encodeURIComponent(userId)}/suspension`, "POST", { duration, reason });
export const restoreAdminMember = ({ token, userId }) => sendAdminAction(token, `members/${encodeURIComponent(userId)}/restore`);
export const reviewAdminAppeal = ({ token, appealId, decision, decisionNote }) => sendAdminAction(token, `appeals/${encodeURIComponent(appealId)}`, "PATCH", { decision, decisionNote });

export const getMyAccountAppeals = async (token) => {
  const response = await fetch(`${API_URL}/account-appeals/me`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible de charger le recours.");
  return data;
};

export const submitAccountAppeal = async ({ token, reason }) => {
  const response = await fetch(`${API_URL}/account-appeals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible d’envoyer le recours.");
  return data;
};

export const getCommunityRulesStatus = async (token) => {
  const response = await fetch(`${API_URL}/community-rules`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible de vérifier les règles.");
  return data;
};

export const acceptCommunityRules = async (token) => {
  const response = await fetch(`${API_URL}/community-rules/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ accepted: true })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible d’enregistrer ton acceptation.");
  return data;
};

export const deleteMyVeloceAccount = async (token) => {
  const response = await fetch(`${API_URL}/me`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ confirmation: "SUPPRIMER" })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible de supprimer le compte.");
  return data;
};

export const submitContentReport = async ({ token, contentType, contentId, category, details = "" }) => {
  const response = await fetch(`${API_URL}/content-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ contentType, contentId, category, details })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible d’envoyer le signalement.");
  return data;
};

export const getModerationQueue = async (token) => {
  const response = await fetch(`${API_URL}/moderation/content-reports`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible de charger la modération.");
  return data.reports || [];
};

export const reviewContentReport = async ({ token, reportId, status, action = "keep", moderationType = "content" }) => {
  const response = await fetch(`${API_URL}/moderation/content-reports/${reportId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, action, moderationType })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible d’enregistrer la décision.");
  return data.report;
};


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

export const deletePizReceipt = async ({ token, transactionId }) => {
  const response = await fetch(`${API_URL}/piz-transactions/${encodeURIComponent(transactionId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible de supprimer ce reçu.");
  return data;
};
