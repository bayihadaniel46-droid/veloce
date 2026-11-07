import { API_BASE_URL } from "../config";

const API_URL = `${API_BASE_URL}/messages`;
const CLAN_URL = `${API_BASE_URL}/clans`;
const CALL_URL = `${API_BASE_URL}/calls`;

const callRequest = async (path, token, options = {}) => {
  const response = await fetch(`${CALL_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Erreur d’appel.");
  return data;
};

export const getIncomingCalls = (token) => callRequest("/incoming", token);
export const startAudioCall = ({ recipientId, token }) => callRequest("/", token, {
  method: "POST", body: JSON.stringify({ recipientId, mode: "audio" }),
});
export const startVideoCall = ({ recipientId, token }) => callRequest("/", token, {
  method: "POST", body: JSON.stringify({ recipientId, mode: "video" }),
});
export const getAudioCall = ({ callId, after = 0, token }) => callRequest(`/${callId}?after=${after}`, token);
export const updateAudioCall = ({ callId, action, token }) => callRequest(`/${callId}/status`, token, {
  method: "POST", body: JSON.stringify({ action }),
});
export const sendAudioCallEvent = ({ callId, type, payload, token }) => callRequest(`/${callId}/events`, token, {
  method: "POST", body: JSON.stringify({ type, payload }),
});

const COMMUNITY_URL = `${API_BASE_URL}/community`;
const communityRequest = async (path, token, options = {}) => {
  const response = await fetch(`${COMMUNITY_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Erreur du clan serveur.");
  return data;
};

export const getCommunityMessages = (token) => communityRequest("/messages", token);
export const getCommunityGuides = async (token) => communityRequest("/guides", token);
export const unlockCommunityGuide = ({ guideId, token }) => communityRequest(`/guides/${encodeURIComponent(guideId)}/unlock`, token, { method: "POST" });
export const sendCommunityMessage = ({ content, kind = "message", token }) => communityRequest("/messages", token, {
  method: "POST", body: JSON.stringify({ content, kind }),
});
export const publishCommunityUpdate = ({ content, kind = "announcement", token }) => communityRequest("/updates", token, {
  method: "POST", body: JSON.stringify({ content, kind }),
});

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
export const discoverClans = (token) => clanRequest("/discover", token);
export const requestToJoinClan = ({ clanId, token }) => clanRequest(`/${clanId}/join`, token, { method: "POST" });
export const updateClanSettings = ({ clanId, payload, token }) => clanRequest(`/${clanId}/settings`, token, { method: "PATCH", body: JSON.stringify(payload) });
export const assignClanRole = ({ clanId, userId, role, token }) => clanRequest(`/${clanId}/roles`, token, { method: "PUT", body: JSON.stringify({ userId, role }) });
export const getClanMembershipRequests = ({ clanId, token }) => clanRequest(`/${clanId}/requests`, token);
export const reviewClanMembershipRequest = ({ clanId, userId, decision, token }) => clanRequest(`/${clanId}/requests/${userId}/review`, token, { method: "POST", body: JSON.stringify({ decision }) });
export const rateClan = ({ clanId, rating, review, token }) => clanRequest(`/${clanId}/rating`, token, { method: "POST", body: JSON.stringify({ rating, review }) });
export const getClanKnowledge = (token, clanId = "") => clanRequest(clanId ? `/${clanId}/knowledge` : "/knowledge", token);
export const createClanKnowledge = ({ clanId, payload, token }) => clanRequest(`/${clanId}/knowledge`, token, { method: "POST", body: JSON.stringify(payload) });
export const getClanAssistantKnowledge = ({ clanId, token }) => clanRequest(`/${clanId}/assistant-knowledge`, token);
export const publishClanAssistantKnowledge = ({ clanId, payload, token }) => clanRequest(`/${clanId}/assistant-knowledge`, token, { method: "POST", body: JSON.stringify(payload) });
export const purchaseClanKnowledge = ({ documentId, token }) => clanRequest(`/knowledge/${documentId}/purchase`, token, { method: "POST" });
export const contributeToClan = ({ clanId, amount, operationId, token }) => clanRequest(`/${clanId}/contributions`, token, { method: "POST", body: JSON.stringify({ amount, operationId }) });
export const distributeClanRevenue = ({ clanId, payouts, batchId, token }) => clanRequest(`/${clanId}/distributions`, token, { method: "POST", body: JSON.stringify({ payouts, batchId }) });
export const createClan = ({ name, description, memberIds, token }) => clanRequest("/", token, {
  method: "POST", body: JSON.stringify({ name, description, memberIds })
});
export const getClanMessages = ({ clanId, token }) => clanRequest(`/${clanId}/messages`, token);
export const openClanEnvelope = ({ clanId, messageId, token }) => clanRequest(`/${clanId}/messages/${messageId}/open`, token, { method: "POST" });
export const revealClanSender = ({ clanId, messageId, token }) => clanRequest(`/${clanId}/messages/${messageId}/reveal`, token, { method: "POST" });
export const addClanMembers = ({ clanId, memberIds, token }) => clanRequest(`/${clanId}/members`, token, { method: "POST", body: JSON.stringify({ memberIds }) });
export const getClanVotes = ({ clanId, token }) => clanRequest(`/${clanId}/votes`, token);
export const createClanVote = ({ clanId, payload, token }) => clanRequest(`/${clanId}/votes`, token, { method: "POST", body: JSON.stringify(payload) });
export const castClanVote = ({ clanId, voteId, option, amount = 1, token }) => clanRequest(`/${clanId}/votes/${voteId}/cast`, token, { method: "POST", body: JSON.stringify({ option, amount }) });
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
