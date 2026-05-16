import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BarChart2, LogOut, Users, Calendar, Settings,
  MessageSquare, FileText, Building2, Stethoscope,
  AlertTriangle, Activity, ClipboardList, Menu, X,
  ChevronUp, Check, Briefcase, UserCircle2,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { NumiLogo } from './NumiLogo';

/* ── Nav items ───────────────────────────────────────────────────────────── */
const rrhhNavItems = [
  { to: '/admin/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/admin/licencias',      label: 'Licencias',      icon: Calendar },
  { to: '/admin/comunicaciones', label: 'Comunicaciones', icon: MessageSquare },
  { to: '/admin/recibos',        label: 'Recibos',        icon: FileText },
  { to: '/admin/reports',        label: 'Reportes',       icon: BarChart2 },
];
const adminOnlyNavItems = [
  { to: '/admin/usuarios',     label: 'Usuarios',     icon: Users },
  { to: '/admin/organizacion', label: 'Organización', icon: Building2 },
];
const medicoNavItems = [
  { to: '/admin/medico/fichas',     label: 'Fichas médicas',   icon: Stethoscope },
  { to: '/admin/medico/accidentes', label: 'Accidentes',       icon: AlertTriangle },
  { to: '/admin/medico/reportes',   label: 'Reportes médicos', icon: Activity },
];
const adminEmpresaNavItems = [
  { to: '/admin/tipos-licencias',     label: 'Tipos de licencias', icon: ClipboardList },
  { to: '/admin/usuarios',            label: 'Usuarios',           icon: Users },
  { to: '/admin/organizacion',        label: 'Organización',       icon: Building2 },
  { to: '/admin/configuracion/smtp',  label: 'Configuración',      icon: Settings },
];

const MEDICO_ROLES = ['servicio_medico'];
const RRHH_ROLES   = ['rrhh', 'super_admin'];

function sectionLabel(role?: string) {
  if (role === 'servicio_medico') return 'Servicio Médico';
  if (role === 'admin_empresa')   return 'Administración';
  return 'Recursos Humanos';
}

/* Label del portal admin según el rol del usuario */
function adminPortalLabel(role: string): { label: string; sublabel: string } {
  if (role === 'admin_empresa')   return { label: 'Admin Empresa',   sublabel: 'Administrador del tenant' };
  if (role === 'servicio_medico') return { label: 'Portal Médico',   sublabel: 'Servicio Médico'          };
  return                                 { label: 'Portal RRHH',     sublabel: 'Recursos Humanos'         };
}

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
      textTransform: 'uppercase', color: 'var(--color-text-disabled)',
      padding: '16px 14px 6px',
    }}>
      {children}
    </div>
  );
}

