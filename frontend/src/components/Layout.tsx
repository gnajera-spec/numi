import { NavLink, useNavigate } from "react-router-dom";
import { FileText, Calendar, Bell, User, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { to: "/employee/dashboard", label: "Inicio", icon: User },
  { to: "/employee/receipts", label: "Recibos", icon: FileText },
  { to: "/employee/leaves", label: "Licencias", icon: Calendar },
  { to: "/employee/communications", label: "Comunicados", icon: Bell },
  { to: "/employee/profile", label: "Perfil", icon: User },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/employee/login");
  };

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : "?";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-surface-app)" }}>
      {/* Desktop header with tabs */}
      <header
        className="hidden md:flex items-center justify-between px-6 border-b h-16 shrink-0"
        style={{
          background: "var(--color-surface-card)",
          borderColor: "var(--color-surface-border)",
        }}
      >
        <div className="flex items-center gap-8">
          <span className="font-bold text-lg" style={{ color: "var(--color-primary)" }}>
            HRConnect
          </span>
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "text-[--color-primary] bg-[--color-primary-light]"
                      : "text-[--color-content-secondary] hover:text-[--color-content-primary] hover:bg-[--color-surface-empty]"
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              {user?.full_name}
            </p>
            <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
              {user?.puesto_nombre ?? user?.role}
            </p>
          </div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold"
            style={{ background: "var(--color-primary)" }}
          >
            {initials}
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-[--color-surface-empty] transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>
      </header>

      {/* Mobile header */}
      <header
        className="flex md:hidden items-center justify-between px-4 h-14 border-b shrink-0"
        style={{
          background: "var(--color-surface-card)",
          borderColor: "var(--color-surface-border)",
        }}
      >
        <span className="font-bold text-base" style={{ color: "var(--color-primary)" }}>
          HRConnect
        </span>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
            style={{ background: "var(--color-primary)" }}
          >
            {initials}
          </div>
          <button
            onClick={handleLogout}
            className="p-2"
            aria-label="Cerrar sesión"
          >
            <LogOut size={16} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 px-4 py-6 md:px-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex md:hidden border-t"
        style={{
          background: "var(--color-surface-card)",
          borderColor: "var(--color-surface-border)",
        }}
      >
        {navItems.slice(0, 4).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-xs font-medium transition-colors ${
                isActive
                  ? "text-[--color-primary]"
                  : "text-[--color-content-secondary]"
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
