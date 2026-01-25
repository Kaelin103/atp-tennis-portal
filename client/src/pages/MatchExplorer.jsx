// src/pages/MatchExplorer.jsx
import React, { useEffect, useState } from "react";
import { Card, Typography, Table, Input, Spin, message, Button } from "antd";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const { Title } = Typography;

export default function MatchExplorer() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  const pageSize = 20;

  const fetchMatches = async (p = 1, keyword = "") => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("page", String(p));
      if (keyword.trim()) params.set("player", keyword.trim());
      const res = await api.get(`/matches?${params.toString()}`);
      const data = res.data || {};
      setRows(Array.isArray(data.matches) ? data.matches : []);
      setTotal(Number(data.total || 0));
    } catch (err) {
      console.error("❌ Failed to fetch matches:", err);
      message.error("Failed to load matches. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches(page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const columns = [
    { title: "Date", dataIndex: "tourneyDate", key: "date", render: (d) => new Date(d).toLocaleDateString(), width: 120 },
    { title: "Tournament", dataIndex: "tourneyName", key: "tourney" },
    { title: "Surface", dataIndex: "surface", key: "surface", width: 120 },
    { title: "Winner", dataIndex: "winnerName", key: "winner" },
    { title: "Loser", dataIndex: "loserName", key: "loser" },
    { title: "Score", dataIndex: "score", key: "score", width: 120 },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d1117", padding: "60px 40px" }}>
      <Card
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>📚 All Matches</Title>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button onClick={() => navigate(-1)}>Back</Button>
            <Input
            placeholder="Search by player name..."
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => { setPage(1); fetchMatches(1, search); }}
            style={{ width: 280 }}
          />
          </div>
        </div>

        <Spin spinning={loading}>
          <Table
            rowKey={(r) => r._id || `${r.tourneyName}-${r.tourneyDate}-${r.winnerName}-${r.loserName}`}
            columns={columns}
            dataSource={rows}
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: (p) => setPage(p),
              showTotal: (t) => `${t.toLocaleString()} matches`,
            }}
            bordered
          />
        </Spin>
      </Card>
    </div>
  );
}
