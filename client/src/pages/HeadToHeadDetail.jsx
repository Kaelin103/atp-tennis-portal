// src/pages/HeadToHeadDetail.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Card, Typography, Spin, Table, Button, message } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Doughnut, Line } from "react-chartjs-2";
import { motion } from "framer-motion";
import api from "../api/axios";
import CompareRadar from "../components/CompareRadar";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title as ChartTitle,
} from "chart.js";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  ChartTitle
);

const { Title, Paragraph, Text } = Typography;

export default function HeadToHeadDetail() {
  const navigate = useNavigate();
  const { pair } = useParams();
  const location = useLocation();
  const { player1Id, player2Id } = location.state || {};
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  let player1 = "";
  let player2 = "";
  if (pair) {
    const [a, b] = decodeURIComponent(pair).split("_vs_");
    player1 = a || "";
    player2 = b || "";
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get(`/players/headtohead`, {
          params: { player1, player2 },
        });
        setData(res.data);
      } catch (err) {
        console.error("❌ Failed to fetch head-to-head data:", err);
        message.error("Failed to load head-to-head data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [pair]);

  const yearlyTrend = useMemo(() => {
    if (!data?.matches) return [];
    const trend = {};
    data.matches.forEach((m) => {
      const year = m.tourneyDate?.slice(0, 4);
      if (!year) return;
      if (!trend[year]) trend[year] = { wins: 0, losses: 0 };
      if (m.winnerName === player1) trend[year].wins++;
      if (m.winnerName === player2) trend[year].losses++;
    });
    return Object.entries(trend)
      .sort(([a], [b]) => a - b)
      .map(([year, value]) => ({ year, ...value }));
  }, [data, player1, player2]);

  if (loading)
    return (
      <div
        style={{
          minHeight: "80vh",
          backgroundColor: "#0d1117",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Spin size="large" />
      </div>
    );

  if (!data || !data.matches?.length)
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh",
          backgroundColor: "#0d1117",
        }}
      >
        <Card
          style={{
            width: 600,
            padding: 24,
            borderRadius: 12,
            backgroundColor: "#161b22",
            color: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          <Title
            level={3}
            style={{
              color: "#fff",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            Head-to-Head Detail
          </Title>
          <Paragraph style={{ color: "#ccc", textAlign: "center" }}>
            This is a placeholder page for viewing detailed head-to-head player statistics.  
            You can later expand this with charts, match history, or advanced stats.
          </Paragraph>
        </Card>
      </div>
    );

  const chartData = {
    labels: ["Wins", "Losses"],
    datasets: [
      {
        data: [data.wins, data.losses],
        backgroundColor: ["#52c41a", "#f5222d"],
        borderWidth: 1,
        cutout: "70%", 
      },
    ],
  };

  const chartOptions = {
    plugins: {
      legend: { display: true, labels: { color: "#fff" } },
      tooltip: { enabled: true },
    },
  };

  const centerTextPlugin = {
    id: "centerText",
    afterDraw(chart) {
      const { ctx } = chart;
      const winRate = (data.winRate * 100).toFixed(1) + "%";
      ctx.save();
      ctx.font = "bold 22px Arial";
      ctx.fillStyle = "#1890ff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(winRate, chart.width / 2, chart.height / 2 + 10);
      ctx.restore();
    },
  };

  const trendData = {
    labels: yearlyTrend.map((y) => y.year),
    datasets: [
      {
        label: `${player1} Wins`,
        data: yearlyTrend.map((y) => y.wins),
        borderColor: "#52c41a",
        tension: 0.3,
      },
      {
        label: `${player2} Wins`,
        data: yearlyTrend.map((y) => y.losses),
        borderColor: "#f5222d",
        tension: 0.3,
      },
    ],
  };

  const columns = [
    { title: "Tournament", dataIndex: "tourneyName", key: "tourneyName" },
    { title: "Date", dataIndex: "tourneyDate", key: "tourneyDate", render: (v) => v?.slice(0, 10) },
    { title: "Surface", dataIndex: "surface", key: "surface" },
    { title: "Winner", dataIndex: "winnerName", key: "winnerName" },
    { title: "Loser", dataIndex: "loserName", key: "loserName" },
    { title: "Score", dataIndex: "score", key: "score" },
  ];

  const renderRecentTrend = () => {
    const seq = (data?.recentTrend?.sequence || "").split("");
    if (!seq.length) return null;
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {seq.map((c, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              minWidth: 24,
              textAlign: "center",
              padding: "3px 6px",
              borderRadius: 6,
              background: c === "W" ? "#52c41a" : "#f5222d",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            {c}
          </span>
        ))}
        <span style={{ marginLeft: 8, color: "#aaa" }}>
          ({data?.recentTrend?.wins ?? 0}W-{data?.recentTrend?.losses ?? 0}L)
        </span>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#0d1117",
        padding: "20px 0",
      }}
    >
      <Card
        style={{
          width: "92%",
          maxWidth: 1100,
          padding: 24,
          borderRadius: 12,
          backgroundColor: "#161b22",
          color: "#fff",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ marginBottom: 12, color: "#1890ff" }}
        >
          Back
        </Button>

        <Title
          level={3}
          style={{
            color: "#fff",
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          {player1} vs {player2}
        </Title>

        <Paragraph style={{ color: "#ccc", textAlign: "center", marginBottom: 16 }}>
          Total Matches: {data.total} |{" "}
          <Text style={{ color: "#52c41a" }}>Wins: {data.wins}</Text> |{" "}
          <Text style={{ color: "#f5222d" }}>Losses: {data.losses}</Text> |{" "}
          <Text style={{ color: "#1890ff" }}>Win Rate: {(data.winRate * 100).toFixed(1)}%</Text>
        </Paragraph>

        {data?.streak?.player && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}>
            <span style={{ color: "#bbb" }}>Current Streak:</span>
            <span style={{
              background: "#ffec3d",
              color: "#000",
              padding: "4px 10px",
              borderRadius: 8,
              fontWeight: 700,
            }}>
              {data.streak.player} · {data.streak.length}
            </span>
          </div>
        )}

        {renderRecentTrend()}

        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 30 }}>
          <div style={{ width: 280 }}>
            <Doughnut data={chartData} options={chartOptions} plugins={[centerTextPlugin]} />
          </div>
          {yearlyTrend.length > 1 && (
            <div style={{ width: 500 }}>
              <Line
                data={trendData}
                options={{
                  scales: {
                    x: { ticks: { color: "#fff" } },
                    y: { ticks: { color: "#fff" }, beginAtZero: true },
                  },
                  plugins: { legend: { labels: { color: "#fff" } } },
                }}
              />
            </div>
          )}
        </div>

        <Table
          columns={columns}
          dataSource={data.matches}
          rowKey={(r) => r._id || `${r.tourneyDate}-${r.tourneyName}-${r.winnerName}-${r.loserName}`}
          pagination={{ pageSize: 8 }}
          style={{ backgroundColor: "#161b22", marginTop: 30 }}
        />

        <CompareRadar 
          aName={player1} 
          bName={player2} 
          aPid={player1Id}
          bPid={player2Id}
          surface={surface}
        />
      </Card>
    </motion.div>
  );
}
