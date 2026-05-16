import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Building2, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

function NumiIcon({ size = 28, color = "#226080" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="24,3 42,13 42,35 24,45 6,35 6,13" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
      <line x1="24" y1="3"  x2="15" y2="18" stroke={color} strokeWidth="1.3" opacity="0.8"/>
      <line x1="24" y1="3"  x2="33" y2="18" stroke={color} strokeWidth="1.3" opacity="0.8"/>
      <line x1="6"  y1="13" x2="15" y2="18" stroke={color} strokeWidth="1.3" opacity="0.7"/>
      <line x1="42" y1="13" x2="33" y2="18" stroke={color} strokeWidth="1.3" opacity="0.7"/>
      <line x1="15" y1="18" x2="33" y2="18" stroke={color} strokeWidth="1.3" opacity="0.75"/>
      <line x1="15" y1="18" x2="24" y2="30" stroke={color} strokeWidth="1.3" opacity="0.75"/>
      <line x1="33" y1="18" x2="24" y2="30" stroke={color} strokeWidth="1.3" opacity="0.75"/>
      <line x1="6"  y1="35" x2="15" y2="30" stroke={color} strokeWidth="1.3" opacity="0.7"/>
      <line x1="42" y1="35" x2="33" y2="30" stroke={color} strokeWidth="1.3" opacity="0.7"/>
      <line x1="15" y1="30" x2="24" y2="45" stroke={color} strokeWidth="1.3" opacity="0.8"/>
      <line x1="33" y1="30" x2="24" y2="45" stroke={color} strokeWidth="1.3" opacity="0.8"/>
      <line x1="15" y1="30" x2="33" y2="30" stroke={color} strokeWidth="1.3" opacity="0.7"/>
      <circle cx="24" cy="3"  r="2.2" fill={color}/>
      <circle cx="42" cy="13" r="2.2" fill={color}/>
      <circle cx="42" cy="35" r="2.2" fill={color}/>
      <circle cx="24" cy="45" r="2.2" fill={color}/>
      <circle cx="6"  cy="35" r="2.2" fill={color}/>
      <circle cx="6"  cy="13" r="2.2" fill={color}/>
      <circle cx="15" cy="18" r="1.8" fill={color} opacity="0.85"/>
      <circle cx="33" cy="18" r="1.8" fill={color} opacity="0.85"/>
      <circle cx="24" cy="30" r="1.8" fill={color} opacity="0.85"/>
      <circle cx="15" cy="30" r="1.8" fill={color} opacity="0.85"/>
      <circle cx="33" cy="30" r="1.8" fill={color} opacity="0.85"/>
    </svg>
  );
}

const navItems = [
  { to: "/superadmin/tenants", label: "Empresas", icon: Building2 },
];

export function SuperAdminLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/superadmin/login", { replace: true });
  };

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "var(--color-surface-app)" }}>
      {/* Sidebar */}
      <aside
        className="w-56 shrink-0 flex flex-col border-r"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--color-surface-border)" }}>
          <div className="flex items-center gap-2.5">
            <NumiIcon size={28} color="#226080" />
            <div>
              <span style={{
                fontFamily: "'Montserrat', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: "-0.03em",
                color: "#226080",
                display: "flex",
                alignItems: "center",
                gap: 0,
              }}>
                <span>n</span><span style={{ color: "#e87d50" }}>u</span><span>mi</span>
              </span>
              <p className="text-xs font-semibold tracking-wide uppercase mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                Super Admin
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={({ isActive }) => isActive
                ? { background: "var(--color-primary-light)", color: "var(--color-primary)", fontWeight: 600 }
                : { color: "var(--color-content-secondary)" }
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t" style={{ borderColor: "var(--color-surface-border)" }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm w-full transition-colors hover:bg-red-50"
            style={{ color: "var(--color-state-absent)" }}
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
