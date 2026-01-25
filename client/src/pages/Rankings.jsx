// src/pages/Rankings.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Table, Select, Typography, Spin, Empty, Segmented, Button, Space } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { PageMotion, SectionMotion } from "../utils/PageMotion";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ChartTitle, Tooltip, Legend);

const { Title: AntTitle, Text } = Typography;

// Map common 3-letter sports codes to ISO-2 codes for proper flag emojis
const toISO2 = (code) => {
  if (!code) return "";
  const c = code.toUpperCase();
  const map = {
    USA: "US",
    GBR: "GB",
    ENG: "GB",
    SCO: "GB",
    WAL: "GB",
    ESP: "ES",
    FRA: "FR",
    GER: "DE",
    SUI: "CH",
    ITA: "IT",
    SRB: "RS",
    CRO: "HR",
    BIH: "BA",
    MNE: "ME",
    SVN: "SI",
    SVK: "SK",
    POL: "PL",
    CZE: "CZ",
    NED: "NL",
    BEL: "BE",
    POR: "PT",
    AUT: "AT",
    SWE: "SE",
    NOR: "NO",
    DEN: "DK",
    FIN: "FI",
    RUS: "RU",
    UKR: "UA",
    KAZ: "KZ",
    GEO: "GE",
    ROU: "RO",
    BUL: "BG",
    GRE: "GR",
    TUR: "TR",
    ARG: "AR",
    BRA: "BR",
    CHI: "CL",
    COL: "CO",
    PER: "PE",
    MEX: "MX",
    CAN: "CA",
    AUS: "AU",
    NZL: "NZ",
    JPN: "JP",
    KOR: "KR",
    CHN: "CN",
    TPE: "TW",
    HKG: "HK",
    IND: "IN",
    UAE: "AE",
    QAT: "QA",
    EGY: "EG",
    MAR: "MA",
    RSA: "ZA",
  };
  return map[c] || c;
};

