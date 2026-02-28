import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import MatchExplorer from "./pages/MatchExplorer.jsx";
import HeadToHeadList from "./pages/HeadToHeadList.jsx";
import HeadToHeadDetail from "./pages/HeadToHeadDetail.jsx";
import HeadToHeadTop from "./pages/HeadToHeadTop.jsx";
import SurfaceStats from "./pages/SurfaceStats.jsx";
import PlayerList from "./pages/PlayerList.jsx";
import PlayerDetail from "./pages/PlayerDetail.jsx";
import Rankings from "./pages/Rankings.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import AdminFollows from "./pages/AdminFollows.jsx";
import PredictPage from "./pages/PredictPage.jsx";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/predict" element={<PredictPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/match" element={<MatchExplorer />} />
      <Route path="/headtohead" element={<HeadToHeadList />} />
      <Route path="/headtohead/top" element={<HeadToHeadTop />} />
      <Route path="/headtohead/detail/:pair" element={<HeadToHeadDetail />} />
      <Route path="/surfacestats" element={<SurfaceStats />} />
      <Route path="/players" element={<PlayerList />} />
      <Route path="/player/:name" element={<PlayerDetail />} />
      <Route path="/players/:name" element={<PlayerDetail />} />
      <Route path="/rankings" element={<Rankings />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/users" element={<AdminUsers />} />
      <Route path="/admin/follows" element={<AdminFollows />} />
      <Route
        path="*"
        element={
          <div
            style={{
              color: "white",
              textAlign: "center",
              marginTop: 100,
              fontSize: 18,
            }}
          >
            404 | Page Not Found
          </div>
        }
      />
    </Routes>
  );
}
