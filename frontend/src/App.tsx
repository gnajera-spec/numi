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
import { AdminTiposLicenciasPage } from "./pages/admin/AdminTiposLicenciasPage";
import { AdminComunicacionesPage } from "./pages/admin/AdminComunicacionesPage";
import { AdminRecibosPage } from "./pages/admin/AdminRecibosPage";
import { AdminUsuariosPage } from "./pages/admin/AdminUsuariosPage";
import { AdminOrganizacionPage } from "./pages/admin/AdminOrganizacionPage";
import { AdminMedicoFichasPage } from "./pages/admin/AdminMedicoFichasPage";
import { AdminMedicoAccidentesPage } from "./pages/admin/AdminMedicoAccidentesPage";
import { AdminMedicoReportesPage } from "./pages/admin/AdminMedicoReportesPage";
import { SuperAdminLoginPage } from "./pages/superadmin/SuperAdminLoginPage";
import { SuperAdminTenantsPage } from "./pages/superadmin/SuperAdminTenantsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { AdminSmtpConfigPage } from "./pages/admin/AdminSmtpConfigPage";
import { AdminColaboradoresPage } from "./pages/admin/AdminColaboradoresPage";
import { AdminColaboradorDetailPage } from "./pages/admin/AdminColaboradorDetailPage";
import { useAuth } from "./contexts/AuthContext";

const ADMIN_ROLES = ["rrhh", "admin_empresa", "super_admin", "servicio_medico"];

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


function RoleGuardRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.role)) {
    const fallback =
      user?.role === "servicio_medico" ? "/admin/medico/fichas" :
      user?.role === "admin_empresa"   ? "/admin/organizacion"  :
      "/admin/dashboard";
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

function AdminAppInner() {
  const { user } = useAuth();
  const defaultRoute = user?.role === "servicio_medico" ? "/admin/medico/fichas" : user?.role === "admin_empresa" ? "/admin/organizacion" : "/admin/dashboard";
  return (
    <Routes>
      <Route
        path="dashboard"
        element={
          <RoleGuardRoute allowedRoles={["super_admin", "rrhh"]}>
            <AdminDashboardPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="colaboradores"
        element={
          <RoleGuardRoute allowedRoles={["super_admin", "rrhh"]}>
            <AdminColaboradoresPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="colaboradores/:id"
        element={
          <RoleGuardRoute allowedRoles={["super_admin", "rrhh"]}>
            <AdminColaboradorDetailPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="licencias"
        element={
          <RoleGuardRoute allowedRoles={["super_admin", "rrhh"]}>
            <AdminLicenciasPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="comunicaciones"
        element={
          <RoleGuardRoute allowedRoles={["super_admin", "rrhh"]}>
            <AdminComunicacionesPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="recibos"
        element={
          <RoleGuardRoute allowedRoles={["super_admin", "rrhh"]}>
            <AdminRecibosPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="usuarios"
        element={
          <RoleGuardRoute allowedRoles={["admin_empresa", "super_admin"]}>
            <AdminUsuariosPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="organizacion"
        element={
          <RoleGuardRoute allowedRoles={["admin_empresa", "super_admin"]}>
            <AdminOrganizacionPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="tipos-licencias"
        element={
          <RoleGuardRoute allowedRoles={["admin_empresa", "super_admin"]}>
            <AdminTiposLicenciasPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="medico/fichas"
        element={
          <RoleGuardRoute allowedRoles={["super_admin", "servicio_medico"]}>
            <AdminMedicoFichasPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="medico/accidentes"
        element={
          <RoleGuardRoute allowedRoles={["super_admin", "servicio_medico"]}>
            <AdminMedicoAccidentesPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="medico/reportes"
        element={
          <RoleGuardRoute allowedRoles={["super_admin", "servicio_medico"]}>
            <AdminMedicoReportesPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="reports"
        element={
          <RoleGuardRoute allowedRoles={["super_admin", "rrhh"]}>
            <AdminReportsPage />
          </RoleGuardRoute>
        }
      />
      <Route
        path="configuracion/smtp"
        element={
          <RoleGuardRoute allowedRoles={["admin_empresa", "super_admin"]}>
            <AdminSmtpConfigPage />
          </RoleGuardRoute>
        }
      />
      <Route path="*" element={<Navigate to={defaultRoute} replace />} />
    </Routes>
  );
}

function AdminApp() {
  return (
    <AdminProtectedRoute>
      <AdminAppInner />
    </AdminProtectedRoute>
  );
}

function SuperAdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--color-surface-app)" }}>
        <Spinner />
      </div>
    );
  }
  if (!isAuthenticated || user?.role !== "super_admin") {
    return <Navigate to="/superadmin/login" replace />;
  }
  return <>{children}</>;
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
          <Route path="/onboarding/:token" element={<OnboardingPage />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
          <Route path="/superadmin/tenants" element={
            <SuperAdminProtectedRoute><SuperAdminTenantsPage /></SuperAdminProtectedRoute>
          } />
          <Route path="/superadmin/*" element={<Navigate to="/superadmin/tenants" replace />} />
          <Route path="*" element={<Navigate to="/employee/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
