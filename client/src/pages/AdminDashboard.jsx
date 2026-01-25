import React, { useEffect, useState } from "react";
import { Card, Typography, Row, Col, Spin, Alert, Button } from "antd";
import { useNavigate } from "react-router-dom";
import { UserOutlined, TrophyOutlined, BarChartOutlined, HeartOutlined, ReloadOutlined } from "@ant-design/icons";
import api from "../api/axios";

const { Title, Text } = Typography;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ users: 0, players: 0, matches: 0, follows: 0 });
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/admin/overview");
        if (res.data) {
          setStats(res.data);
          setLastUpdated(new Date().toLocaleString());
        }
      } catch (err) {
        console.error("Failed to fetch admin stats:", err);
        if (err.response?.status === 403) {
          setError("Access denied: Admin privileges required.");
        } else {
          setError("Failed to load dashboard data. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const cards = [
    {
      title: "Total Users",
      icon: <UserOutlined style={{ fontSize: 36, color: "#4FC3F7" }} />,
      value: stats.users,
      color: "#4FC3F7",
      onClick: () => navigate("/admin/users"),
    },
    {
      title: "Total Players",
      icon: <TrophyOutlined style={{ fontSize: 36, color: "#FFB74D" }} />,
      value: stats.players,
      color: "#FFB74D",
      onClick: () => navigate("/players"),
    },
    {
      title: "Total Matches",
      icon: <BarChartOutlined style={{ fontSize: 36, color: "#81C784" }} />,
      value: stats.matches,
      color: "#81C784",
      onClick: () => navigate("/match"),
    },
    {
      title: "Follow Records",
      icon: <HeartOutlined style={{ fontSize: 36, color: "#F06292" }} />,
      value: stats.follows,
      color: "#F06292",
      onClick: () => navigate("/admin/follows"),
    },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0d1117", padding: "60px 40px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0d1117", padding: "60px 40px" }}>
        <div style={{ textAlign: "center" }}>
          <Title level={2} style={{ color: "#fff", marginBottom: 8 }}>
            🎯 Admin Dashboard
          </Title>
          <Alert
            message="Access Denied"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 24, maxWidth: 500, margin: "0 auto 24px auto" }}
          />
          <Button type="primary" onClick={() => window.location.href = "/"}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d1117", padding: "60px 40px" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <Title level={2} style={{ color: "#fff", marginBottom: 8 }}>
          🎯 Admin Dashboard
        </Title>
        <Text style={{ color: "#bbb" }}>System overview and live statistics</Text>
      </div>

      <Row gutter={[24, 24]} justify="center">
        {cards.map((item, i) => (
          <Col xs={24} sm={12} md={6} key={i}>
            <Card
              hoverable
              onClick={item.onClick}
              style={{
                borderRadius: 16,
                textAlign: "center",
                background: "linear-gradient(145deg, #1a1f25, #11151a)",
                boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                transition: "all 0.3s ease",
                cursor: item.onClick ? "pointer" : "default",
              }}
              styles={{
                body: {
                  padding: "30px 0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                },
              }}
            >
              {item.icon}
              <Title level={4} style={{ marginTop: 10, color: "#fff", fontWeight: 600 }}>
                {item.title}
              </Title>
              <Text style={{ fontSize: 22, fontWeight: 700, color: item.color }}>
                {(item.value ?? 0).toLocaleString()}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>

      <div
        style={{
          textAlign: "center",
          marginTop: 50,
          color: "#777",
          fontSize: 14,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
        }}
      >
        <ReloadOutlined />
        <span>Last Updated: {lastUpdated || "Loading..."}</span>
      </div>
    </div>
  );
}