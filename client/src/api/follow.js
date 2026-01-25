import api from "./axios.js";

// Note: token is optional; if provided, we explicitly attach Authorization header
export const followPlayer = (playerId, token, extra = {}) =>
  api.post(`/follow/${playerId}`,
    extra,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  );

export const unfollowPlayer = (playerId, token) =>
  api.delete(
    `/follow/${playerId}`,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  );

export const getFollowedPlayers = (token) =>
  api.get(
    `/follow`,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  );
