import React, { useEffect, useState, useRef } from "react";
import { Table, Card, Button, Spin, Typography, message, Empty } from "antd";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import api from "../api/axios";

const { Title } = Typography;

// Visible container guard to avoid width/height <= 0 chart errors
const VisibleContainer = ({ children, height = 300 }) => {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      const w = Math.max(0, Math.floor(cr?.width || el.offsetWidth || 0));
      const h = Math.max(0, Math.floor(cr?.height || el.offsetHeight || 0));
      setReady(w > 0 && h > 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", height }}>
      {ready ? children : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <Spin />
        </div>
      )}
    </div>
  );
};

function normalizeTopPayload(payload) {
 
  const arr = Array.isArray(payload?.top)
    ? payload.top
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
    ? payload
    : [];
  
  return arr.map((it) => {
    const player1 = it.player1 ?? it.p1 ?? "";
    const player2 = it.player2 ?? it.p2 ?? "";
    const matches =
      typeof it.matches === "number"
        ? it.matches
        : Number(String(it.score).replace(/\D/g, "")) || 0;

    const wins = typeof it.wins === "number" ? it.wins : 0;
    const losses = typeof it.losses === "number" ? it.losses : 0;

    const score =
      wins + losses > 0
        ? `${wins}-${losses}`
        : typeof it.score === "string"
        ? it.score
        : `${matches} matches`;

    return { player1, player2, player1Id: it.player1Id, player2Id: it.player2Id, matches, wins, losses, score };
  });
}

export default function HeadToHeadTop() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/players/headtohead/top");
        const normalized = normalizeTopPayload(res?.data);
        setRows(normalized);
      } catch (err) {
        console.error("❌ Failed to fetch head-to-head top:", err);
        message.error("Failed to load Head-to-Head Top data.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleViewDetail = (r) => {
    const slug = `${encodeURIComponent(r.player1)}_vs_${encodeURIComponent(r.player2)}`;
    navigate(`/headtohead/detail/${slug}`, { 
      state: { player1Id: r.player1Id, player2Id: r.player2Id } 
    });
  };

  const columns = [
    {
      title: "Rank",
      dataIndex: "rank",
      width: 70,
      render: (_v, _r, i) => i + 1,
    },
    { title: "Player 1", dataIndex: "player1" },
    { title: "Player 2", dataIndex: "player2" },
    { title: "Matches", dataIndex: "matches", width: 110 },
    {
      title: "Score",
      dataIndex: "score",
      width: 110,
      render: (v, r) => v ?? `${r.wins ?? 0}-${r.losses ?? 0}`,
    },
    {
      title: "Action",
      key: "action",
      width: 110,
      render: (r) => (
        <Button type="primary" onClick={() => handleViewDetail(r)}>
          View
        </Button>
      ),
    },
  ];

  const chartData = (Array.isArray(rows) ? rows : []).map((r, i) => ({
    name: `${r.player1} vs ${r.player2}`,
    rank: i + 1,
    matches: r.matches ?? 0,
  }));

  return (
    <div
      style={{
        padding: "96px 16px 40px",
        minHeight: "100vh",
        background: "#f7f8fa",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Card
          style={{
            borderRadius: 12,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            marginBottom: 16,
          }}
          styles={{ body: { padding: 24 } }}
        >
          <Title level={3} style={{ textAlign: "center", marginBottom: 16 }}>
            🏆 Legendary Head-to-Head — Top 10
          </Title>

          <Spin spinning={loading}>
            {!loading && rows.length === 0 ? (
              <Empty description="No rivalries found" />
            ) : (
              <>
                <Table
                  columns={columns}
                  dataSource={rows.map((r, i) => ({ key: i, ...r }))}
                  pagination={false}
                  style={{ background: "#fff", marginBottom: 24, borderRadius: 8 }}
                />

                <Card
                  title="🔥 Top 10 Rivalries by Match Count"
                  style={{ background: "#fff", borderRadius: 12 }}
                  styles={{ body: { padding: 16 } }}
                >
                  <VisibleContainer height={360}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                      <BarChart data={chartData}>
                        <XAxis dataKey="rank" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="matches" name="Matches" barSize={40}>
                          {chartData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={
                                ["#1677ff", "#fa541c", "#52c41a", "#722ed1"][i % 4]
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </VisibleContainer>
                </Card>
              </>
            )}
          </Spin>
        </Card>
      </div>
    </div>
  );
}
