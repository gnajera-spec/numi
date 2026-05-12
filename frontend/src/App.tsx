import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { ActivatePage } from "./pages/ActivatePage";
import { DashboardPage } from "./pages/DashboardPage";
import { ReceiptsPage } from "./pages/ReceiptsPage";
import { LeavesPage } from "./pages/LeavesPage";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { ProfilePage } from "./pages/ProfilePage";

function EmployeeApp() {
  return (
    <ProtectedRoute>
      <Layout>
        <Routes>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="leaves" element={<LeavesPage />} />
          <Route path="communications" element={<CommunicationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/employee/login" element={<LoginPage />} />
          <Route path="/employee/activate" element={<ActivatePage />} />
          <Route path="/employee/*" element={<EmployeeApp />} />
          <Route path="*" element={<Navigate to="/employee/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
