// client/src/api/headtohead.js
import api from "./axios";

export const getTopHeadToHead = async (limit = 10) => {
  try {
    const res = await api.get(`/players/headtohead/top`, {
      params: { limit },
    });
    return res.data.top || [];
  } catch (err) {
    console.error("❌ getTopHeadToHead error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const getHeadToHeadByName = async (player1, player2) => {
  if (!player1 || !player2) {
    console.error("❌ getHeadToHeadByName error: Missing player names");
    throw new Error("Both player1 and player2 are required");
  }
  try {
    const res = await api.get(`/players/headtohead`, {
      params: { player1, player2 },
    });
    return res.data || [];
  } catch (err) {
    console.error("❌ getHeadToHeadByName error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const getHeadToHeadById = async (playerId) => {
  if (!playerId || isNaN(Number(playerId))) {
    console.error("❌ getHeadToHeadById error: Invalid playerId");
    throw new Error("Valid playerId is required");
  }
  try {
    const res = await api.get(`/players/headtohead/${playerId}`);
    return res.data || [];
  } catch (err) {
    console.error("❌ getHeadToHeadById error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const getHeadToHeadSummary = async () => {
  try {
    const res = await api.get(`/players/headtohead/summary`);
    return res.data.summary || [];
  } catch (err) {
    console.error("❌ getHeadToHeadSummary error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};
