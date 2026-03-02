// src/pages/SurfaceStats.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Table, Typography, Spin, Tag, Card, message, Segmented, Select } from "antd";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import api from "../api/axios";

const { Title, Paragraph } = Typography;

const COLORS = ["#1890ff", "#fa541c", "#52c41a", "#722ed1", "#8c8c8c"];
const RADIAN = Math.PI / 180;

const renderLabel = ({ cx, cy, midAngle, outerRadius, value }) => {
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const anchor = x > cx ? "start" : "end";
  return (
    <text
      x={x}
      y={y}
      fill="#595959"
      textAnchor={anchor}
      dominantBaseline="central"
      fontSize={12}
      style={{ pointerEvents: "none" }}
    >
      {value}
    </text>
  );
};

export default function SurfaceStats() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("overview"); // overview | yearly | levels
  const [yearly, setYearly] = useState({ Hard: [], Clay: [], Grass: [], Carpet: [], Unknown: [] });
  const [levels, setLevels] = useState({ Hard: [], Clay: [], Grass: [], Carpet: [], Unknown: [] });
  const [yearRange, setYearRange] = useState({ start: 1972, end: 2024 });

  useEffect(() => {
    (async () => {
      try {
// ✅ Fix API path
        const res = await api.get("/players/surfaces");
        const raw = res.data?.stats || res.data?.surfaces || [];
        const normalized = raw.map((d, i) => ({
          rank: i + 1,
          surface: typeof d.surface === "string" ? d.surface.trim() : "Unknown",
          totalMatches: Number(d.totalMatches ?? d.matches ?? 0),
          uniqueWinners: Number(d.uniqueWinners ?? d.winners ?? 0),
        }));
        setRows(normalized);
      } catch (err) {
        console.error("❌ Failed to fetch surface stats:", err);
        message.error("Failed to load surface stats.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // load yearly trend when view toggles to yearly
  useEffect(() => {
    if (view !== "yearly") return;
    const fetchYearly = async () => {
      try {
        const res = await api.get(`/players/surfaces/yearly?start=${yearRange.start}&end=${yearRange.end}`);
        const data = res.data?.yearly || {};
        setYearly({ Hard: data.Hard || [], Clay: data.Clay || [], Grass: data.Grass || [], Carpet: data.Carpet || [], Unknown: data.Unknown || [] });
      } catch (err) {
        console.error("❌ Failed to fetch yearly surface trend:", err);
        message.error("Failed to load yearly trend.");
      }
    };
    fetchYearly();
  }, [view, yearRange]);

  // load level distribution when view toggles to levels
  useEffect(() => {
    if (view !== "levels") return;
    const fetchLevels = async () => {
      try {
        const res = await api.get("/players/surfaces/levels");
        const data = res.data?.levels || {};
        setLevels({ Hard: data.Hard || [], Clay: data.Clay || [], Grass: data.Grass || [], Carpet: data.Carpet || [], Unknown: data.Unknown || [] });
      } catch (err) {
        console.error("❌ Failed to fetch level distribution:", err);
        message.error("Failed to load tournament level stats.");
      }
    };
    fetchLevels();
  }, [view]);

  const columns = [
    { title: "Rank", dataIndex: "rank", width: 80 },
    {
      title: "Surface",
      dataIndex: "surface",
      render: (surface) => {
        const colors = {
          Hard: "geekblue",
          Clay: "volcano",
          Grass: "green",
          Carpet: "purple",
          Unknown: "",
        };
        return <Tag color={colors[surface] || ""}>{surface}</Tag>;
      },
    },
    {
      title: "Total Matches",
      dataIndex: "totalMatches",
      sorter: (a, b) => a.totalMatches - b.totalMatches,
    },
    {
      title: "Unique Winners",
      dataIndex: "uniqueWinners",
      sorter: (a, b) => a.uniqueWinners - b.uniqueWinners,
    },
  ];

  const pieData = rows.map((r) => ({ name: r.surface, value: r.totalMatches }));

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

  return (
    <div
      style={{
        padding: "96px 16px 40px",
        minHeight: "100vh",
        background: "#f7f8fa",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Title level={2}>🌍 Surface Statistics</Title>
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Explore match volume and distinct winners by surface, with yearly trends and tournament level distribution.
        </Paragraph>

        <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
          <Segmented
            options={[
              { label: "Overview", value: "overview" },
              { label: "Yearly Trend", value: "yearly" },
              { label: "Tournament Levels", value: "levels" },
            ]}
            value={view}
            onChange={(v) => setView(v)}
          />
          {view === "yearly" && (
            <Select
              value={`${yearRange.start}-${yearRange.end}`}
              onChange={(v) => {
                const [s, e] = String(v).split("-");
                setYearRange({ start: Number(s), end: Number(e) });
              }}
              options={[
                { label: "1972-1989", value: "1972-1989" },
                { label: "1990-2009", value: "1990-2009" },
                { label: "2010-2024", value: "2010-2024" },
                { label: "1972-2024", value: "1972-2024" },
              ]}
              style={{ width: 140 }}
            />
          )}
        </div>

        {loading ? (
          <Spin size="large" style={{ display: "block", marginTop: 100 }} />
        ) : (
          <>
            {view === "overview" && (
              <Table
                columns={columns}
                dataSource={rows}
                rowKey={(r) => r.surface}
                pagination={false}
                style={{
                  background: "#fff",
                  borderRadius: 8,
                  marginBottom: 24,
                }}
              />
            )}

            {view === "overview" && (
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <Card title="📊 Match Volume by Surface" style={{ flex: 1, minWidth: 360, borderRadius: 8 }}>
                  <VisibleContainer height={300}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                      <BarChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                        <XAxis dataKey="surface" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="totalMatches" name="Total Matches">
                          {rows.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </VisibleContainer>
                </Card>

                <Card title="⏱️ Match Distribution" style={{ flex: 1, minWidth: 360, borderRadius: 8 }}>
                  <VisibleContainer height={300}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                      <PieChart margin={{ top: 8, right: 44, bottom: 8, left: 8 }}>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={105}
                          paddingAngle={1}
                          isAnimationActive={false}
                          labelLine={false}
                          label={renderLabel}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </VisibleContainer>
                </Card>
              </div>
            )}

            {view === "yearly" && (
              <Card title="📈 Yearly Match Trend by Surface" style={{ borderRadius: 8 }}>
                <VisibleContainer height={360}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                    <LineChart
                      data={(() => {
                        // unify years across surfaces
                        const setYears = new Set();
                        [yearly.Hard, yearly.Clay, yearly.Grass, yearly.Carpet, yearly.Unknown].forEach((arr) => arr.forEach((r) => setYears.add(r.year)));
                        const years = Array.from(setYears).sort((a, b) => a - b);
                        return years.map((y) => ({
                          year: y,
                          Hard: (yearly.Hard.find((r) => r.year === y)?.matches) || 0,
                          Clay: (yearly.Clay.find((r) => r.year === y)?.matches) || 0,
                          Grass: (yearly.Grass.find((r) => r.year === y)?.matches) || 0,
                          Carpet: (yearly.Carpet.find((r) => r.year === y)?.matches) || 0,
                        }));
                      })()}
                      margin={{ top: 16, right: 24, left: 12, bottom: 16 }}
                    >
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="Hard" stroke="#1890ff" dot={false} />
                      <Line type="monotone" dataKey="Clay" stroke="#fa541c" dot={false} />
                      <Line type="monotone" dataKey="Grass" stroke="#52c41a" dot={false} />
                      <Line type="monotone" dataKey="Carpet" stroke="#722ed1" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </VisibleContainer>
              </Card>
            )}

            {view === "levels" && (
              <Card title="🏷️ Tournament Level Distribution by Surface" style={{ borderRadius: 8 }}>
                <VisibleContainer height={360}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                    <BarChart
                      data={(() => {
                        // collect all levels
                        const levelSet = new Set();
                        Object.values(levels).forEach((arr) => arr.forEach((r) => levelSet.add(r.level)));
                        const lv = Array.from(levelSet);
                        return lv.map((level) => ({
                          level,
                          Hard: (levels.Hard.find((r) => r.level === level)?.matches) || 0,
                          Clay: (levels.Clay.find((r) => r.level === level)?.matches) || 0,
                          Grass: (levels.Grass.find((r) => r.level === level)?.matches) || 0,
                          Carpet: (levels.Carpet.find((r) => r.level === level)?.matches) || 0,
                        }));
                      })()}
                      margin={{ top: 16, right: 24, left: 12, bottom: 16 }}
                    >
                      <XAxis dataKey="level" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Hard" fill="#1890ff" />
                      <Bar dataKey="Clay" fill="#fa541c" />
                      <Bar dataKey="Grass" fill="#52c41a" />
                      <Bar dataKey="Carpet" fill="#722ed1" />
                    </BarChart>
                  </ResponsiveContainer>
                </VisibleContainer>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