function SidebarDivider() {
  return <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />;
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
  user: { first_name: string; last_name: string; role: string; roles?: string[]; puesto_nombre?: string; tenant_nombre?: string } | null;
  initials: string;
  onLogout: () => void;
  onNavigate: (path: string) => void;
  onRefreshUser: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* Cerrar al hacer click fuera */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* Portales disponibles según rol */
  const primaryRole = user?.role ?? '';
  const baseRoles = user?.roles?.length ? user.roles : [user?.role ?? 'rrhh'];
  const allRoles = Array.from(new Set([...baseRoles, 'colaborador']));
  const portals = buildPortals(allRoles, primaryRole, user?.puesto_nombre);

  return (
    <div ref={ref} style={{ position: 'relative' }}>

      {/* ── Panel que se abre hacia arriba ─────────────────────────────── */}
      <div
        aria-hidden={!open}
        style={{
          position: 'absolute', bottom: '100%', left: 8, right: 8,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          /* Animación suave */
          transformOrigin: 'bottom center',
          transform: open ? 'scaleY(1) translateY(-6px)' : 'scaleY(0.85) translateY(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform 220ms cubic-bezier(.22,.68,0,1.2), opacity 180ms ease',
          zIndex: 20,
        }}
      >
        {/* Cabecera del panel */}
        <div style={{
          padding: '14px 14px 10px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <p style={{
            margin: 0, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.8px', textTransform: 'uppercase',
            color: 'var(--color-text-disabled)',
          }}>
            Cambiar portal
          </p>
        </div>

        {/* Lista de portales */}
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
              {/* Ícono del portal */}
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

              {/* Textos */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 12, fontWeight: 600,
                  color: portal.current ? 'var(--color-primary)' : 'var(--color-text-primary)',
                }}>
                  {portal.label}
                </p>
                <p style={{
                  margin: 0, fontSize: 11,
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {portal.sublabel}
                </p>
              </div>

              {/* Check activo */}
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
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#fff0f0';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'var(--color-bg-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <LogOut size={14} style={{ color: 'var(--color-error, #e53e3e)' }} />
            </div>
            <span style={{
              fontSize: 12, fontWeight: 500,
              color: 'var(--color-error, #e53e3e)',
            }}>
              Cerrar sesión
            </span>
          </button>
        </div>
      </div>

      {/* ── Footer trigger ─────────────────────────────────────────────── */}
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
        {/* Avatar */}
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'var(--color-primary)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
          letterSpacing: '0.5px',
        }}>
          {initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 12, fontWeight: 600,
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {user?.first_name} {user?.last_name}
          </p>
          <p style={{
            margin: 0, fontSize: 11, color: 'var(--color-text-secondary)',
          }}>
            {portals.find(p => p.current)?.label ?? ''}
          </p>
        </div>

        {/* Chevron animado */}
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

/* ── AdminLayout ─────────────────────────────────────────────────────────── */
export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/admin/login'); };

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : '?';

  const isRrhh         = RRHH_ROLES.includes(user?.role ?? '');
  const isMedico       = MEDICO_ROLES.includes(user?.role ?? '');
  const isAdminEmpresa = user?.role === 'admin_empresa';
  const isAdmin        = user?.role === 'super_admin';
  const section        = sectionLabel(user?.role);
  const portalLabel    = adminPortalLabel(user?.role ?? '').label;

  /* ── Sidebar content ──────────────────────────────────────────────────── */
  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Logo */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid var(--color-border)' }}>
        <NumiLogo height={14} />
      </div>

      {/* Sección label */}
      <div style={{
        padding: '12px 14px 6px',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.5px',
        textTransform: 'uppercase',
        color: 'var(--color-primary)',
        opacity: 0.7,
      }}>
        {section}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
        {isAdminEmpresa && adminEmpresaNavItems.map(item => (
          <NavItem key={item.to} {...item} onClick={onClose} />
        ))}
        {isRrhh && rrhhNavItems.map(item => (
          <NavItem key={item.to} {...item} onClick={onClose} />
        ))}
        {isAdmin && (
          <>
            <SidebarDivider />
            <SectionLabel>Gestión</SectionLabel>
            {adminOnlyNavItems.map(item => (
              <NavItem key={item.to} {...item} onClick={onClose} />
            ))}
          </>
        )}
        {(isMedico || isAdmin) && (
          <>
            <SidebarDivider />
            <SectionLabel>Médico</SectionLabel>
            {medicoNavItems.map(item => (
              <NavItem key={item.to} {...item} onClick={onClose} />
            ))}
          </>
        )}
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
        id="admin-sidebar-desktop"
        style={{
          width: 220, flexShrink: 0,
          background: 'var(--color-bg-card)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-sm)', zIndex: 10,
        }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', animation: 'fadeIn 150ms ease' }}
          onClick={() => setMobileOpen(false)}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,44,56,0.4)' }} />
          <div
            style={{
              position: 'relative', width: 240, height: '100%',
              background: 'var(--color-bg-card)',
              boxShadow: 'var(--shadow-xl)',
              animation: 'slideInLeft 200ms ease', zIndex: 1,
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                position: 'absolute', top: 12, right: 12,
                width: 32, height: 32, borderRadius: 8,
                border: 'none', background: 'transparent',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-text-secondary)',
              }}
            >
              <X size={16} />
            </button>
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{
          height: 56, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 24px', gap: 12,
          background: 'var(--color-bg-card)',
          borderBottom: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <button
            id="admin-mobile-menu-btn"
            onClick={() => setMobileOpen(true)}
            style={{
              display: 'none', width: 36, height: 36,
              borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            <Menu size={18} />
          </button>

          <div id="admin-mobile-logo" style={{ display: 'none' }}>
            <NumiLogo height={16} />
          </div>

          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
              {portalLabel}
            </span>
          </div>

          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--color-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', flexShrink: 0,
          }}>
            {initials}
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {children}
        </main>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideInLeft { from { transform:translateX(-100%) } to { transform:translateX(0) } }
        @media (max-width: 767px) {
          #admin-sidebar-desktop { display: none !important; }
          #admin-mobile-menu-btn { display: flex !important; }
          #admin-mobile-logo     { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
