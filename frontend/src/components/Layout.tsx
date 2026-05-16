import { NavLink, useNavigate } from 'react-router-dom';
import {
  FileText, Calendar, Bell, User, LogOut, Home, Menu, X,
  ChevronUp, Check, Briefcase, UserCircle2, Building2, Stethoscope, CheckSquare,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { NumiLogo } from './NumiLogo';

const navItems = [
  { to: '/employee/dashboard',      label: 'Inicio',      icon: Home },
  { to: '/employee/receipts',       label: 'Recibos',     icon: FileText },
  { to: '/employee/leaves',         label: 'Licencias',   icon: Calendar },
  { to: '/employee/pendientes',     label: 'Pendientes',  icon: CheckSquare },
  { to: '/employee/communications', label: 'Comunicados', icon: Bell },
  { to: '/employee/profile',        label: 'Mi perfil',   icon: User },
];


/* ── NavItem ─────────────────────────────────────────────────────────────── */
function NavItem({
  to, label, icon: Icon, onClick,
}: { to: string; label: string; icon: React.ElementType; onClick?: () => void }) {
  return (
    <NavLink to={to} onClick={onClick} style={{ textDecoration: 'none' }}>
      {({ isActive }) => (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10, margin: '1px 0',
            fontSize: 13, fontWeight: isActive ? 600 : 500,
            color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            background: isActive ? 'var(--color-primary-xlight)' : 'transparent',
            transition: 'all 150ms ease', cursor: 'pointer', position: 'relative',
          }}
          onMouseEnter={e => {
            if (!isActive) {
              (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
            }
          }}
          onMouseLeave={e => {
            if (!isActive) {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
            }
          }}
        >
          {isActive && (
            <div style={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              width: 3, height: 20, background: 'var(--color-primary)',
              borderRadius: '0 3px 3px 0',
            }} />
          )}
          <Icon size={15} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{label}</span>
        </div>
      )}
    </NavLink>
  );
}

/* ── Bottom nav item (mobile) ────────────────────────────────────────────── */
function BottomItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
  return (
    <NavLink to={to} style={{ textDecoration: 'none', flex: 1 }}>
      {({ isActive }) => (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          padding: '8px 4px 10px',
          color: isActive ? 'var(--color-primary)' : 'var(--color-text-disabled)',
        }}>
          <div style={{
            width: 44, height: 26, borderRadius: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isActive ? 'var(--color-primary-light)' : 'transparent',
            transition: 'background 150ms ease',
          }}>
            <Icon size={18} />
          </div>
          <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 500, letterSpacing: '0.1px' }}>
            {label}
          </span>
        </div>
      )}
    </NavLink>
  );
}


/* ── Configuración de portales por rol ──────────────────────────────────────── */
interface PortalConfig {
  label: string; sublabel: string;
  icon: React.ElementType; color: string; path: string;
}
const PORTAL_MAP: Record<string, PortalConfig> = {
  colaborador:     { label: 'Portal Colaborador', sublabel: 'Portal del empleado',     icon: UserCircle2,  color: '#e87d50',                path: '/employee/dashboard'    },
  rrhh:            { label: 'Portal RRHH',        sublabel: 'Recursos Humanos',         icon: Briefcase,    color: '#226080',                path: '/admin/dashboard'       },
  super_admin:     { label: 'Portal RRHH',        sublabel: 'Super Administrador',      icon: Briefcase,    color: '#226080',                path: '/admin/dashboard'       },
  admin_empresa:   { label: 'Admin Empresa',      sublabel: 'Administrador del tenant', icon: Building2,    color: '#75559b',                path: '/admin/organizacion'    },
  servicio_medico: { label: 'Portal Médico',      sublabel: 'Servicio Médico',          icon: Stethoscope,  color: '#1a7a45',                path: '/admin/medico/fichas'   },
};

