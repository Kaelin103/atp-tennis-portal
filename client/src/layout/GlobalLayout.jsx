import React from "react";
import { Layout } from "antd";
import NavBar from "../components/NavBar";

const { Content } = Layout;

export default function GlobalLayout({ children }) {
  return (
    <Layout
      style={{
        minHeight: "100vh",
        width: "100vw",
        backgroundColor: "#0d1117",
        overflowX: "hidden",
      }}
    >
      <NavBar />
      <Content
        style={{
          marginTop: 64, 
          minHeight: "calc(100vh - 64px)",
          padding: "32px 48px",
          background: "#f5f6fa",
        }}
      >
        {children}
      </Content>
    </Layout>
  );
}
