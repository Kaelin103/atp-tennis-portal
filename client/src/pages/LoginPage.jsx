import React, { useState } from "react";
import { Card, Form, Input, Button, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageContainer } from "../components/NavBar";

const { Title } = Typography;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onFinish(values) {
    try {
      setLoading(true);
      await login(values.email, values.password);
     
      navigate("/");
    } catch (e) {

      console.error("Login failed:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Card style={{ width: 420 }}>
          <Title level={3} style={{ textAlign: "center" }}>Login</Title>
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
              <Input placeholder="email@example.com" />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true }]}>
              <Input.Password placeholder="Your password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Sign in
            </Button>
          </Form>
        </Card>
      </div>
    </PageContainer>
  );
}
