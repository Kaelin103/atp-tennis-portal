import React, { useEffect, useState } from "react";
import { Table, Input, Card, Typography, message, Spin, Select, Button } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const { Title: AntTitle } = Typography;

export default function PlayerList() {
  const [players, setPlayers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(200);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/players/rankings?limit=${limit}`);
        const data = res.data?.players || [];

        const normalized = data.map((p, index) => ({
          key: `${p.name || p.playerName || 'player'}-${index + 1}`,
          rank: index + 1,
          name: p.name || p.playerName || "Unknown",
          wins: p.wins,
          losses: p.losses,
          total: p.total,
          winRate: p.winRate,
          country: p.countryCode || p.country || "—",
        }));

        setPlayers(normalized);
        setFiltered(normalized);
      } catch (err) {
        console.error("❌ Failed to fetch player rankings:", err);
        message.error("Failed to load player rankings. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [limit]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(players);
    } else {
      const lower = search.toLowerCase();
      setFiltered(players.filter((p) => p.name.toLowerCase().includes(lower)));
    }
  }, [search, players]);

  const columns = [
    { title: "Rank", dataIndex: "rank", key: "rank", width: 80 },
    {
      title: "Player",
      dataIndex: "name",
      key: "name",
      render: (text) => <strong>{text}</strong>,
    },
    { title: "Wins", dataIndex: "wins", key: "wins", width: 100 },
    { title: "Losses", dataIndex: "losses", key: "losses", width: 100 },
    {
      title: "Win Rate",
      dataIndex: "winRate",
      key: "winRate",
      render: (v) => `${(v * 100).toFixed(1)}%`,
      width: 120,
    },
  ];

  const top10 = filtered.slice(0, 10);
  const chartData = {
    labels: top10.map((p) => p.name),
    datasets: [
      {
        label: "Win Rate",
        data: top10.map((p) => Number((p.winRate * 100).toFixed(2))),
        backgroundColor: [
          "#409EFF",
          "#67C23A",
          "#E6A23C",
          "#F56C6C",
          "#909399",
          "#00B8A9",
          "#FF6F61",
          "#6A5ACD",
          "#20B2AA",
          "#FFA07A",
        ],
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => value + "%",
        },
      },
      x: {
        ticks: {
          color: "#333",
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  return (
    <div className="page-frame">
      <Card
        style={{
          width: "100%",
          maxWidth: 1100,
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <AntTitle level={3} style={{ margin: 0 }}>🏆 ATP Player Win Rate Rankings</AntTitle>
          <div style={{ display: "flex", gap: 8 }}>
            <Select
              value={limit}
              onChange={(v) => setLimit(v)}
              options={[
                { value: 50, label: "Top 50" },
                { value: 100, label: "Top 100" },
                { value: 200, label: "Top 200" },
                { value: 500, label: "Top 500" },
              ]}
              style={{ width: 120 }}
            />
            <Button onClick={() => navigate(-1)}>Back</Button>
          </div>
        </div>

        <Input
          placeholder="Search player by name..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{
            marginBottom: 20,
            width: "100%",
            maxWidth: 400,
          }}
        />

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Spin size="large" />
          </div>
        ) : filtered.length > 0 ? (
          <>
            <Table
              columns={columns}
              dataSource={filtered}
              pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [20, 50, 100] }}
              bordered
              onRow={(record) => ({
                onClick: () => navigate(`/player/${record.name}`),
                style: { cursor: "pointer" },
              })}
              style={{ marginBottom: 32 }}
            />

            <Card
              title="📊 Top 10 Players by Win Rate"
              style={{ borderRadius: 12 }}
            >
              <Bar data={chartData} options={chartOptions} height={120} />
            </Card>
          </>
        ) : (
          <p
            style={{
              textAlign: "center",
              marginTop: 80,
              color: "rgba(255,255,255,0.85)",
              fontSize: 16,
            }}
          >
            No player data found.
          </p>
        )}
      </Card>
    </div>
  );
}
