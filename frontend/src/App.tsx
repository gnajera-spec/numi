import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/Spinner";
import { LoginPage } from "./pages/LoginPage";
import { ActivatePage } from "./pages/ActivatePage";
import { DashboardPage } from "./pages/DashboardPage";
import { ReceiptsPage } from "./pages/ReceiptsPage";
import { LeavesPage } from "./pages/LeavesPage";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminReportsPage } from "./pages/admin/AdminReportsPage";
import { AdminLicenciasPage } from "./pages/admin/AdminLicenciasPage";
import { AdminComunicacionesPage } from "./pages/admin/AdminComunicacionesPage";
import { AdminRecibosPage } from "./pages/admin/AdminRecibosPage";
import { AdminUsuariosPage } from "./pages/admin/AdminUsuariosPage";
import { useAuth } from "./contexts/AuthContext";

const ADMIN_ROLES = ["rrhh", "admin_empresa", "super_admin"];

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--color-surface-app)" }}>
        <Spinner />
      </div>
    );
  }
  if (!isAuthenticated || !user || !ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

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

function AdminApp() {
  return (
    <AdminProtectedRoute>
      <Routes>
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="licencias" element={<AdminLicenciasPage />} />
        <Route path="comunicaciones" element={<AdminComunicacionesPage />} />
        <Route path="recibos" element={<AdminRecibosPage />} />
        <Route path="usuarios" element={<AdminUsuariosPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AdminProtectedRoute>
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
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to="/employee/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
