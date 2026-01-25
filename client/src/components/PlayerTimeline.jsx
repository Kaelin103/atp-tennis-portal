import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { Card, Spin, Typography } from "antd";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import api from "../api/axios";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const { Text } = Typography;

export default function PlayerTimeline({ playerId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    const fetchTimeline = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/players/${playerId}/metrics/timeline`);
        setData(res.data);
      } catch (err) {
        console.error("Failed to fetch timeline:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [playerId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>;
  if (!data || !data.timeline || data.timeline.length === 0) return null;

  const timeline = data.timeline;
  
  // Calculate Elo Min/Max for normalization
  const eloValues = timeline.map(t => t.rankPoints).filter(v => v !== null);
  const minElo = eloValues.length ? Math.min(...eloValues) : 0;
  const maxElo = eloValues.length ? Math.max(...eloValues) : 100;
  const eloRange = maxElo - minElo || 1; // Avoid divide by zero

  const chartData = {
    labels: timeline.map(t => t.year),
    datasets: [
      {
        label: "Win Rate",
        data: timeline.map(t => t.winRate),
        borderColor: "rgb(53, 162, 235)",
        backgroundColor: "rgba(53, 162, 235, 0.5)",
        yAxisID: 'y',
        tension: 0.3,
        pointRadius: 3,
      },
      {
        label: "Weighted (Decayed)",
        data: timeline.map(t => t.weighted),
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
        yAxisID: 'y',
        tension: 0.3,
        pointRadius: 3,
      },
      {
        label: "Rank Points (Normalized)",
        data: timeline.map(t => t.rankPoints === null ? null : (t.rankPoints - minElo) / eloRange),
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.5)",
        yAxisID: 'y',
        tension: 0.3,
        borderDash: [5, 5],
        pointRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    stacked: false,
    plugins: {
      title: {
        display: false,
      },
      legend: {
          labels: {
              color: '#fff'
          }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
                label += ': ';
            }
            if (context.dataset.label.includes("Rank Points") || context.dataset.label.includes("Elo")) {
                const rawElo = timeline[context.dataIndex].rankPoints;
                const displayVal = context.raw !== null ? context.raw.toFixed(2) : "N/A";
                return `${label}${displayVal} (Raw Points: ${rawElo})`;
            }
            if (context.parsed.y !== null) {
                label += context.parsed.y.toFixed(3);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        min: 0,
        max: 1.1, // slightly above 1 for tooltip space
        grid: {
            color: '#30363d'
        },
        ticks: {
            color: '#rgba(255,255,255,0.7)'
        }
      },
      x: {
          grid: {
              color: '#30363d'
          },
          ticks: {
              color: 'rgba(255,255,255,0.7)'
          }
      }
    },
  };

  return (
    <Card 
        title={<span style={{color: '#fff'}}>Trends (Yearly)</span>}
        style={{ marginTop: 24, backgroundColor: '#161b22', border: '1px solid #30363d' }}
        styles={{ 
            header: { borderBottom: '1px solid #30363d' }
        }}
    >
        <div style={{ height: 350 }}>
            <Line options={options} data={chartData} />
        </div>
        <div style={{ marginTop: 10, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            Rank Points (Strength Proxy) are normalized to 0-1 range. Raw Min: {minElo}, Max: {maxElo}.
        </div>
    </Card>
  );
}
