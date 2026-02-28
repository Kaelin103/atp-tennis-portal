import React, { useState } from "react";
import { Card, Typography, Select, Button, Space, message, Row, Col, Statistic, Progress } from "antd";
import { SwapOutlined, TrophyOutlined } from "@ant-design/icons";
import { searchPlayers, predictMatch } from "../api";

const { Title, Text } = Typography;

export default function PredictPage() {
  const [loading, setLoading] = useState(false);

  const [optionsA, setOptionsA] = useState([]);
  const [optionsB, setOptionsB] = useState([]);

  const [playerA, setPlayerA] = useState(null); // {value, label}
  const [playerB, setPlayerB] = useState(null);

  const [result, setResult] = useState(null);
  
  const searchTimerA = React.useRef(null);
  const searchTimerB = React.useRef(null);

  const upsertOption = (setOptions, opt) => {
    setOptions(prev => {
      if (!opt) return prev;
      const exists = prev.some(x => x.value === opt.value);
      return exists ? prev : [opt, ...prev];
    });
  };

  const doSearch = async (q, setOpts) => {
    const s = (q || "").trim();
    if (!s) { 
      setOpts([]); 
      return; 
    }

    try {
      const res = await searchPlayers(s); 
      // API returns axios response, payload is inside res.data
      const items = res.data?.items || [];
      const opts = items.map(p => ({
        // Backend returns "id", but user mentioned "_id", supporting both defensively
        value: p.id || p._id,
        // Backend returns "name", but supporting firstName/lastName defensively
        label: `${p.name || (p.firstName ? `${p.firstName} ${p.lastName}` : "Unknown")} (Rank: ${p.rank ?? "?"}, Decay: ${p.decay != null ? p.decay.toFixed(2) : (p.decay_score != null ? p.decay_score.toFixed(2) : "?")})`,
      }));
      setOpts(opts);
    } catch (err) {
      console.error("Search error:", err);
      setOpts([]);
    }
  };

  const handleSwap = () => {
    const nextA = playerB;
    const nextB = playerA;
    
    setPlayerA(nextA);
    setPlayerB(nextB);

    if (nextA) upsertOption(setOptionsA, nextA);
    if (nextB) upsertOption(setOptionsB, nextB);
    
    setResult(null);
  };

  const handlePredict = async () => {
    try {
      const playerAId = playerA?.value;
      const playerBId = playerB?.value;
  
      console.log("▶ handlePredict start", { playerA, playerB });
      console.log("▶ extracted ids", { playerAId, playerBId });
  
      // ✅ Strong validation
      if (!playerAId || !playerBId) {
        message.error("Please select both players from the dropdown.");
        return;
      }
      
      if (playerAId === playerBId) {
        message.error("Player A and Player B cannot be the same.");
        return;
      }
      
      setLoading(true);
      setResult(null);

      const res = await predictMatch({ playerAId, playerBId });
      console.log("✅ predict response", res);
  
      setResult(res.data);
    } catch (err) {
      console.error("❌ predict error", err);
      message.error(err?.response?.data?.message || "Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 980,
        margin: "40px auto",
        padding: "0 16px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <Title level={2} style={{ color: "#fff", margin: 0 }}>
          🎾 Match Prediction
        </Title>
        <Text style={{ color: "rgba(255,255,255,0.65)" }}>
          Time-aware Logistic Regression Model
        </Text>
      </div>

      <Card
        style={{
          borderRadius: 16,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          background: "#fff",
        }}
        bodyStyle={{ padding: "32px 24px" }}
      >
        <Row gutter={[16, 16]} align="middle" justify="center">
          {/* Player A Input */}
          <Col xs={24} md={10}>
            <div style={{ marginBottom: 8 }}>
              <Text strong style={{ fontSize: 16, color: "#1890ff" }}>
                Player A
              </Text>
            </div>
            <Select
              showSearch
              filterOption={false}
              labelInValue
              value={playerA}
              options={optionsA}
              placeholder="Search Player A (e.g. Sinner)"
              style={{ width: "100%", height: 40 }}
              notFoundContent={null}
              allowClear
              onSearch={(q) => {
                if (searchTimerA.current) clearTimeout(searchTimerA.current);
                searchTimerA.current = setTimeout(() => doSearch(q, setOptionsA), 250);
              }}
              onChange={(val) => {
                setPlayerA(val);
                upsertOption(setOptionsA, val);
              }}
              onClear={() => setPlayerA(null)}
            />
          </Col>

          {/* Swap Button */}
          <Col xs={24} md={4} style={{ textAlign: "center" }}>
            <Button
              shape="circle"
              icon={<SwapOutlined />}
              onClick={handleSwap}
              size="large"
              style={{ marginTop: 24 }}
            />
          </Col>

          {/* Player B Input */}
          <Col xs={24} md={10}>
            <div style={{ marginBottom: 8 }}>
              <Text strong style={{ fontSize: 16, color: "#ff4d4f" }}>
                Player B
              </Text>
            </div>
            <Select
              showSearch
              filterOption={false}
              labelInValue
              value={playerB}
              options={optionsB}
              placeholder="Search Player B (e.g. Alcaraz)"
              style={{ width: "100%", height: 40 }}
              notFoundContent={null}
              allowClear
              onSearch={(q) => {
                if (searchTimerB.current) clearTimeout(searchTimerB.current);
                searchTimerB.current = setTimeout(() => doSearch(q, setOptionsB), 250);
              }}
              onChange={(val) => {
                setPlayerB(val);
                upsertOption(setOptionsB, val);
              }}
              onClear={() => setPlayerB(null)}
            />
          </Col>
        </Row>

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Button
            type="primary"
            loading={loading}
            onClick={() => {
              console.log("✅ Predict button clicked");
              handlePredict?.();
            }}
            size="large"
            style={{
              width: 200,
              height: 50,
              borderRadius: 25,
              fontSize: 18,
              fontWeight: "bold",
              boxShadow: "0 4px 12px rgba(24, 144, 255, 0.4)",
            }}
          >
            Predict Winner
          </Button>
        </div>
      </Card>

      {/* Result Section */}
      {result && (
        <Card
          style={{
            marginTop: 24,
            borderRadius: 16,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            background: "#fff",
            overflow: "hidden",
          }}
          bodyStyle={{ padding: 0 }}
        >
          {/* Result Header */}
          <div
            style={{
              background: "#fafafa",
              padding: "16px 24px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text strong style={{ fontSize: 16 }}>
              Prediction Result
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Model: {result.model}
            </Text>
          </div>

          <div style={{ padding: "32px 24px" }}>
            <Row gutter={[24, 24]} align="middle">
              {/* Player A Stats */}
              <Col span={8} style={{ textAlign: "center" }}>
                <Text
                  strong
                  style={{
                    fontSize: 18,
                    color:
                      result.probability.pAWin > 0.5 ? "#1890ff" : "#000",
                  }}
                >
                  {result.playerA.name}
                </Text>
                <div style={{ marginTop: 8 }}>
                  <Statistic
                    value={result.probability.pAWin * 100}
                    precision={1}
                    valueStyle={{
                      color:
                        result.probability.pAWin > 0.5 ? "#1890ff" : "#cf1322",
                      fontWeight: "bold",
                    }}
                    suffix="%"
                  />
                </div>
                {result.probability.pAWin > 0.5 && (
                  <div style={{ color: "#1890ff", marginTop: 4 }}>
                    <TrophyOutlined /> WINNER
                  </div>
                )}
              </Col>

              {/* VS / Progress Bar */}
              <Col span={8}>
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    WIN PROBABILITY
                  </Text>
                </div>
                <Progress
                  percent={result.probability.pAWin * 100}
                  showInfo={false}
                  strokeColor="#1890ff"
                  trailColor="#ff4d4f"
                  size={["100%", 12]}
                  style={{ marginBottom: 16 }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: "#888",
                  }}
                >
                  <span>Features Analysis:</span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#555",
                    background: "#f5f5f5",
                    padding: 8,
                    borderRadius: 8,
                    marginTop: 4,
                  }}
                >
                  <div>Δ Rank: {result.features.dRank}</div>
                  <div>Δ Decay: {result.features.dDecay?.toFixed(3)}</div>
                </div>
              </Col>

              {/* Player B Stats */}
              <Col span={8} style={{ textAlign: "center" }}>
                <Text
                  strong
                  style={{
                    fontSize: 18,
                    color:
                      result.probability.pBWin > 0.5 ? "#ff4d4f" : "#000",
                  }}
                >
                  {result.playerB.name}
                </Text>
                <div style={{ marginTop: 8 }}>
                  <Statistic
                    value={result.probability.pBWin * 100}
                    precision={1}
                    valueStyle={{
                      color:
                        result.probability.pBWin > 0.5 ? "#ff4d4f" : "#3f8600",
                      fontWeight: "bold",
                    }}
                    suffix="%"
                  />
                </div>
                {result.probability.pBWin > 0.5 && (
                  <div style={{ color: "#ff4d4f", marginTop: 4 }}>
                    <TrophyOutlined /> WINNER
                  </div>
                )}
              </Col>
            </Row>
          </div>
        </Card>
      )}
    </div>
  );
}
