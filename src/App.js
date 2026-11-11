import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

import PersonsPage from "./pages/PersonsPage";
import UnknownPersonsPage from "./pages/UnknownPersonsPage";
import CamerasPage from "./pages/CamerasPage";
import RecognitionPage from "./pages/RecognitionPage";
import HistoryPage from "./pages/HistoryPage";
import SessionsPage from "./pages/SessionsPage";
import TelegramPage from "./pages/TelegramPage";
import SettingsPage from "./pages/SettingsPage";
import UsersPage from "./pages/UsersPage";
import LiveMonitoringPage from "./pages/LiveMonitoringPage";
import ProtectedRoute from "./components/common/ProtectedRoute";
import { useAuth } from "./contexts/AuthContext";

function AppRoutes() {
  const { isAuthenticated, initializing } = useAuth();

  if (initializing) {
    return null;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage />
            )
          }
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/persons" element={<PersonsPage />} />
            <Route path="/unknown" element={<UnknownPersonsPage />} />
            <Route path="/recognition" element={<RecognitionPage />} />
            <Route path="/cameras" element={<CamerasPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/telegram" element={<TelegramPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/live-monitoring" element={<LiveMonitoringPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return <AppRoutes />;
}
