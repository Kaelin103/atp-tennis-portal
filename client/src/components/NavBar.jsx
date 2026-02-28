// src/components/NavBar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dropdown, Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useAuth } from "../context/AuthContext.jsx";

const NAV_HEIGHT = 64;

export default function NavBar() {
  const auth = useAuth();
  const user = auth?.user || null;
  const logout = auth?.logout || (() => {});
  const navigate = useNavigate();

  
  const menuItems = [
    {
      key: "profile",
      label: "Profile",
      onClick: () => navigate("/profile"),
    },
    {
      key: "logout",
      label: "Logout",
      onClick: () => {
        logout();
        navigate("/");
      },
    },
  ];

  return (
    <div
      style={{
        height: NAV_HEIGHT,
        width: "100%",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 1000,
        background: "#001529",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
      }}
    >
      {/* Global Back button */}
      <div style={{ marginRight: 12 }}>
        <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      <div style={{ color: "#fff", fontWeight: 700, marginRight: 24 }}>
        <Link to="/" style={{ color: "#fff" }}>
          🎾 ATP Tennis Portal
        </Link>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <Link to="/" style={{ color: "#fff" }}>
          Home
        </Link>
        <Link to="/rankings" style={{ color: "#fff" }}>
          Rankings
        </Link>
        <Link to="/headtohead/top" style={{ color: "#fff" }}>
          Head-to-Head
        </Link>
        <Link to="/surfacestats" style={{ color: "#fff" }}>
          Surface Stats
        </Link>
        <Link to="/predict" style={{ color: "#fff" }}>
          Prediction
        </Link>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
        {user ? (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: (info) => {
                const clicked = menuItems.find((item) => item.key === info.key);
                if (clicked?.onClick) clicked.onClick();
              },
            }}
            placement="bottomRight"
            trigger={["click"]}
          >
            <Button type="primary">{user.name}</Button>
          </Dropdown>
        ) : (
          <>
            <Button onClick={() => navigate("/login")}>Login</Button>
            <Button type="primary" onClick={() => navigate("/register")}>
              Register
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export const PageContainer = ({ children }) => (
  <div style={{ paddingTop: NAV_HEIGHT + 16, paddingBottom: 32 }}>{children}</div>
);
