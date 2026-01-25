import React, { useEffect, useState } from "react";
import { Card, Typography, Table, Input, Select, Spin, message, Button, Empty } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const { Title, Text } = Typography;

export default function AdminFollows() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState("all");
  const [q, setQ] = useState("");

  const pageSize = 50;

  const fetchLogs = async (p = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("page", String(p));
      if (q.trim()) params.set("q", q.trim());
      if (action !== "all") params.set("action", action);
      const res = await api.get(`/admin/follows/logs?${params.toString()}`);
      const data = res.data || {};
      setRows(Array.isArray(data.logs) ? data.logs : []);
      setTotal(Number(data.total || 0));
    } catch (err) {
      console.error("❌ Failed to fetch follow logs:", err);
      message.error("Failed to load follow logs. Please try again.");
      if (err.response?.status === 403) {
        navigate("/admin/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const columns = [
    { title: "Time", dataIndex: "time", key: "time", render: (t) => new Date(t).toLocaleString(), width: 200 },
    { title: "Action", dataIndex: "action", key: "action", width: 120 },
    { title: "User", dataIndex: "userName", key: "user", width: 180 },
    { title: "Player", dataIndex: "playerName", key: "player" },
    { title: "Country", dataIndex: "country", key: "country", width: 120 },
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
          <Title level={3} style={{ margin: 0 }}>🧾 Follow Records</Title>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              placeholder="Search player name..."
              allowClear
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onPressEnter={() => { setPage(1); fetchLogs(1); }}
              style={{ width: 260 }}
            />
            <Select
              value={action}
              onChange={(v) => { setAction(v); setPage(1); fetchLogs(1); }}
              options={[
                { label: "All", value: "all" },
                { label: "Follow", value: "follow" },
                { label: "Unfollow", value: "unfollow" },
              ]}
              style={{ width: 140 }}
            />
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>
        </div>

        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
  Complete follow/unfollow audit logs in reverse chronological order.
        </Text>

        <Spin spinning={loading}>
          {!loading && rows.length === 0 ? (
            <Empty description="No follow/unfollow logs found" />
          ) : (
            <Table
              rowKey={(r) => r.id}
              columns={columns}
              dataSource={rows}
              pagination={{
                current: page,
                pageSize,
                total,
                onChange: (p) => setPage(p),
                showTotal: (t) => `${t.toLocaleString()} records`,
              }}
              bordered
            />
          )}
        </Spin>
      </Card>
    </div>
  );
}