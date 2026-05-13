import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart2,
  LogOut,
  Users,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/reports", label: "Reportes", icon: BarChart2 },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : "?";

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "var(--color-surface-app)" }}
    >
      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 border-r"
        style={{
          background: "var(--color-surface-card)",
          borderColor: "var(--color-surface-border)",
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--color-surface-border)" }}>
          <div className="flex items-center gap-2">
            <Users size={20} style={{ color: "var(--color-primary)" }} />
            <span className="font-bold text-base" style={{ color: "var(--color-primary)" }}>
              HRConnect
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
            Panel RRHH
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "font-semibold text-[--color-primary] bg-[--color-primary-light]"
                    : "font-normal text-[--color-content-secondary] hover:text-[--color-content-primary] hover:bg-[--color-surface-empty]"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div
          className="px-4 py-4 border-t flex items-center gap-3"
          style={{ borderColor: "var(--color-surface-border)" }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
            style={{ background: "var(--color-primary)" }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--color-content-primary)" }}>
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs capitalize truncate" style={{ color: "var(--color-content-secondary)" }}>
              {user?.role?.replace("_", " ")}
            </p>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="shrink-0 p-1 rounded hover:bg-red-50 transition-colors"
            style={{ color: "var(--color-content-secondary)" }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-4 h-14 border-b"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <span className="font-bold" style={{ color: "var(--color-primary)" }}>
          HRConnect · RRHH
        </span>
        <button onClick={handleLogout} aria-label="Cerrar sesión">
          <LogOut size={18} style={{ color: "var(--color-content-secondary)" }} />
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-14">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
