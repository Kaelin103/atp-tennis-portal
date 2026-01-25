import React, { useState } from "react";
import { Card, Form, Input, Button, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageContainer } from "../components/NavBar";

const { Title } = Typography;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onFinish(values) {
    try {
      setLoading(true);
      await register(values.name, values.email, values.password);
      message.success("Registration successful!");
      navigate("/");
    } catch (e) {
      message.error(e?.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Card style={{ width: 480 }}>
          <Title level={3} style={{ textAlign: "center" }}>Create an account</Title>
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
              <Input placeholder="Your name" />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
              <Input placeholder="email@example.com" />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
              <Input.Password placeholder="At least 6 characters" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Register
            </Button>
          </Form>
        </Card>
      </div>
    </PageContainer>
  );
}
