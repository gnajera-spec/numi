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
import { MisPendientesPage } from "./pages/MisPendientesPage";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminReportsPage } from "./pages/admin/AdminReportsPage";
import { AdminLicenciasPage } from "./pages/admin/AdminLicenciasPage";
import { AdminComunicacionesPage } from "./pages/admin/AdminComunicacionesPage";
import { AdminRecibosPage } from "./pages/admin/AdminRecibosPage";
import { AdminUsuariosPage } from "./pages/admin/AdminUsuariosPage";
import { AdminOrganizacionPage } from "./pages/admin/AdminOrganizacionPage";
import { AdminMedicoFichasPage } from "./pages/admin/AdminMedicoFichasPage";
import { AdminMedicoAccidentesPage } from "./pages/admin/AdminMedicoAccidentesPage";
import { AdminMedicoReportesPage } from "./pages/admin/AdminMedicoReportesPage";
import { MedicoLicenciasPage } from "./pages/employee/medico/MedicoLicenciasPage";
import { MedicoFichasPage } from "./pages/employee/medico/MedicoFichasPage";
import { MedicoAccidentesPage } from "./pages/employee/medico/MedicoAccidentesPage";
import { MedicoReportesPage } from "./pages/employee/medico/MedicoReportesPage";
import { AdminTiposLicenciasPage } from "./pages/admin/AdminTiposLicenciasPage";
import { AdminSmtpConfigPage } from "./pages/admin/AdminSmtpConfigPage";
import { AdminAprobacionesConfigPage } from "./pages/admin/AdminAprobacionesConfigPage";
import { FlujoDiseñadorPage } from "./pages/admin/FlujoDiseñadorPage";
import { AdminConfiguracionPage } from "./pages/admin/AdminConfiguracionPage";
import { AdminCalendarioPage } from "./pages/admin/AdminCalendarioPage";
import { SuperAdminLoginPage } from "./pages/superadmin/SuperAdminLoginPage";
import { SuperAdminTenantsPage } from "./pages/superadmin/SuperAdminTenantsPage";
import { SuperAdminSmtpPage } from "./pages/superadmin/SuperAdminSmtpPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { useAuth } from "./contexts/AuthContext";

const ADMIN_ROLES = ["rrhh", "admin_empresa", "servicio_medico"];

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

function SuperAdminApp() {
  return (
    <SuperAdminProtectedRoute>
      <Routes>
        <Route path="tenants" element={<SuperAdminTenantsPage />} />
        <Route path="smtp" element={<SuperAdminSmtpPage />} />
        <Route path="*" element={<Navigate to="tenants" replace />} />
      </Routes>
    </SuperAdminProtectedRoute>
  );
}

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

function MedicoProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--color-surface-app)" }}>
        <Spinner />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/employee/login" replace />;
  const roles = user?.roles?.length ? user.roles : [user?.role ?? ""];
  if (!roles.includes("servicio_medico")) return <Navigate to="/employee/dashboard" replace />;
  return <>{children}</>;
}

function MedicoApp() {
  return (
    <MedicoProtectedRoute>
      <Routes>
        <Route path="licencias" element={<MedicoLicenciasPage />} />
        <Route path="fichas" element={<MedicoFichasPage />} />
        <Route path="accidentes" element={<MedicoAccidentesPage />} />
        <Route path="reportes" element={<MedicoReportesPage />} />
        <Route path="*" element={<Navigate to="licencias" replace />} />
      </Routes>
    </MedicoProtectedRoute>
  );
}

function EmployeeApp() {
  return (
    <ProtectedRoute>
      <Layout>
        <Routes>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="leaves" element={<LeavesPage />} />
          <Route path="pendientes" element={<MisPendientesPage />} />
          <Route path="communications" element={<CommunicationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </Layout>
    </ProtectedRoute>
  );
}

function AdminAppInner() {
  const { user } = useAuth();
  const defaultRoute =
    user?.role === "servicio_medico" ? "medico/fichas" :
    user?.role === "admin_empresa"   ? "usuarios" :
    "dashboard";
  return (
    <Routes>
      <Route path="dashboard" element={<AdminDashboardPage />} />
      <Route path="licencias" element={<AdminLicenciasPage />} />
      <Route path="comunicaciones" element={<AdminComunicacionesPage />} />
      <Route path="recibos" element={<AdminRecibosPage />} />
      <Route path="usuarios" element={<AdminUsuariosPage />} />
      <Route path="organizacion" element={<AdminOrganizacionPage />} />
      <Route path="medico/fichas" element={<AdminMedicoFichasPage />} />
      <Route path="medico/accidentes" element={<AdminMedicoAccidentesPage />} />
      <Route path="medico/reportes" element={<AdminMedicoReportesPage />} />
      <Route path="reports" element={<AdminReportsPage />} />
      <Route path="configuracion" element={<AdminConfiguracionPage />} />
      <Route path="tipos-licencias" element={<AdminTiposLicenciasPage />} />
      <Route path="configuracion/smtp" element={<AdminSmtpConfigPage />} />
      <Route path="configuracion/aprobaciones" element={<AdminAprobacionesConfigPage />} />
      <Route path="configuracion/aprobaciones/nuevo" element={<FlujoDiseñadorPage />} />
      <Route path="configuracion/aprobaciones/:flujoId" element={<FlujoDiseñadorPage />} />
      <Route path="calendario" element={<AdminCalendarioPage />} />
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/employee/login" element={<LoginPage />} />
          <Route path="/employee/activate" element={<ActivatePage />} />
          <Route path="/employee/medico/*" element={<MedicoApp />} />
          <Route path="/employee/*" element={<EmployeeApp />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
          <Route path="/superadmin/*" element={<SuperAdminApp />} />
          <Route path="/onboarding/:token" element={<OnboardingPage />} />
          <Route path="*" element={<Navigate to="/employee/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
