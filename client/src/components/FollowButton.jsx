import React, { useState, useEffect, useMemo } from "react";
import { Button, message, Tooltip } from "antd";
import { StarFilled, StarOutlined } from "@ant-design/icons";
import { followPlayer, unfollowPlayer, getFollowedPlayers } from "../api/follow.js";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/axios.js";

export default function FollowButton({ playerId: propId, name, country }) {
  const { token } = useAuth();
  const [playerId, setPlayerId] = useState(propId ?? null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolveTried, setResolveTried] = useState(false); 

  const disabledReason = useMemo(() => {
    if (!token) return "Please log in to follow players.";
    if (!playerId && resolveTried)
      return "This player is not in the database yet, follow is unavailable.";
    return null;
  }, [token, playerId, resolveTried]);

  useEffect(() => {
    const resolvePlayerId = async () => {
      if (playerId || !name) {
        setResolveTried(true);
        return;
      }
      try {
        const res = await api.get(`/players/search?name=${encodeURIComponent(name)}`);
        const list = Array.isArray(res.data) ? res.data : [];
        
        const exact = list.find(
          (p) =>
            `${p.firstName || ""} ${p.lastName || ""}`.trim().toLowerCase() ===
            name.toLowerCase()
        );
        const hit = exact || list[0];
        if (hit?.playerId) setPlayerId(hit.playerId);
      } catch (err) {
        console.warn("⚠️ resolve playerId by name failed:", err);
      } finally {
        setResolveTried(true);
      }
    };
    resolvePlayerId();
    
  }, [name]);

  useEffect(() => {
    if (!token || !playerId) return;
    const check = async () => {
      try {
        const res = await getFollowedPlayers(token);
        let follows =
          Array.isArray(res.data) ? res.data :
          Array.isArray(res.data?.follows) ? res.data.follows : [];
        const followed = follows.some(
          (f) =>
            String(f.playerId) === String(playerId) ||
            String(f.playerId?._id) === String(playerId)
        );
        setIsFollowing(followed);
      } catch (err) {
        console.error("⚠️ fetch follows failed:", err);
      }
    };
    check();
  }, [token, playerId]);

  const handleToggle = async () => {
    if (!token) {
      message.warning("Please log in to follow players.");
      return;
    }
    if (!playerId) {
      message.error("Cannot follow: player is not in the database yet.");
      return;
    }
    setLoading(true);
    try {
      if (isFollowing) {
        await unfollowPlayer(playerId, token);
        setIsFollowing(false);
        message.success("Unfollowed successfully!");
        try { window.dispatchEvent(new CustomEvent("follow:changed", { detail: { playerId, action: "unfollow" } })); } catch {}
      } else {
        
        await followPlayer(playerId, token, { name, country });
        setIsFollowing(true);
        message.success("Followed successfully!");
        try { window.dispatchEvent(new CustomEvent("follow:changed", { detail: { playerId, action: "follow" } })); } catch {}
      }
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;
      if (status === 409) {
        setIsFollowing(true);
        message.info("You already follow this player.");
      } else if (status === 404) {
        message.error(serverMsg || "Player not found on server.");
      } else if (status === 401) {
        message.warning("Please log in again to use Follow.");
      } else {
        // Avoid noisy console logs of raw objects; show concise message
        const concise = serverMsg || (err?.message || "Follow action failed.");
        message.error(concise);
      }
    } finally {
      setLoading(false);
    }
  };

  const btn = (
    <Button
      type={isFollowing ? "primary" : "default"}
      icon={isFollowing ? <StarFilled /> : <StarOutlined />}
      loading={loading}
      onClick={handleToggle}
      disabled={!!disabledReason}
      style={{ borderRadius: 8 }}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );

  return disabledReason ? <Tooltip title={disabledReason}>{btn}</Tooltip> : btn;
}
