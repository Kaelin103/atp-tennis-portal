// src/pages/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Avatar,
  Typography,
  Upload,
  message,
  Spin,
  Modal,
  List,
  Tag,
  Space,
} from "antd";
import {
  UploadOutlined,
  ToolOutlined,
  LogoutOutlined,
  StarFilled,
  CheckCircleOutlined,
  EyeOutlined,
  TrophyOutlined,
  CrownOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getFollowedPlayers, unfollowPlayer } from "../api/follow.js";
import api from "../api/axios";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, Tooltip, Legend);

const { Title, Text } = Typography;

export default function ProfilePage() {
  const { user, token, updateProfile, fetchProfile, logout } = useAuth();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [follows, setFollows] = useState([]);
  const [loadingFollows, setLoadingFollows] = useState(false);

  const [peekOpen, setPeekOpen] = useState(false);
  const [peekLoading, setPeekLoading] = useState(false);
  const [peekPlayer, setPeekPlayer] = useState(null);
  const [peekStats, setPeekStats] = useState(null);
  const [peekMatches, setPeekMatches] = useState([]);

  const navigate = useNavigate();
  const [fadeOut, setFadeOut] = useState(false);

/* ---------------- Initialization Load ---------------- */
  useEffect(() => {
    const load = async () => {
      try {
        if (!token) {
          navigate("/login");
          return;
        }
        await fetchProfile();
      } catch {
        message.error("Session expired. Please login again.");
// Silent logout to avoid duplicate global notifications
        logout(true);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  useEffect(() => {
    if (user) {
      form.setFieldsValue(user);
      loadFollows();
    }
  }, [user, form]);

  const loadFollows = async () => {
    if (!token) return;
    setLoadingFollows(true);
    try {
      const res = await getFollowedPlayers(token);
      const raw = Array.isArray(res?.data?.follows) ? res.data.follows : [];
// Clean empty names, normalize fields, keep unknown records but mark disabled
      const cleaned = raw.map((p) => ({
        ...p,
        name: (p?.name || "").trim(),
      }));
      setFollows(cleaned);
    } catch (err) {
      console.error("❌ Load follows failed:", err);
      message.error("Failed to load followed players.");
    } finally {
      setLoadingFollows(false);
    }
  };

  // Listen to follow/unfollow events to refresh follows in real-time
  useEffect(() => {
    const handler = () => {
      loadFollows();
    };
    window.addEventListener("follow:changed", handler);
    return () => window.removeEventListener("follow:changed", handler);
  }, []);

/* ---------------- Follow Logic ---------------- */
  const handleUnfollow = async (playerId) => {
    try {
      await unfollowPlayer(playerId, token);
      setFollows((prev) => prev.filter((p) => p.playerId !== playerId));
      message.success("Unfollowed successfully!");
    } catch (err) {
      console.error("❌ Unfollow failed:", err);
      message.error("Failed to unfollow player.");
    }
  };

/* ---------------- Save Profile ---------------- */
  const handleSave = async (values) => {
    try {
      setSaving(true);
      const res = await updateProfile(values);
      if (res?.user) {
        form.setFieldsValue(res.user);
        message.success("Profile updated successfully!");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("❌ Update failed:", err);
      message.error(err?.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

/* ---------------- Clear Cache ---------------- */
  const handleClearCache = async () => {
    Modal.confirm({
      title: "Clear Cached Rankings?",
      content: "This will remove cached ranking data from the server.",
      okText: "Yes, clear it",
      cancelText: "Cancel",
      async onOk() {
        try {
          setClearing(true);
          const res = await api.delete("/players/cache/clear");
          message.success(res.data.message || "Cache cleared successfully!");
        } catch (err) {
          console.error("❌ Cache clear failed:", err);
          message.error(err?.response?.data?.message || "Failed to clear cache.");
        } finally {
          setClearing(false);
        }
      },
    });
  };

  /* ---------------- Flag Emoji ---------------- */
  const getFlagEmoji = (code) => {
    if (!code) return "🏳️";
    return code
      .toUpperCase()
      .replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt()));
  };

// Avoid loading external flag images blocked by browser ORB; use default Avatar icon
  const isFlagCdnUrl = (url) => typeof url === "string" && /flagcdn\.com\//i.test(url);
  const safeAvatarSrc = (url) => {
    if (!url || isFlagCdnUrl(url)) return undefined; // Return undefined to let Avatar use built-in icon fallback
    return url;
  };

  /* ---------------- Quick Peek ---------------- */
  const openQuickPeek = async (name) => {
    const isValidName = !!name && name.trim() !== "" && !/^unknown\b/i.test(name.trim());
    if (!isValidName) {
      message.info("Player not in database. Quick Peek unavailable.");
      return;
    }
    setPeekOpen(true);
    setPeekLoading(true);
    setPeekPlayer(null);
    setPeekStats(null);
    setPeekMatches([]);
    try {
      console.log(`📡 Fetching Quick Peek for: ${name}`);
      const res = await api.get(`/players/stats/${encodeURIComponent(name)}`);
      console.log("👀 Quick Peek API Response:", res.data);

      const { player, stats, recentMatches } = res.data || {};

// ✅ Compute rank if backend does not provide directly
      const derivedRank =
        player?.rank ??
        (stats?.wins > 1000 ? 1 : stats?.wins > 800 ? 2 : stats?.wins > 600 ? 3 : "N/A");

      setPeekPlayer({ ...player, rank: derivedRank });
      setPeekStats(stats || null);
      setPeekMatches(recentMatches || []);
    } catch (err) {
      console.error("❌ Failed to fetch player snapshot:", err);
      message.error("Failed to load player info.");
    } finally {
      setPeekLoading(false);
    }
  };

/* ---------------- UI Render ---------------- */
  if (loading)
    return (
      <div style={{ display: "flex", justifyContent: "center", marginTop: 100 }}>
        <Spin size="large" />
      </div>
    );

  if (!user)
    return (
      <div style={{ textAlign: "center", color: "#fff", marginTop: 100 }}>
        <Title level={4} style={{ color: "#fff" }}>
          ⚠️ No profile data found. Please login again.
        </Title>
      </div>
    );

  return (
    <AnimatePresence>
      <motion.div
        key="profile"
        initial={{ opacity: 1 }}
        animate={fadeOut ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          marginTop: 50,
          background: "linear-gradient(135deg, #001529, #1677ff)",
          minHeight: "calc(100vh - 64px)",
          paddingBottom: 100,
        }}
      >
        <div style={{ width: 720 }}>
          {/* === Profile Card === */}
          <Card
            style={{
              width: "100%",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              borderRadius: 16,
              padding: 24,
              background: "#fff",
              marginBottom: 24,
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 30 }}>
              <Avatar
                size={120}
                src={safeAvatarSrc(user?.avatar)}
                icon={<UserOutlined />}
              />
              <Title level={2} style={{ marginTop: 12 }}>
                {user?.name || "Unknown Player"}
              </Title>
              <Text type="secondary" style={{ fontSize: 18 }}>
                {getFlagEmoji(user?.country)} {user?.country || "N/A"}
              </Text>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">{user?.email}</Text>
              </div>
              {user?.role === "admin" && (
                <Button
                  icon={<ToolOutlined />}
                  onClick={handleClearCache}
                  loading={clearing}
                  type="dashed"
                  danger
                  style={{ marginTop: 16 }}
                >
                  Clear Cached Rankings
                </Button>
              )}
            </div>

            <Form layout="vertical" form={form} onFinish={handleSave}>
              <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: "Please enter your name" }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ required: true, type: "email" }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="country" label="Country (ISO Code)">
                <Input placeholder="e.g. SRB, ESP, GBR" />
              </Form.Item>
              <Form.Item name="avatar" label="Avatar URL">
                <Input placeholder="Paste image URL or upload below" />
              </Form.Item>
              <Form.Item>
                <Upload
                  showUploadList={false}
                  beforeUpload={(file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => form.setFieldValue("avatar", e.target.result);
                    reader.readAsDataURL(file);
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />}>Upload Avatar</Button>
                </Upload>
              </Form.Item>
              <Form.Item>
                <Button
                  type={saved ? "default" : "primary"}
                  htmlType="submit"
                  loading={saving}
                  icon={saved ? <CheckCircleOutlined /> : null}
                  block
                  style={{
                    marginTop: 16,
                    backgroundColor: saved ? "#52c41a" : undefined,
                    color: saved ? "#fff" : undefined,
                    borderColor: saved ? "#52c41a" : undefined,
                  }}
                >
                  {saved ? "Saved ✓" : "Save Changes"}
                </Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              {user?.role === "admin" && (
                <Button
                  type="primary"
                  icon={<CrownOutlined />}
                  onClick={() => navigate("/admin/dashboard")}
                  style={{ marginRight: 16 }}
                >
                  Admin Dashboard
                </Button>
              )}
              <Button danger icon={<LogoutOutlined />} onClick={logout}>
                Log Out
              </Button>
            </div>
          </Card>

          {/* === Followed Players === */}
          <Card
            title={
              <Title level={4} style={{ margin: 0 }}>
                <StarFilled style={{ color: "#fadb14" }} /> My Followed Players
              </Title>
            }
            style={{
              width: "100%",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              borderRadius: 16,
              background: "#fff",
            }}
          >
            {loadingFollows ? (
              <Spin />
            ) : follows.length === 0 ? (
              <Text type="secondary">You haven’t followed any players yet.</Text>
            ) : (
              <List
                grid={{ gutter: 16, xs: 1, sm: 2 }}
                dataSource={follows}
                renderItem={(item) => (
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    style={{
                      background: "#fafafa",
                      borderRadius: 12,
                      padding: "16px 20px",
                      border: "1px solid #f0f0f0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 14 }}
                        onClick={() => {
                          const valid = !!item.name && item.name.trim() !== "" && !/^unknown\b/i.test(item.name.trim());
                          if (!valid) {
                            message.warning("This record has no valid player name.");
                            return;
                          }
                          setFadeOut(true);
                          setTimeout(() => {
                            navigate(`/player/${encodeURIComponent(item.name)}`);
                          }, 300);
                        }}
                      >
                        <Avatar
                          size={56}
                          src={safeAvatarSrc(item.imageUrl)}
                          icon={<UserOutlined />}
                        />
                        <div>
                          <Text strong>{item.name || "Unknown Player"}</Text>
                          <br />
                          <Text type="secondary">
                            {getFlagEmoji(item.country)} {item.country || "Unknown"}
                          </Text>
                        </div>
                      </div>

                      <Space>
                        <Button
                          icon={<EyeOutlined />}
                          disabled={!item.name || /^unknown\b/i.test(item.name.trim())}
                          onClick={() => openQuickPeek(item.name)}
                        >
                          Quick Peek
                        </Button>
                        <Button danger onClick={() => handleUnfollow(item.playerId)}>
                          Unfollow
                        </Button>
                      </Space>
                    </div>
                  </motion.div>
                )}
              />
            )}
          </Card>
        </div>
      </motion.div>

      {/* === Quick Peek Modal === */}
      <Modal
        open={peekOpen}
        onCancel={() => setPeekOpen(false)}
        footer={
          <Space>
            {peekPlayer?.name && (
              <Button
                type="primary"
                onClick={() => {
                  setPeekOpen(false);
                  navigate(`/player/${encodeURIComponent(peekPlayer.name)}`);
                }}
              >
                View Full Profile
              </Button>
            )}
            <Button onClick={() => setPeekOpen(false)}>Close</Button>
          </Space>
        }
        centered
        title={
          <span>
            <TrophyOutlined style={{ color: "#faad14" }} />{" "}
            {peekPlayer?.name || "Player"} — {peekPlayer?.country || "N/A"}{" "}
            {peekPlayer?.rank && (
              <Tag color="blue">Rank: {peekPlayer.rank}</Tag>
            )}
          </span>
        }
      >
        {peekLoading ? (
          <Spin />
        ) : (
          <>
            {peekStats && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Text>
                    <strong>Total:</strong> {peekStats.total || 0} |{" "}
                    <span style={{ color: "green" }}>Wins: {peekStats.wins || 0}</span> |{" "}
                    <span style={{ color: "red" }}>
                      Losses: {peekStats.losses || 0}
                    </span>{" "}
                    | Win Rate:{" "}
                    <span style={{ color: "#1890ff" }}>
                      {(peekStats.winRate * 100).toFixed(1)}%
                    </span>
                  </Text>
                </div>

{/* === Chart Area === */}
                <Bar
                  data={{
                    labels: ["Wins", "Losses"],
                    datasets: [
                      {
                        label: "Match Count",
                        data: [peekStats.wins, peekStats.losses],
                        backgroundColor: ["#52c41a", "#ff4d4f"],
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    },
                  }}
                  height={100}
                />
              </>
            )}

            {peekMatches?.length ? (
              <List
                size="small"
                dataSource={peekMatches.slice(0, 6)}
                renderItem={(m) => (
                  <List.Item>
                    <Text>
                      🎾 <strong>{m.tourneyName}</strong> |{" "}
                      <em>{m.surface || "Unknown"}</em> |{" "}
                      <span style={{ color: "#1890ff" }}>{m.winnerName}</span> def. 
                      {m.loserName} ({m.score})
                    </Text>
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">No recent matches found.</Text>
            )}
          </>
        )}
      </Modal>
    </AnimatePresence>
  );
}
