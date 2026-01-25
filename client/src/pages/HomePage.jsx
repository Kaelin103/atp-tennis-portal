import React from "react";
import { Card, Typography, Row, Col } from "antd";
import { useNavigate } from "react-router-dom";
import {
  TrophyOutlined,
  TeamOutlined,
  BarChartOutlined,
} from "@ant-design/icons";

const { Title, Paragraph } = Typography;

export default function HomePage() {
  const navigate = useNavigate();

  const features = [
    {
      title: "Player Rankings",
      description: "Top players by win rate.",
      icon: <TrophyOutlined style={{ fontSize: 36, color: "#1890ff" }} />,
      path: "/rankings",
    },
    {
      title: "Legendary Head-to-Head",
      description: "Most-played rivalries.",
      icon: <TeamOutlined style={{ fontSize: 36, color: "#722ed1" }} />,
      path: "/headtohead/top",
    },
    {
      title: "Surface Stats",
      description: "Win rates by court type.",
      icon: <BarChartOutlined style={{ fontSize: 36, color: "#13c2c2" }} />,
      path: "/surfacestats", // Added route path
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #001529 0%, #004080 100%)",
        color: "#fff",
        padding: "60px 20px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 50 }}>
        <Title
          level={2}
          style={{ color: "white", fontSize: "2.2rem", marginBottom: 12 }}
        >
          🎾 ATP Tennis Data Portal
        </Title>
        <Paragraph style={{ color: "rgba(255,255,255,0.75)" }}>
          Explore global ATP data, legendary rivalries, and surface performance
          analytics.
        </Paragraph>
      </div>

      <Row gutter={[32, 32]} justify="center" style={{ maxWidth: 1100 }}>
        {features.map((f) => (
          <Col xs={24} sm={12} md={8} key={f.title}>
            <Card
              hoverable
              onClick={() => navigate(f.path)}
              style={{
                borderRadius: 12,
                textAlign: "center",
                padding: "30px 10px",
                cursor: "pointer",
              }}
            >
              {f.icon}
              <Title level={4} style={{ marginTop: 16 }}>
                {f.title}
              </Title>
              <Paragraph type="secondary">{f.description}</Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
