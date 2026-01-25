import React from "react";
import { Layout } from "antd";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./router";
import NavBar from "./components/NavBar";
import { AuthProvider } from "./context/AuthContext"; 

const { Content } = Layout;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout
          style={{
            minHeight: "100vh",
            width: "100vw",
            overflowX: "hidden",
            backgroundColor: "#0d1117",
          }}
        >
          <NavBar />
          <Content
            style={{
              marginTop: 64,
              width: "100%",
              minHeight: "calc(100vh - 64px)",
              padding: "24px 0",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div style={{ width: "100%" }}>
              <AppRouter />
            </div>
          </Content>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}