function buildPortals(
  roles: string[],
  currentRole: string,
  puestoNombre?: string,
): Array<PortalConfig & { id: string; current: boolean }> {
  const seen = new Set<string>();
  return roles
    .filter(r => PORTAL_MAP[r])
    .filter(r => { const key = PORTAL_MAP[r].label; if (seen.has(key)) return false; seen.add(key); return true; })
    .map(r => ({
      id: r,
      ...PORTAL_MAP[r],
      sublabel: r === 'colaborador' ? (puestoNombre ?? 'Portal del empleado') : PORTAL_MAP[r].sublabel,
      current: r === currentRole,
    }));
}

/* ── ProfileSwitcher ─────────────────────────────────────────────────────── */
function ProfileSwitcher({
  user, initials, onLogout, onNavigate, onRefreshUser,
}: {
  user: { first_name: string; last_name: string; full_name?: string; role: string;
          roles?: string[]; puesto_nombre?: string; tenant_nombre?: string } | null;
  initials: string;
  onLogout: () => void;
  onNavigate: (path: string) => void;
  onRefreshUser: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const baseRoles = user?.roles?.length ? user.roles : [user?.role ?? 'colaborador'];
  const allRoles = Array.from(new Set([...baseRoles, 'colaborador']));
  const portals = buildPortals(allRoles, 'colaborador', user?.puesto_nombre);

  const displayName = user?.full_name ?? `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();

  return (
    <div ref={ref} style={{ position: 'relative' }}>

      {/* Panel que se abre hacia arriba */}
      <div
        aria-hidden={!open}
        style={{
          position: 'absolute', bottom: '100%', left: 8, right: 8,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          transformOrigin: 'bottom center',
          transform: open ? 'scaleY(1) translateY(-6px)' : 'scaleY(0.85) translateY(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform 220ms cubic-bezier(.22,.68,0,1.2), opacity 180ms ease',
          zIndex: 20,
        }}
      >
        {/* Cabecera */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--color-border)' }}>
          <p style={{
            margin: 0, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.8px', textTransform: 'uppercase',
            color: 'var(--color-text-disabled)',
          }}>
            Cambiar portal
          </p>
        </div>

        {/* Portales */}
        <div style={{ padding: '6px' }}>
          {portals.map(portal => (
            <button
              key={portal.id}
              onClick={async () => {
                setOpen(false);
                if (!portal.current) {
                  try {
                    const res = await authService.switchRole(portal.id);
                    localStorage.setItem('access_token', res.access_token);
                    localStorage.setItem('refresh_token', res.refresh_token);
                  } catch { /* si falla, navega igual */ }
                }
                onNavigate(portal.path);          // navegar primero
                onRefreshUser().catch(() => {});  // actualizar contexto en background
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 10px',
                background: portal.current ? 'var(--color-primary-xlight)' : 'transparent',
                border: 'none', borderRadius: 10,
                cursor: portal.current ? 'default' : 'pointer',
                textAlign: 'left', transition: 'background 150ms ease',
              }}
              onMouseEnter={e => {
                if (!portal.current)
                  (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)';
              }}
              onMouseLeave={e => {
                if (!portal.current)
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: portal.current ? portal.color : 'var(--color-bg-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 150ms ease',
              }}>
                <portal.icon
                  size={15}
                  style={{ color: portal.current ? '#fff' : 'var(--color-text-secondary)' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 12, fontWeight: 600,
                  color: portal.current ? 'var(--color-primary)' : 'var(--color-text-primary)',
                }}>
                  {portal.label}
                </p>
                <p style={{
                  margin: 0, fontSize: 11, color: 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {portal.sublabel}
                </p>
              </div>
              {portal.current && (
                <Check size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              )}
            </button>
          ))}
        </div>

        {/* Logout */}
        <div style={{ padding: '6px', borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '9px 10px',
              background: 'transparent', border: 'none',
              borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fff0f0'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'var(--color-bg-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <LogOut size={14} style={{ color: 'var(--color-error, #e53e3e)' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-error, #e53e3e)' }}>
              Cerrar sesión
            </span>
          </button>
        </div>
      </div>

      {/* Footer trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="Cambiar perfil"
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '12px 14px 14px',
          background: open ? 'var(--color-primary-xlight)' : 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          borderTop: '1px solid var(--color-border)',
          transition: 'background 150ms ease',
        }}
        onMouseEnter={e => {
          if (!open) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)';
        }}
        onMouseLeave={e => {
          if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        {/* Avatar — naranja para colaborador */}
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: portals.find(p => p.current)?.color ?? 'var(--color-secondary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0, letterSpacing: '0.5px',
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 12, fontWeight: 600,
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {displayName}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary)' }}>
            {user?.puesto_nombre ?? 'Colaborador'}
          </p>
        </div>

        <ChevronUp
          size={14}
          style={{
            color: 'var(--color-text-disabled)',
            transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 220ms cubic-bezier(.22,.68,0,1.2)',
            flexShrink: 0,
          }}
        />
      </button>
    </div>
  );
}

/* ── Layout ──────────────────────────────────────────────────────────────── */
export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/employee/login'); };
  const initials = user ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase() : '?';

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid var(--color-border)' }}>
        <NumiLogo height={14} />
      </div>

      {/* Section label */}
      <div style={{
        padding: '12px 14px 6px', fontSize: 10, fontWeight: 700,
        letterSpacing: '0.8px', textTransform: 'uppercase',
        color: 'var(--color-primary)', opacity: 0.7,
      }}>
        Mi Portal
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
        {navItems.map(item => <NavItem key={item.to} {...item} onClick={onClose} />)}
      </nav>

      {/* Profile switcher */}
      <ProfileSwitcher
        user={user}
        initials={initials}
        onLogout={handleLogout}
        onNavigate={path => { navigate(path); onClose?.(); }}
        onRefreshUser={refreshUser}
      />
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', background: 'var(--color-bg-app)', overflow: 'hidden' }}>

      {/* Sidebar desktop */}
      <aside
        id="emp-sidebar-desktop"
        style={{
          width: 220, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: 'var(--color-bg-card)',
          borderRight: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)', zIndex: 10,
        }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileDrawerOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', animation: 'fadeIn 150ms ease' }}
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,44,56,0.4)' }} />
          <div
            style={{
              position: 'relative', width: 240, height: '100%',
              background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-xl)',
              animation: 'slideInLeft 200ms ease', zIndex: 1,
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileDrawerOpen(false)}
              style={{
                position: 'absolute', top: 12, right: 12,
                width: 32, height: 32, borderRadius: 8,
                border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-text-secondary)',
              }}
            >
              <X size={16} />
            </button>
            <SidebarContent onClose={() => setMobileDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{
          height: 56, flexShrink: 0,
          display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
          background: 'var(--color-bg-card)',
          borderBottom: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <button
            id="emp-mobile-menu-btn"
            onClick={() => setMobileDrawerOpen(true)}
            style={{
              display: 'none', width: 36, height: 36, borderRadius: 8,
              border: 'none', background: 'transparent', cursor: 'pointer',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            <Menu size={18} />
          </button>

          <div id="emp-mobile-logo" style={{ display: 'none' }}>
            <NumiLogo height={16} />
          </div>

          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
            Portal Colaborador
          </span>

          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--color-secondary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>
            {initials}
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} id="emp-main-content">
          {children}
        </main>

        {/* Bottom nav (mobile) */}
        <nav
          id="emp-bottom-nav"
          style={{
            display: 'none', flexShrink: 0,
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-card)',
            boxShadow: '0 -2px 12px rgba(34,96,128,.06)',
          }}
        >
          {navItems.map(item => <BottomItem key={item.to} {...item} />)}
        </nav>

      </div>

      <style>{`
        @keyframes slideInLeft { from { transform:translateX(-100%) } to { transform:translateX(0) } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @media (max-width: 767px) {
          #emp-sidebar-desktop  { display: none !important; }
          #emp-mobile-menu-btn  { display: flex !important; }
          #emp-mobile-logo      { display: flex !important; }
          #emp-bottom-nav       { display: flex !important; }
          #emp-main-content     { padding-bottom: 16px !important; }
        }
      `}</style>
    </div>
  );
}
