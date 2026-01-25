import React, { useEffect, useState } from "react";
import { Table, Card, Typography, Spin, Modal, List, Tag, Empty, Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const { Title, Text } = Typography;

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [follows, setFollows] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await api.get("/admin/users");
        setUsers(res.data.users || []);
      } catch (err) {
        console.error("❌ Failed to fetch users:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const openFollowModal = (user) => {
    setSelectedUser(user);
    setModalVisible(true);
    setModalLoading(true);
    // Use the followedPlayers field returned by /admin/users directly
    const names = Array.isArray(user.followedPlayers) ? user.followedPlayers : [];
    setFollows(names.map((name) => ({ playerName: name })));
    setModalLoading(false);
  };

  const columns = [
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: "Role", dataIndex: "role", key: "role" },
    {
      title: "Follow Count",
      dataIndex: "followCount",
      key: "followCount",
      render: (count, user) => (
        <a onClick={() => openFollowModal(user)} style={{ color: "#4FC3F7" }}>
          {count}
        </a>
      ),
    },
    {
      title: "Followed Players",
      key: "followedPlayers",
      render: (_, user) => {
        const names = Array.isArray(user.followedPlayers)
          ? user.followedPlayers.filter((n) => typeof n === "string" && n.trim().length > 0)
          : [];
        const followCount = Number(user.followCount || 0);
        const preview = names.slice(0, 5);
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {preview.map((n, i) => (
              <Tag key={`${user.id}-tag-${i}`} color="geekblue">{n}</Tag>
            ))}
            {names.length > 5 && <Tag color="purple">+{names.length - 5}</Tag>}
            {followCount > names.length && (
              <Tag color="purple">+{followCount - names.length}</Tag>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ backgroundColor: "#0d1117", minHeight: "100vh", padding: "60px 40px" }}>
      <Card
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          borderRadius: 12,
          background: "linear-gradient(145deg, #1a1f25, #11151a)",
          boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
          color: "#fff",
        }}
      >
        <Title level={3} style={{ color: "#fff", textAlign: "center", marginBottom: 20 }}>
          👥 All Users
        </Title>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={users.map((u) => ({ key: u.id || u._id, ...u }))}
            pagination={{ pageSize: 10 }}
          />
        </Spin>
      </Card>

      <Modal
        title={
          <span style={{ color: "#fff" }}>
            {selectedUser ? `${selectedUser.name}'s Follow List` : "Follow List"}
          </span>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
        styles={{
          body: {
            backgroundColor: "#0d1117",
            color: "#fff",
            borderRadius: 8,
            padding: 24,
          },
        }}
      >
        <Spin spinning={modalLoading}>
          {Array.isArray(follows) && follows.length > 0 ? (
            <List
              itemLayout="horizontal"
              dataSource={follows}
              renderItem={(item) => (
                <List.Item
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    padding: "10px 0",
                  }}
                >
                  <List.Item.Meta
                    title={<span style={{ color: "#fff", fontWeight: 600 }}>{item.playerName}</span>}
                    description={<Text style={{ color: "#aaa" }}>Followed Player</Text>}
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="No followed players found" style={{ color: "#fff" }} />
          )}
        </Spin>
      </Modal>
    </div>
  );
}