export default function Rankings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const chartRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    year: "all",
    surface: "all",
    minMatches: 5,
  });
  const [rankMode, setRankMode] = useState("all"); // all | dynamic
  // Dynamic window preset for sliding window rankings: '500d' | '52w' | '104w'
  const [windowPreset, setWindowPreset] = useState("500d");
  const [useBonus, setUseBonus] = useState(false); // bonus scoring for dynamic mode
  const [useDecay, setUseDecay] = useState(false); // time decay for weighted mode
  const [lambda, setLambda] = useState(0.8);
  const [sortBy, setSortBy] = useState("winRate");
  const [mode, setMode] = useState("winRate");
  const [algo, setAlgo] = useState("classic");
  const [showScore, setShowScore] = useState(false); // show score column in dynamic mode
  const [chartLimit, setChartLimit] = useState(10); 
  const [chartMode, setChartMode] = useState("total"); // total | surface | yearly
  const [surfaceData, setSurfaceData] = useState({ Hard: [], Clay: [], Grass: [], Carpet: [] });
  const [surfaceLoading, setSurfaceLoading] = useState(false);
  const [yearRange, setYearRange] = useState({ start: 1990, end: 2009 });
  const [metric, setMetric] = useState("matches"); // matches | share
  const [yearlyData, setYearlyData] = useState({ Hard: [], Clay: [], Grass: [], Carpet: [], Unknown: [] });
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [levelsData, setLevelsData] = useState({ Hard: [], Clay: [], Grass: [], Carpet: [], Unknown: [] });
  const [levelsLoading, setLevelsLoading] = useState(false);
  const chartContainerRef = useRef(null);
  const [containerReady, setContainerReady] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);
  const ORIENTATION_SWITCH_PX = 768; // switch to horizontal bars when container width is below this

  const yearOptions = useMemo(
    () => [
      { value: "all", label: "All Years" },
      ...Array.from({ length: new Date().getFullYear() - 1999 }, (_, i) => {
        const y = 2000 + i;
        return { value: String(y), label: String(y) };
      }),
    ],
    []
  );

  const surfaceOptions = [
    { value: "all", label: "All Surfaces" },
    { value: "Hard", label: "Hard" },
    { value: "Clay", label: "Clay" },
    { value: "Grass", label: "Grass" },
    { value: "Carpet", label: "Carpet" },
  ];

  const matchOptions = [
    { value: 5, label: "≥5 Matches" },
    { value: 10, label: "≥10 Matches" },
    { value: 20, label: "≥20 Matches" },
  ];

  const chartViewOptions = [
    { value: 10, label: "Top 10" },
    { value: 20, label: "Top 20" },
  ];

  useEffect(() => {
    if (!user) return;

    async function fetchRankings() {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("minMatches", String(filters.minMatches));
        qs.set("limit", "50");
        let url = "/players/rankings";
        if (rankMode === "all") {
          if (filters.year !== "all") qs.set("year", filters.year);
          if (filters.surface !== "all") qs.set("surface", filters.surface);
          qs.set("algo", algo);
          if (algo === "classic") {
            // align behavior with dynamic classic
            if (useBonus) qs.set("bonus", "true");
            qs.set("sortBy", mode === "weighted" ? "weighted" : sortBy);
          }
          url = `/players/rankings?${qs.toString()}`;
        } else {
          // dynamic mode using selected window preset
          if (windowPreset === "500d") qs.set("days", "500");
          else if (windowPreset === "52w") qs.set("weeks", "52");
          else if (windowPreset === "104w") qs.set("weeks", "104");
          if (filters.surface !== "all") qs.set("surface", filters.surface);
          if (useBonus) qs.set("bonus", "true");
          if (useDecay) {
            qs.set("decay", "true");
            qs.set("lambda", String(lambda));
          }
          qs.set("sortBy", mode === "weighted" ? "weighted" : sortBy);
          qs.set("algo", algo);
          url = `/players/rankings/dynamic?${qs.toString()}`;
        }

        const res = await api.get(url);
        setRows(Array.isArray(res.data?.players) ? res.data.players : []);
      } catch (err) {
        console.error("❌ Failed to fetch rankings:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    fetchRankings();
  }, [filters, rankMode, windowPreset, useBonus, useDecay, lambda, sortBy, algo, user]);

  // Detect container width to decide orientation and label condensation
  useEffect(() => {
    const measure = () => {
      const w = chartContainerRef.current?.offsetWidth || window.innerWidth || 0;
      const h = chartContainerRef.current?.offsetHeight || 0;
      setIsNarrow(w < ORIENTATION_SWITCH_PX);
      // Guard against rendering charts when container has zero dimension
      setContainerReady(w > 0 && h > 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Load per-surface rankings when viewing surface trend
  useEffect(() => {
    if (!user || chartMode !== "surface") return;
    const loadSurface = async () => {
      try {
        setSurfaceLoading(true);
        const qsBase = new URLSearchParams();
        if (filters.year !== "all") qsBase.set("year", filters.year);
        qsBase.set("minMatches", String(filters.minMatches));
        qsBase.set("limit", String(Math.max(chartLimit, 20)));
        const surfaces = ["Hard", "Clay", "Grass", "Carpet"];
        const calls = surfaces.map((s) => api.get(`/players/rankings?${qsBase.toString()}&surface=${encodeURIComponent(s)}`));
        const results = await Promise.allSettled(calls);
        const next = { Hard: [], Clay: [], Grass: [], Carpet: [] };
        results.forEach((r, i) => {
          const key = surfaces[i];
          if (r.status === "fulfilled") next[key] = Array.isArray(r.value.data?.players) ? r.value.data.players : [];
          else next[key] = [];
        });
        setSurfaceData(next);
      } catch (err) {
        console.error("❌ Failed to fetch surface rankings:", err);
        setSurfaceData({ Hard: [], Clay: [], Grass: [], Carpet: [] });
      } finally {
        setSurfaceLoading(false);
      }
    };
    loadSurface();
  }, [user, chartMode, filters, chartLimit]);

  // Load per-surface yearly trend when chartMode === 'yearly'
  useEffect(() => {
    if (!user || chartMode !== "yearly") return;
    const loadYearly = async () => {
      try {
        setYearlyLoading(true);
        const res = await api.get(`/players/surfaces/yearly?start=${yearRange.start}&end=${yearRange.end}`);
        const data = res.data?.yearly || {};
        setYearlyData({
          Hard: data.Hard || [],
          Clay: data.Clay || [],
          Grass: data.Grass || [],
          Carpet: data.Carpet || [],
          Unknown: data.Unknown || [],
        });
      } catch (err) {
        console.error("❌ Failed to fetch yearly surface trend:", err);
        setYearlyData({ Hard: [], Clay: [], Grass: [], Carpet: [], Unknown: [] });
      } finally {
        setYearlyLoading(false);
      }
    };
    loadYearly();
  }, [user, chartMode, yearRange]);

  // Load tournament level distribution when chartMode === 'levels'
  useEffect(() => {
    if (!user || chartMode !== "levels") return;
    const loadLevels = async () => {
      try {
        setLevelsLoading(true);
        const res = await api.get(`/players/surfaces/levels`);
        const data = res.data?.levels || {};
        setLevelsData({
          Hard: data.Hard || [],
          Clay: data.Clay || [],
          Grass: data.Grass || [],
          Carpet: data.Carpet || [],
          Unknown: data.Unknown || [],
        });
      } catch (err) {
        console.error("❌ Failed to fetch tournament level stats:", err);
        setLevelsData({ Hard: [], Clay: [], Grass: [], Carpet: [], Unknown: [] });
      } finally {
        setLevelsLoading(false);
      }
    };
    loadLevels();
  }, [user, chartMode]);

  const columnsClassic = [
    { title: "Rank", dataIndex: "rank", key: "rank", width: 80 },
    {
      title: "Player",
      dataIndex: "name",
      key: "name",
      render: (name) => (
        <span
          onClick={() => navigate(`/player/${encodeURIComponent(name)}`)}
          style={{ color: "#1890ff", cursor: "pointer" }}
        >
          {name}
        </span>
      ),
    },
    {
      title: "Country",
      key: "country",
      width: 140,
      render: (_, record) => {
        const raw = (record.countryCode || record.country || "UNK").toUpperCase();
        const code = toISO2(raw);
        if (code === "UNK" || code === "N/A") return "N/A";
        
        return code;
      },
    },
    { title: "Wins", dataIndex: "wins", key: "wins", width: 100 },
    { title: "Losses", dataIndex: "losses", key: "losses", width: 100 },
    ...(algo === "classic" && showScore
      ? [{ title: "Score", dataIndex: "score", key: "score", width: 120, render: (v) => (v != null ? Number(v).toFixed(2) : "-") }]
      : []),
    { title: "Weighted Score", dataIndex: "weightedScore", key: "weightedScore", width: 140, render: (v) => (v != null ? Number(v).toFixed(4) : "-") },
    {
      title: "Win Rate",
      dataIndex: "winRate",
      key: "winRate",
      width: 120,
      render: (v) => `${(Number(v || 0) * 100).toFixed(1)}%`,
    },
  ];

  const columnsElo = [
    { title: "Rank", dataIndex: "rank", key: "rank", width: 80 },
    {
      title: "Player",
      dataIndex: "name",
      key: "name",
      render: (name) => (
        <span
          onClick={() => navigate(`/player/${encodeURIComponent(name)}`)}
          style={{ color: "#1890ff", cursor: "pointer" }}
        >
          {name}
        </span>
      ),
    },
    {
      title: "Country",
      dataIndex: "countryCode",
      key: "country",
      width: 140,
      render: (raw) => {
        const code = toISO2(String(raw || "UNK").toUpperCase());
        return code === "UNK" || code === "N/A" ? "N/A" : code;
      },
    },
    { title: "Elo Rating", dataIndex: "elo", key: "elo", width: 140, render: (v) => (v != null ? Number(v).toFixed(1) : "-") },
  ];

  const visiblePlayers = rows.slice(0, chartLimit);

  const chartData = {
    labels: visiblePlayers.map((p) => p.name),
    datasets: [
      {
        label: "Win Rate (%)",
        data: visiblePlayers.map((p) => Number(((Number(p.winRate || 0) * 100)).toFixed(1))),
        backgroundColor: [
          "#1E90FF",
          "#FF5722",
          "#4CAF50",
          "#8E24AA",
          "#2196F3",
          "#FF9800",
          "#43A047",
          "#9C27B0",
          "#03A9F4",
          "#E64A19",
          "#5C6BC0",
          "#26C6DA",
          "#7E57C2",
          "#66BB6A",
          "#EF5350",
          "#AB47BC",
          "#29B6F6",
          "#8D6E63",
          "#FF7043",
          "#26A69A",
        ].slice(0, chartLimit),
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  // Helper to format names as two lines, shortening only middle names when narrow
  const formatNameTwoLines = (raw, narrow) => {
    const safe = String(raw || "");
    const parts = safe.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0];
      const last = parts[parts.length - 1];
      const middles = parts.slice(1, -1);
      let middleStr = middles.join(" ");
      if (narrow && middles.length) {
        middleStr = middles.map((m) => (m ? `${m.charAt(0)}.` : "")).join(" ");
      }
      const secondLine = middleStr ? `${middleStr} ${last}` : last;
      return [first, secondLine];
    }
    if (safe.length > 16) {
      const mid = Math.ceil(safe.length / 2);
      return [safe.slice(0, mid), safe.slice(mid)];
    }
    return safe;
  };

  // Single-line formatter for horizontal layout: keep first and last intact, shorten middles
  const formatNameSingleLine = (raw) => {
    const safe = String(raw || "");
    const parts = safe.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0];
      const last = parts[parts.length - 1];
      const middles = parts.slice(1, -1);
      const middleStr = middles.map((m) => (m ? `${m.charAt(0)}.` : "")).join(" ");
      return middleStr ? `${first} ${middleStr} ${last}` : `${first} ${last}`;
    }
    return safe;
  };

  const chartIsHorizontal = useMemo(
    () => isNarrow || (chartMode === "total" && chartLimit >= 15),
    [isNarrow, chartMode, chartLimit]
  );

  const chartOptions = useMemo(() => {
    const indexAxis = chartIsHorizontal ? "y" : "x"; // force horizontal when many bars
    const barThickness = chartIsHorizontal ? 28 : chartLimit >= 20 ? 28 : 36; // keep Top 20 visually robust

    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis,
      layout: { padding: { top: 20, bottom: indexAxis === "x" ? 64 : 20, left: indexAxis === "y" ? 24 : 12, right: 12 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(0,0,0,0.75)",
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          callbacks: {
            title: (items) => {
              const idx = items?.[0]?.dataIndex ?? 0;
              return chartData.labels[idx] || "";
            },
            label: (ctx) => (indexAxis === "x" ? ` ${ctx.parsed.y}%` : ` ${ctx.parsed.x}%`),
          },
        },
      },
      scales: indexAxis === "x"
        ? {
            x: {
              ticks: {
                color: "#333",
                font: { size: 11 },
                maxRotation: 0,
                minRotation: 0,
                autoSkip: false,
                autoSkipPadding: 6,
                padding: 6,
                callback: (value, index) => formatNameTwoLines(chartData.labels[index], false),
              },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              min: 0,
              max: 100,
              ticks: {
                color: "#555",
                font: { size: 11 },
                stepSize: 10,
                callback: (v) => `${v}%`,
              },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
          }
        : {
            y: {
              ticks: {
                color: "#333",
                font: { size: 12 },
                autoSkip: false,
                padding: 6,
                callback: (value, index) => formatNameSingleLine(chartData.labels[index]),
              },
              grid: { display: false },
            },
            x: {
              beginAtZero: true,
              min: 0,
              max: 100,
              ticks: {
                color: "#555",
                font: { size: 11 },
                stepSize: 10,
                callback: (v) => `${v}%`,
              },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
          },
      elements: {
        bar: {
          borderRadius: 6,
          barThickness,
          maxBarThickness: barThickness,
          categoryPercentage: 0.8,
          barPercentage: 0.9,
        },
      },
    };
  }, [chartData.labels, chartIsHorizontal, chartLimit]);

  const needsHorizontalScroll = useMemo(
    () => chartMode === "total" && chartLimit >= 20 && !chartIsHorizontal,
    [chartMode, chartLimit, chartIsHorizontal]
  );

  // Navigate to player detail when clicking a bar
  const handleBarClick = (evt) => {
    const chart = chartRef.current;
    if (!chart) return;
    const nativeEvent = evt?.nativeEvent ?? evt;
    const points = chart.getElementsAtEventForMode(nativeEvent, "nearest", { intersect: true }, true);
    if (!points || points.length === 0) return;
    const idx = points[0].index;
    const name = chartData.labels[idx];
    if (name) navigate(`/player/${encodeURIComponent(name)}`);
  };

  // Build Chart.js dataset for yearly trend
  const yearlyChartData = useMemo(() => {
    // collect all years across surfaces
    const yearsSet = new Set();
    [yearlyData.Hard, yearlyData.Clay, yearlyData.Grass, yearlyData.Carpet].forEach((arr) =>
      arr.forEach((r) => yearsSet.add(r.year))
    );
    const years = Array.from(yearsSet).sort((a, b) => a - b);

    // helper to get value for a surface/year
    const getMatches = (arr, y) => Number(arr.find((r) => r.year === y)?.matches || 0);
    const totalsByYear = years.map((y) =>
      getMatches(yearlyData.Hard, y) + getMatches(yearlyData.Clay, y) + getMatches(yearlyData.Grass, y) + getMatches(yearlyData.Carpet, y)
    );

    const toSeries = (name, color, arr) => ({
      label: name,
      data: years.map((y, idx) => {
        const m = getMatches(arr, y);
        if (metric === "matches") return m;
        const total = totalsByYear[idx] || 1;
        return Number(((m / total) * 100).toFixed(2));
      }),
      borderColor: color,
      backgroundColor: color,
      tension: 0.3,
      pointRadius: 2,
    });

    return {
      labels: years,
      datasets: [
        toSeries("Hard", "#1677ff", yearlyData.Hard),
        toSeries("Clay", "#fa541c", yearlyData.Clay),
        toSeries("Grass", "#52c41a", yearlyData.Grass),
        toSeries("Carpet", "#722ed1", yearlyData.Carpet),
      ],
    };
  }, [yearlyData, metric]);

  const yearlyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: metric === "matches"
          ? { label: (ctx) => ` ${ctx.parsed.y}` }
          : { label: (ctx) => ` ${ctx.parsed.y}%` },
      },
    },
    scales: {
      y: metric === "matches"
        ? { beginAtZero: true }
        : { beginAtZero: true, suggestedMax: 100, ticks: { callback: (v) => `${v}%` } },
    },
  };

  if (!user) {
    return (
      <PageMotion>
        <div
          style={{
            height: "70vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            color: "#ddd",
          }}
        >
          <AntTitle level={3} style={{ color: "#fff" }}>
            🔒 Please log in to view ATP Player Rankings
          </AntTitle>
          <Text style={{ color: "#bbb" }}>
            Log in to explore detailed ATP rankings and player insights.
          </Text>
        </div>
      </PageMotion>
    );
  }

  return (
    <PageMotion>
      <Card
        style={{
          width: "100%",
          maxWidth: 1100,
          margin: "0 auto",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <AntTitle level={3} style={{ margin: 0 }}>🏆 ATP Player Rankings</AntTitle>
          <div style={{ marginTop: 10 }}>
            <Space wrap size={8}>
              <Segmented
                options={[
                  { label: "All", value: "all" },
                  { label: "500d", value: "500d" },
                  { label: "52w", value: "52w" },
                  { label: "104w", value: "104w" },
                ]}
                value={rankMode === "all" ? "all" : windowPreset}
                onChange={(v) => {
                  if (v === "all") {
                    setRankMode("all");
                  } else {
                    setRankMode("dynamic");
                    setWindowPreset(v);
                  }
                }}
              />
              {rankMode === "dynamic" && (
                <Segmented
                  options={[
                    { label: "Classic", value: "classic" },
                    { label: "Elo", value: "elo" },
                  ]}
                  value={algo}
                  onChange={(v) => setAlgo(v)}
                />
              )}
              {algo !== "elo" && (
                <Segmented
                  options={[
                    { label: "Win Rate", value: "winRate" },
                    { label: "Weighted", value: "weighted" },
                  ]}
                  value={mode}
                  onChange={(v) => setMode(v)}
                />
              )}
              {rankMode === "dynamic" && algo === "classic" && (
                <Segmented
                  options={[
                    { label: "Bonus Off", value: false },
                    { label: "Bonus On", value: true },
                  ]}
                  value={useBonus}
                  onChange={(v) => setUseBonus(Boolean(v))}
                />
              )}
              {rankMode === "dynamic" && algo === "classic" && mode === "weighted" && (
                <Space size={8}>
                  <Segmented
                    options={[
                      { label: "Decay Off", value: false },
                      { label: "Decay On", value: true },
                    ]}
                    value={useDecay}
                    onChange={(v) => setUseDecay(Boolean(v))}
                  />
                  {useDecay && (
                    <Select
                      value={lambda}
                      onChange={setLambda}
                      options={[
                        { label: "λ=0.4", value: 0.4 },
                        { label: "λ=0.8", value: 0.8 },
                        { label: "λ=1.2", value: 1.2 },
                      ]}
                      style={{ width: 90 }}
                    />
                  )}
                </Space>
              )}
              <Button onClick={() => navigate(-1)}>Back</Button>
            </Space>
          </div>
        </div>

        {/* Prominent toolbar: sort and score visibility */}
        {algo === "classic" && (
          <div style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f5f7fb",
            border: "1px solid #e6e9ef",
            padding: "10px 12px",
            borderRadius: 8,
            marginBottom: 12,
          }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>Toolbar</span>
              <Segmented
                options={[
                  { label: "Sort: WinRate", value: "winRate" },
                  { label: "Sort: Score", value: "score" },
                ]}
                value={sortBy}
                onChange={(v) => setSortBy(v)}
              />
              <Segmented
                options={[
                  { label: "Score Col: Off", value: false },
                  { label: "Score Col: On", value: true },
                ]}
                value={showScore}
                onChange={(v) => setShowScore(Boolean(v))}
              />
            </div>
            <div style={{ color: "#555" }}>
              {rankMode === "dynamic" ? (
                <>
                  <strong>Window:</strong> {windowPreset === "500d" ? "Last 500 days" : windowPreset === "52w" ? "Last 52 Weeks" : "Last 104 Weeks"}
                </>
              ) : (
                <>
                  <strong>Window:</strong> All Seasons
                </>
              )}
              {" "}· <strong>Sort:</strong> {sortBy}
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <Select
            value={filters.year}
            options={yearOptions}
            onChange={(value) => setFilters((f) => ({ ...f, year: value }))}
            style={{ width: 160 }}
          />
          <Select
            value={filters.surface}
            options={surfaceOptions}
            onChange={(value) => setFilters((f) => ({ ...f, surface: value }))}
            style={{ width: 160 }}
          />
          <Select
            value={filters.minMatches}
            options={matchOptions}
            onChange={(value) => setFilters((f) => ({ ...f, minMatches: value }))}
            style={{ width: 160 }}
          />
        </div>

        <Spin spinning={loading}>
          {!loading && rows.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No players meet the selected criteria."
              style={{ padding: "48px 0" }}
            />
          ) : (
            <>
              <SectionMotion>
                <Card
                  title={`Ranking Table — ${rankMode === "dynamic" ? `Dynamic (${windowPreset === "500d" ? "Last 500 days" : windowPreset === "52w" ? "Last 52 Weeks" : "Last 104 Weeks"})` : "All Seasons"} · ${algo === "elo" ? "Algo: Elo" : `Metric: ${mode}`}`}
                  style={{ marginBottom: 24 }}
                >
                  <Table
                    columns={algo === "elo" ? columnsElo : columnsClassic}
                    dataSource={(function(){
                      const sorted = [...rows];
                      if (algo === "elo") sorted.sort((a,b) => (Number(b.elo||0) - Number(a.elo||0)) || String(a.name||"").localeCompare(String(b.name||"")));
                      else if (mode === "weighted") sorted.sort((a,b) => (Number(b.weightedScore || 0) - Number(a.weightedScore || 0)) || (Number(b.wins||0)-Number(a.wins||0)) || (Number(b.total||0)-Number(a.total||0)) || String(a.name||"").localeCompare(String(b.name||"")));
                      else if (rankMode !== "dynamic" || sortBy === "winRate") sorted.sort((a,b) => (Number(b.winRate||0) - Number(a.winRate||0)) || (Number(b.wins||0)-Number(a.wins||0)) || (Number(b.total||0)-Number(a.total||0)) || String(a.name||"").localeCompare(String(b.name||"")));
                      return sorted.map((p, i) => ({ key: `${p.name}-${i}`, ...p, rank: i + 1 }));
                    })()}
                    pagination={false}
                    bordered
                  />
                </Card>
              </SectionMotion>

              <SectionMotion delay={0.2}>
                <Card
                  title={
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>
                        {chartMode === "total"
                          ? (algo === "elo"
                              ? "Elo Rating Chart"
                              : (rankMode === "dynamic"
                                  ? `Win Rate Chart — Dynamic (${windowPreset === "500d" ? "Last 500 days" : windowPreset === "52w" ? "Last 52 Weeks" : "Last 104 Weeks"})`
                                  : "Win Rate Chart"))
                          : chartMode === "surface"
                          ? "Surface-specific Win Rate Trend"
                          : chartMode === "yearly"
                          ? "Per-surface Yearly Trend"
                          : "Tournament Level Distribution by Surface"}
                      </span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Segmented
                          options={[
                            { label: "Total", value: "total" },
                            { label: "By Surface", value: "surface" },
                            { label: "Yearly", value: "yearly" },
                            { label: "Levels", value: "levels" },
                          ]}
                          value={chartMode}
                          onChange={(v) => setChartMode(v)}
                        />
                        {chartMode !== "yearly" ? (
                        <Select
                          value={chartLimit}
                          options={chartViewOptions}
                          onChange={(v) => setChartLimit(v)}
                          style={{ width: 120 }}
                        />
                        ) : (
                        <div style={{ display: "flex", gap: 8 }}>
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
                          <Select
                            value={metric}
                            onChange={(v) => setMetric(v)}
                            options={[
                              { label: "Match Count", value: "matches" },
                              { label: "Match Share (%)", value: "share" },
                            ]}
                            style={{ width: 160 }}
                          />
                        </div>
                        )}
                      </div>
                    </div>
                  }
                  style={{
                    borderRadius: 12,
                    height: 420,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <div
                    ref={chartContainerRef}
                    style={{
                      height: 340,
                      overflowY: chartIsHorizontal ? "auto" : "hidden",
                      padding: "0 16px",
                    }}
                  >
                    {!containerReady ? (
                      <div style={{ textAlign: "center", paddingTop: 40 }}>
                        <Spin />
                      </div>
                    ) : chartMode === "total" ? (
                      chartIsHorizontal ? (
                        <div style={{ height: `${chartLimit * 46}px` }}>
                          <Bar
                            ref={chartRef}
                            data={algo === "elo" ? {
                              labels: visiblePlayers.map((p) => p.name),
                              datasets: [{ label: "Elo Rating", data: visiblePlayers.map((p) => Number(p.elo || 0)), backgroundColor: "#1677ff", borderRadius: 6 }]
                            } : chartData}
                            options={chartOptions}
                            onClick={handleBarClick}
                          />
                        </div>
                      ) : needsHorizontalScroll ? (
                        <div style={{ overflowX: "auto", overflowY: "hidden" }}>
                          <div style={{ minWidth: `${chartLimit * 110 + 220}px` }}>
                            <Bar
                              ref={chartRef}
                              data={algo === "elo" ? {
                                labels: visiblePlayers.map((p) => p.name),
                                datasets: [{ label: "Elo Rating", data: visiblePlayers.map((p) => Number(p.elo || 0)), backgroundColor: "#1677ff", borderRadius: 6 }]
                              } : chartData}
                              options={chartOptions}
                              onClick={handleBarClick}
                            />
                          </div>
                        </div>
                      ) : (
                        <Bar
                          ref={chartRef}
                          data={algo === "elo" ? {
                            labels: visiblePlayers.map((p) => p.name),
                            datasets: [{ label: "Elo Rating", data: visiblePlayers.map((p) => Number(p.elo || 0)), backgroundColor: "#1677ff", borderRadius: 6 }]
                          } : chartData}
                          options={chartOptions}
                          onClick={handleBarClick}
                        />
                      )
                    ) : chartMode === "surface" ? (
                      surfaceLoading ? (
                        <div style={{ textAlign: "center", paddingTop: 40 }}>
                          <Spin />
                        </div>
                      ) : (
                        <Line
                          data={{
                            labels: ["Hard", "Clay", "Grass", "Carpet"],
                            datasets: rows.slice(0, Math.min(chartLimit, 8)).map((p, idx) => {
                              const colors = ["#1677ff", "#fa541c", "#52c41a", "#722ed1", "#13c2c2", "#eb2f96", "#a0d911", "#2f54eb"];
                              const getRate = (list, name) => {
                                const hit = list.find((r) => r.name === name);
                                return hit ? Number((hit.winRate || 0) * 100).toFixed(1) : 0;
                              };
                              return {
                                label: p.name,
                                data: [
                                  getRate(surfaceData.Hard, p.name),
                                  getRate(surfaceData.Clay, p.name),
                                  getRate(surfaceData.Grass, p.name),
                                  getRate(surfaceData.Carpet, p.name),
                                ],
                                borderColor: colors[idx % colors.length],
                                backgroundColor: colors[idx % colors.length],
                                tension: 0.3,
                                pointRadius: 3,
                              };
                            }),
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: "top" } },
                            scales: {
                              y: { beginAtZero: true, suggestedMax: 100 },
                            },
                          }}
                        />
                      )
                    ) : chartMode === "levels" ? (
                      levelsLoading ? (
                        <div style={{ textAlign: "center", paddingTop: 40 }}>
                          <Spin />
                        </div>
                      ) : (
                        <Bar
                          data={(function () {
                            const surfaces = ["Hard", "Clay", "Grass", "Carpet"];
                            const levelSet = new Set();
                            surfaces.forEach((s) => (levelsData[s] || []).forEach((d) => levelSet.add(d.level)));
                            const levels = Array.from(levelSet);
                            const colors = ["#1677ff", "#fa541c", "#52c41a", "#722ed1", "#13c2c2", "#eb2f96", "#a0d911", "#2f54eb"];
                            return {
                              labels: surfaces,
                              datasets: levels.map((lvl, i) => ({
                                label: lvl,
                                data: surfaces.map((s) => {
                                  const hit = (levelsData[s] || []).find((d) => d.level === lvl);
                                  return hit ? hit.matches : 0;
                                }),
                                backgroundColor: colors[i % colors.length],
                                borderRadius: 4,
                              })),
                            };
                          })()}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: "top" } },
                            scales: {
                              x: { stacked: true, ticks: { color: "#333" } },
                              y: { stacked: true, beginAtZero: true, ticks: { color: "#333" } },
                            },
                          }}
                        />
                      )
                    ) : yearlyLoading ? (
                      <div style={{ textAlign: "center", paddingTop: 40 }}>
                        <Spin />
                      </div>
                    ) : (
                      <Line data={yearlyChartData} options={yearlyChartOptions} />
                    )}
                  </div>
                </Card>
              </SectionMotion>
            </>
          )}
        </Spin>
      </Card>
    </PageMotion>
  );
}
