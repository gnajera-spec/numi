import { NavLink, useNavigate } from 'react-router-dom';
import {
  Calendar, Stethoscope, ShieldCheck, BarChart2, Menu, X,
  LogOut, ChevronUp, UserCircle2, Briefcase, Building2,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { NumiLogo } from './NumiLogo';

const NAV_ITEMS = [
  { to: '/employee/medico/licencias',  label: 'Licencias Médicas', icon: Calendar },
  { to: '/employee/medico/fichas',     label: 'Fichas',            icon: Stethoscope },
  { to: '/employee/medico/accidentes', label: 'Accidentes',        icon: ShieldCheck },
  { to: '/employee/medico/reportes',   label: 'Reportes',          icon: BarChart2 },
];

const PORTAL_MAP: Record<string, { label: string; sublabel: string; icon: React.ElementType; color: string; path: string }> = {
  colaborador:     { label: 'Portal Colaborador', sublabel: 'Portal del empleado',  icon: UserCircle2, color: '#e87d50', path: '/employee/dashboard'       },
  rrhh:            { label: 'Portal RRHH',        sublabel: 'Recursos Humanos',      icon: Briefcase,   color: '#226080', path: '/admin/dashboard'          },
  admin_empresa:   { label: 'Admin Empresa',      sublabel: 'Administrador',          icon: Building2,   color: '#75559b', path: '/admin/organizacion'       },
  servicio_medico: { label: 'Portal Médico',      sublabel: 'Servicio Médico',        icon: Stethoscope, color: '#1a7a45', path: '/employee/medico/licencias'},
};

function NavItem({ to, label, icon: Icon, onClick }: { to: string; label: string; icon: React.ElementType; onClick?: () => void }) {
  return (
    <NavLink to={to} onClick={onClick} style={{ textDecoration: 'none' }}>
      {({ isActive }) => (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 10, margin: '1px 0',
          fontSize: 13, fontWeight: isActive ? 600 : 500,
          color: isActive ? '#1a7a45' : 'var(--color-text-secondary)',
          background: isActive ? '#e8f5ee' : 'transparent',
          transition: 'all 150ms ease', cursor: 'pointer', position: 'relative',
        }}
          onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)'; } }}
          onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
        >
          {isActive && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, background: '#1a7a45', borderRadius: '0 3px 3px 0' }} />}
          <Icon size={15} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{label}</span>
        </div>
      )}
    </NavLink>
  );
}

function ProfileSwitcher({ user, onLogout }: { user: { first_name: string; last_name: string; full_name?: string; role: string; roles?: string[] } | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const baseRoles = user?.roles?.length ? user.roles : [user?.role ?? 'servicio_medico'];
  const allRoles = Array.from(new Set([...baseRoles, 'colaborador']));
  const portals = allRoles.filter(r => PORTAL_MAP[r]).filter((r, i, a) => a.findIndex(x => PORTAL_MAP[x]?.label === PORTAL_MAP[r]?.label) === i)
    .map(r => ({ id: r, ...PORTAL_MAP[r], current: r === 'servicio_medico' }));

  const displayName = user?.full_name ?? `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <div ref={ref} style={{ position: 'relative', padding: '0 8px 8px' }}>
      <div aria-hidden={!open} style={{
        position: 'absolute', bottom: '100%', left: 8, right: 8,
        background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
        borderRadius: 14, boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
        transformOrigin: 'bottom center',
        transform: open ? 'scaleY(1) translateY(-6px)' : 'scaleY(0.85) translateY(4px)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition: 'transform 220ms cubic-bezier(.22,.68,0,1.2), opacity 180ms ease', zIndex: 20,
      }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--color-border)' }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--color-text-disabled)' }}>
            Cambiar portal
          </p>
        </div>
        <div style={{ padding: '6px' }}>
          {portals.map(portal => (
            <button key={portal.id} onClick={async () => {
              setOpen(false);
              if (!portal.current) {
                try { const res = await authService.switchRole(portal.id); localStorage.setItem('access_token', res.access_token); localStorage.setItem('refresh_token', res.refresh_token); } catch { /* navegá igual */ }
              }
              navigate(portal.path);
              refreshUser().catch(() => {});
            }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', background: portal.current ? '#e8f5ee' : 'transparent', border: 'none', borderRadius: 10, cursor: portal.current ? 'default' : 'pointer', textAlign: 'left' }}
              onMouseEnter={e => { if (!portal.current) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)'; }}
              onMouseLeave={e => { if (!portal.current) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: portal.current ? portal.color : 'var(--color-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <portal.icon size={15} style={{ color: portal.current ? '#fff' : 'var(--color-text-secondary)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: portal.current ? '#1a7a45' : 'var(--color-text-primary)' }}>{portal.label}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{portal.sublabel}</p>
              </div>
            </button>
          ))}
        </div>
        <div style={{ padding: '6px', borderTop: '1px solid var(--color-border)' }}>
          <button onClick={() => { setOpen(false); onLogout(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', background: 'transparent', border: 'none', borderRadius: 10, cursor: 'pointer', color: 'var(--color-text-secondary)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--color-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogOut size={15} style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Cerrar sesión</span>
          </button>
        </div>
      </div>

      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 10px', background: open ? 'var(--color-bg-hover)' : 'transparent',
        border: 'none', borderRadius: 12, cursor: 'pointer',
      }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: '#1a7a45', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{initials}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</p>
          <p style={{ margin: 0, fontSize: 10, color: '#1a7a45', fontWeight: 500 }}>Servicio Médico</p>
        </div>
        <ChevronUp size={14} style={{ color: 'var(--color-text-secondary)', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms ease' }} />
      </button>
    </div>
  );
}

export function MedicoLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/employee/login');
  };

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <NumiLogo height={28} />
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>NUMI</p>
          <p style={{ margin: 0, fontSize: 10, color: '#1a7a45', fontWeight: 600 }}>Portal Médico</p>
        </div>
      </div>
      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => (
          <NavItem key={item.to} {...item} onClick={() => setDrawerOpen(false)} />
        ))}
      </nav>
      {/* Profile */}
      <ProfileSwitcher user={user} onLogout={handleLogout} />
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100dvh', background: 'var(--color-surface-app)' }}>
      {/* Desktop sidebar */}
      <aside style={{
        width: 220, flexShrink: 0, background: 'var(--color-bg-card)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
      }} className="hidden md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex' }} onClick={() => setDrawerOpen(false)}>
          <aside style={{ width: 240, background: 'var(--color-bg-card)', height: '100%', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Mobile topbar */}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }} className="md:hidden">
          <button onClick={() => setDrawerOpen(true)} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            {drawerOpen ? <X size={20} style={{ color: 'var(--color-text-primary)' }} /> : <Menu size={20} style={{ color: 'var(--color-text-primary)' }} />}
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>Portal Médico</span>
        </div>
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 24px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
