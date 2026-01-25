import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Typography, Table, Spin, Button, message } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import api from "../api/axios";
import FollowButton from "../components/FollowButton.jsx";
import { PageMotion, SectionMotion } from "../utils/PageMotion";

const { Title, Text } = Typography;

export default function PlayerDetail() {
  const { name } = useParams();
  const navigate = useNavigate();

  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const decoded = decodeURIComponent(name);
        const res = await api.get(`/players/stats/${encodeURIComponent(decoded)}`);
        setPlayerData(res.data);
      } catch (e) {
        console.error("❌ load player stats failed:", e);
        message.error("Failed to load player details.");
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [name]);

  if (loading) {
    return (
      <PageMotion>
        <div
          style={{
            height: "calc(100vh - 64px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #001529, #1677ff)",
          }}
        >
          <Spin size="large">
            <div style={{ width: 100, height: 100 }} />
          </Spin>
        </div>
      </PageMotion>
    );
  }

  if (!playerData) {
    return (
      <PageMotion>
        <div
          style={{
            height: "calc(100vh - 64px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: "#fff",
            background: "linear-gradient(135deg, #001529, #1677ff)",
            flexDirection: "column",
          }}
        >
          <Text type="danger" style={{ fontSize: 18 }}>
            ❌ Player not found or failed to load.
          </Text>
          <Button
            icon={<ArrowLeftOutlined />}
            style={{ marginTop: 20 }}
            onClick={() => navigate("/rankings")}
          >
            Back to Rankings
          </Button>
        </div>
      </PageMotion>
    );
  }

  const { player, stats, recentMatches } = playerData;

  return (
    <PageMotion>
      <div
        style={{
          minHeight: "calc(100vh - 64px)",
          background: "linear-gradient(135deg, #001529, #1677ff)",
          display: "flex",
          justifyContent: "center",
          padding: "60px 24px",
        }}
      >
        <SectionMotion>
          <Card
            style={{
              width: "100%",
              maxWidth: 800,
              borderRadius: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Title level={3} style={{ margin: 0 }}>
                🎾 {player?.name || "Unknown Player"}
              </Title>

              <div style={{ display: "flex", gap: 8 }}>
                <FollowButton
                  
                  playerId={player?.playerId ?? player?._id?.toString() ?? null}
                  
                  name={player?.name}
                  country={player?.country || player?.countryCode}
                />
                <Button
                  type="default"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/rankings")}
                >
                  Back
                </Button>
              </div>
            </div>

            <SectionMotion delay={0.1}>
              <div style={{ marginBottom: 20 }}>
                <Text strong>Country:</Text> {player?.country || "N/A"} <br />
                <Text strong>Total Matches:</Text> {stats?.total || 0} <br />
                <Text strong>Wins:</Text> {stats?.wins || 0} <br />
                <Text strong>Losses:</Text> {stats?.losses || 0} <br />
                <Text strong>Win Rate:</Text>{" "}
                {stats?.winRate ? `${(stats.winRate * 100).toFixed(1)}%` : "N/A"}
              </div>
            </SectionMotion>

            <SectionMotion delay={0.2}>
              <Title level={4}>Recent Matches</Title>
              {Array.isArray(recentMatches) && recentMatches.length > 0 ? (
                <Table
                  dataSource={recentMatches.map((m, i) => ({
                    key: i,
                    ...m,
                    date: new Date(m.tourneyDate).toLocaleDateString(),
                  }))}
                  columns={[
                    { title: "Tournament", dataIndex: "tourneyName", key: "tourney" },
                    { title: "Date", dataIndex: "date", key: "date" },
                    { title: "Winner", dataIndex: "winnerName", key: "winner" },
                    { title: "Loser", dataIndex: "loserName", key: "loser" },
                    { title: "Score", dataIndex: "score", key: "score" },
                  ]}
                  pagination={false}
                  bordered
                />
              ) : (
                <p style={{ textAlign: "center", color: "gray" }}>
                  No recent matches available.
                </p>
              )}
            </SectionMotion>
          </Card>
        </SectionMotion>
      </div>
    </PageMotion>
  );
}
