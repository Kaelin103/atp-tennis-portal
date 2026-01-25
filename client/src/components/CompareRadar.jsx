import React, { useEffect, useState, useRef, useMemo } from "react";
import { Radar } from "react-chartjs-2";
import { Card, Spin, Collapse, Typography, Select, Table } from "antd";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

const { Text } = Typography;

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const PRESETS = [
  { key: "all_time", label: "All-time (No Decay)", params: { weeks: 0, decay: false, lambda: 0.8 } },
  { key: "decay_08", label: "All-time + Decay (λ=0.8)", params: { weeks: 0, decay: true, lambda: 0.8 } },
  { key: "decay_12", label: "All-time + Decay (λ=1.2)", params: { weeks: 0, decay: true, lambda: 1.2 } },
];

export default function CompareRadar({ aName, bName, aPid, bPid, surface = "all" }) {
  const [radar, setRadar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [presetKey, setPresetKey] = useState("all_time");
  const chartRef = useRef(null);

  const preset = useMemo(() => PRESETS.find(p => p.key === presetKey) ?? PRESETS[0], [presetKey]);

  const safeA = (aName || "").trim();
  const safeB = (bName || "").trim();

  useEffect(() => {
    // If using IDs, we can proceed even if names are missing/weird, but ideally we have something.
    if ((!aPid || !bPid) && (!safeA || !safeB)) {
        setRadar(null);
        return;
    }

    const controller = new AbortController();
    const fetchRadar = async () => {
      setLoading(true);
      try {
        const { weeks, decay, lambda } = preset.params;
        
        const qs = new URLSearchParams({
            aId: safeA,
            bId: safeB,
            weeks: String(weeks),
            surface: surface ?? "All",
            decay: String(!!decay),
            lambda: String(lambda),
            bonus: "false",
            minMatches: "0"
        });

        if (aPid && bPid) {
            qs.set("aPid", aPid);
            qs.set("bPid", bPid);
        }

        if (import.meta.env.DEV) {
            qs.set("debug", "true");
        }

        const url = `http://localhost:5000/api/players/compare/radar?${qs.toString()}`;

        const res = await fetch(url, { signal: controller.signal });
        const json = await res.json();
        setRadar(json);
      } catch (err) {
        if (err.name !== "AbortError") console.error("Failed to fetch radar data:", err);
        setRadar(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRadar();
    return () => controller.abort();
  }, [safeA, safeB, aPid, bPid, surface, preset]);

  // 1. 数据标准化处理
  const { chartData, noData, rows } = useMemo(() => {
    if (!radar) return { chartData: null, noData: false, rows: [] };

    const LABELS = radar.labels ?? ["WinRate", "RecentForm", "SurfaceWR", "VsStrong", "Activity", "Weighted"];

    // 辅助：标准化数值数组 (长度6，数值化，补0)
    const normalizeValues = (v) => {
      if (!Array.isArray(v)) return new Array(LABELS.length).fill(0);
      const arr = v.slice(0, LABELS.length);
      while (arr.length < LABELS.length) arr.push(0);
      return arr.map(x => (Number.isFinite(+x) ? +x : 0));
    };

    // 辅助：判断是否有比赛数据
    const getMatches = (p) => {
      // 优先取 meta.matches (如果后端给了)
      if (p && p.meta && Number.isFinite(p.meta.matches)) return p.meta.matches;
      // 否则看 values 是否全 0
      const vals = normalizeValues(p?.values);
      const sum = vals.reduce((s, x) => s + x, 0);
      return sum === 0 ? 0 : 1;
    };

    const aValues = normalizeValues(radar?.a?.values);
    const bValues = normalizeValues(radar?.b?.values);

    // 数值归一化 (x>1 除以100，否则保持)
    const norm = (x) => (x > 1 ? x / 100 : x);

    const aNorm = aValues.map(norm);
    const bNorm = bValues.map(norm);

    const aMatches = getMatches(radar?.a);
    const bMatches = getMatches(radar?.b);
    
    // 如果双方都没有比赛数据，标记 noData
    const isNoData = (aMatches === 0 && bMatches === 0);

    const data = {
      labels: LABELS,
      datasets: [
        {
          label: radar?.a?.name ?? safeA,
          data: aNorm,
          backgroundColor: "rgba(24, 144, 255, 0.2)",
          borderColor: "rgba(24, 144, 255, 1)",
          borderWidth: 2,
          pointBackgroundColor: "rgba(24, 144, 255, 1)",
          fill: true,
        },
        {
          label: radar?.b?.name ?? safeB,
          data: bNorm,
          backgroundColor: "rgba(245, 34, 45, 0.2)",
          borderColor: "rgba(245, 34, 45, 1)",
          borderWidth: 2,
          pointBackgroundColor: "rgba(245, 34, 45, 1)",
          fill: true,
        },
      ],
    };

    const rows = LABELS.map((dim, i) => {
      const aVals = radar?.a?.values ?? [];
      const bVals = radar?.b?.values ?? [];
      const a = Number(aVals[i] ?? 0);
      const b = Number(bVals[i] ?? 0);
      return {
        key: dim,
        dimension: dim,
        a: a.toFixed(3),
        b: b.toFixed(3),
        diff: (a - b).toFixed(3),
      };
    });

    return { chartData: data, noData: isNoData, rows };
  }, [radar, safeA, safeB]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        suggestedMin: 0,
        suggestedMax: 1,
        ticks: {
          backdropColor: "transparent", 
          showLabelBackdrop: false,
        },
        grid: {
          color: "rgba(255, 255, 255, 0.2)",
        },
        angleLines: {
            color: "rgba(255, 255, 255, 0.2)",
        },
        pointLabels: {
            color: "#fff",
            font: {
                size: 12
            }
        }
      },
    },
    plugins: {
        legend: {
            labels: {
                color: "#fff"
            }
        }
    }
  };

  if (noData) {
    return (
      <Card 
        title={<span style={{color: '#fff'}}>Player Comparison Radar</span>} 
        style={{ marginTop: 24, backgroundColor: '#161b22', border: '1px solid #30363d', minHeight: 420 }}
        styles={{ 
          header: { borderBottom: '1px solid #30363d' },
          body: { height: 360 }
        }}
      >
        <div style={{ color: '#fff', opacity: 0.7, textAlign: 'center', paddingTop: 150 }}>
          {preset.params.weeks > 0 
            ? <>No matches found in the selected window ({preset.params.weeks}w).<br/>Try switching to All-time.</>
            : "No matches found (All-time)."
          }
        </div>
      </Card>
    );
  }

  return (
    <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{color: '#fff'}}>Player Comparison Radar</span>
            <Select 
               value={presetKey} 
               onChange={setPresetKey} 
               options={PRESETS.map(p => ({ value: p.key, label: p.label }))} 
               style={{ width: 240 }} 
               size="small"
            />
          </div>
        } 
        style={{ marginTop: 24, backgroundColor: '#161b22', border: '1px solid #30363d', minHeight: 420 }}
        styles={{ 
          header: { borderBottom: '1px solid #30363d' },
          body: { paddingBottom: 24 }
        }}
        loading={loading}
    >
      {radar?.meta?.distance !== undefined && (
        <div style={{ textAlign: 'center', marginBottom: 16, color: '#fff', fontSize: 16 }}>
           Style Distance (L2): <Text strong style={{ color: '#52c41a' }}>{radar.meta.distance}</Text>
        </div>
      )}

      <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 360 }}>
        {chartData ? (
            <Radar 
                ref={chartRef}
                key={`${safeA}__${safeB}__${presetKey}`}
                data={chartData} 
                options={options} 
            />
        ) : (
            <div style={{ color: '#fff', opacity: 0.7, textAlign: 'center', paddingTop: 150 }}>
                Loading...
            </div>
        )}
      </div>

      {chartData && (
        <Table 
           size="small" 
           pagination={false} 
           dataSource={rows} 
           style={{ marginTop: 24 }}
           columns={[ 
             { title: "Dimension", dataIndex: "dimension" }, 
             { title: radar?.a?.name ?? "Player A", dataIndex: "a" }, 
             { title: radar?.b?.name ?? "Player B", dataIndex: "b" }, 
             { title: "Δ (A−B)", dataIndex: "diff" }, 
           ]} 
        />
      )}
      
      {radar?.meta && (
        <Collapse 
          ghost 
          style={{ marginTop: 16, borderTop: '1px solid #30363d' }}
          items={[
            {
              key: '1',
              label: <span style={{color: 'rgba(255,255,255,0.5)'}}>Calculation Parameters</span>,
              children: (
                <div style={{ color: '#fff' }}>
                  <pre style={{ fontSize: 11, background: '#0d1117', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
                    {JSON.stringify(radar.meta, null, 2)}
                  </pre>
                  {radar.components && (
                    <>
                      <Text style={{color: 'rgba(255,255,255,0.7)', marginTop: 8, display: 'block'}}>Components (Debug):</Text>
                      <div style={{ display: 'flex', gap: 16, flexDirection: 'column' }}>
                        <div>
                            <Text strong style={{color: '#1890ff'}}>Player A ({radar.a?.name})</Text>
                            <pre style={{ fontSize: 11, background: '#0d1117', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
                                {JSON.stringify(radar.components.a, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <Text strong style={{color: '#f5222d'}}>Player B ({radar.b?.name})</Text>
                            <pre style={{ fontSize: 11, background: '#0d1117', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
                                {JSON.stringify(radar.components.b, null, 2)}
                            </pre>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            }
          ]}
        />
      )}
    </Card>
  );
}
