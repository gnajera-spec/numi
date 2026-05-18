import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorBanner } from '../../components/ErrorBanner';
import { NumiIsotipo } from '../../components/NumiLogo';

const ALLOWED_ROLES = ['rrhh', 'admin_empresa'];

/* ── Floating-label input ─────────────────────────────────────────────────── */
function Field({
  label, id, type = 'text', value, onChange, autoComplete, required,
  autoFocus, inputMode, maxLength, suffix,
}: {
  label: string; id: string; type?: string; value: string;
  onChange: (v: string) => void;
  autoComplete?: string; required?: boolean; autoFocus?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number; suffix?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        position: 'relative',
        border: `1.5px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
        borderRadius: 10,
        background: 'var(--color-bg-subtle)',
        transition: 'border-color 150ms ease',
        boxShadow: focused ? '0 0 0 3px var(--color-primary-xlight)' : 'none',
      }}>
        <label
          htmlFor={id}
          style={{
            position: 'absolute', left: 14,
            top: floated ? 8 : '50%',
            transform: floated ? 'none' : 'translateY(-50%)',
            fontSize: floated ? 10 : 14,
            fontWeight: floated ? 600 : 400,
            color: focused ? 'var(--color-primary)' : 'var(--color-text-disabled)',
            transition: 'all 150ms ease',
            pointerEvents: 'none',
            letterSpacing: floated ? '0.3px' : '0',
            fontFamily: "'Montserrat', system-ui, sans-serif",
          }}
        >
          {label}
        </label>
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          value={value}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', border: 'none', background: 'transparent',
            outline: 'none', padding: value || focused ? '22px 14px 8px' : '14px 14px',
            paddingRight: suffix ? 44 : 14,
            fontSize: 14, fontWeight: 500,
            color: 'var(--color-text-primary)',
            fontFamily: "'Montserrat', system-ui, sans-serif",
            transition: 'padding 150ms ease',
            boxSizing: 'border-box',
          }}
        />
        {suffix && (
          <div style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          }}>
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   AdminLoginPage
   ══════════════════════════════════════════════════════════════════════ */
export function AdminLoginPage() {
  const { login, loginMfaChallenge, refreshUser, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'super_admin') {
        navigate('/superadmin/tenants', { replace: true });
        return;
      }
      if (ALLOWED_ROLES.includes(user.role)) {
        const dest =
          user.role === 'admin_empresa' ? '/admin/usuarios' :
          '/admin/dashboard';
        navigate(dest, { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const result = await login(email, password);
      if (result.mfa_required) { setMfaToken(result.mfa_token); return; }
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally { setLoading(false); }
  };

  const handleMfa = async (e: FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null); setLoading(true);
    try {
      await loginMfaChallenge(mfaToken, totpCode);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido');
      setTotpCode('');
    } finally { setLoading(false); }
  };


  return (
    <div style={{ minHeight: '100vh', display: 'flex', overflow: 'auto', background: 'var(--color-bg-app)' }}>

      {/* ── Panel izquierdo: branding RRHH ──────────────────────────────── */}
      <div id="admin-login-brand" style={{
        display: 'none', flex: '0 0 45%', flexDirection: 'column',
        background: 'var(--color-primary)',
        padding: '48px 52px',
        position: 'relative', overflow: 'hidden',
        justifyContent: 'space-between',
      }}>
        {/* Isotipo decorativo de fondo */}
        <div style={{
          position: 'absolute', bottom: -60, right: -60,
          opacity: 0.07, transform: 'rotate(-15deg)',
        }}>
          <NumiIsotipo size={420} color="#ffffff" />
        </div>

        {/* Logo */}
        <img src="/logo.png" alt="NUMI" height={36} style={{ display: 'block', width: 'auto' }} draggable={false} />

        {/* Cuerpo central */}
        <div style={{ position: 'relative' }}>
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '2px',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
            margin: '0 0 16px',
            fontFamily: "'Montserrat', system-ui, sans-serif",
          }}>
            Portal de Recursos Humanos
          </p>
          <h1 style={{
            fontSize: 38, fontWeight: 900, lineHeight: 1.15,
            color: '#ffffff', margin: '0 0 20px',
            fontFamily: "'Montserrat', system-ui, sans-serif",
            letterSpacing: '-0.02em',
          }}>
            Gestioná tu<br />equipo con datos.
          </h1>
          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.7, margin: 0, fontWeight: 300,
            fontFamily: "'Montserrat', system-ui, sans-serif",
          }}>
            Controlá ausentismo, liquidaciones, legajos y comunicados institucionales desde un panel centralizado.
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, position: 'relative' }}>
          {['Legajos', 'Liquidaciones', 'Ausentismo', 'Reportes', 'Comunicados'].map(f => (
            <span key={f} style={{
              padding: '6px 14px', borderRadius: 20,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 12, fontWeight: 500,
              fontFamily: "'Montserrat', system-ui, sans-serif",
            }}>
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* ── Panel derecho: formulario ─────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
        background: '#ffffff',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {!mfaToken ? (
            <>
              {/* Logo (solo mobile) */}
              <div id="admin-login-mobile-logo" style={{ marginBottom: 32, display: 'none', justifyContent: 'center' }}>
                <div style={{ background: 'var(--color-primary)', borderRadius: 12, padding: '12px 24px', display: 'inline-flex' }}>
                  <img src="/logo.png" alt="NUMI" height={28} style={{ display: 'block', width: 'auto' }} draggable={false} />
                </div>
              </div>

              {/* Badge RRHH */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 20,
                background: 'var(--color-primary-xlight)',
                marginBottom: 16,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--color-primary)', flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '1.5px',
                  textTransform: 'uppercase', color: 'var(--color-primary)',
                  fontFamily: "'Montserrat', system-ui, sans-serif",
                }}>
                  Acceso RRHH
                </span>
              </div>

              <h2 style={{
                fontSize: 24, fontWeight: 800, margin: '0 0 4px',
                color: 'var(--color-text-primary)', letterSpacing: '-0.02em',
                fontFamily: "'Montserrat', system-ui, sans-serif",
              }}>
                Panel Administrativo
              </h2>
              <p style={{
                fontSize: 13, color: 'var(--color-text-secondary)',
                margin: '0 0 32px', fontWeight: 400,
                fontFamily: "'Montserrat', system-ui, sans-serif",
              }}>
                Ingresá con tu cuenta de RRHH para continuar
              </p>

              {error && <div style={{ marginBottom: 20 }}><ErrorBanner message={error} /></div>}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field id="admin-email" label="Correo electrónico" type="email"
                  autoComplete="email" required autoFocus value={email} onChange={setEmail} />
                <Field id="admin-password" label="Contraseña"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password" required value={password} onChange={setPassword}
                  suffix={
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-text-disabled)', display: 'flex', padding: 2,
                      }}
                      aria-label={showPass ? 'Ocultar' : 'Mostrar'}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />

                <button type="submit" disabled={loading} style={{
                  marginTop: 8, width: '100%', height: 48,
                  background: loading ? 'var(--color-primary-hover)' : 'var(--color-primary)',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  fontFamily: "'Montserrat', system-ui, sans-serif",
                  letterSpacing: '0.3px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.8 : 1,
                  transition: 'all 150ms ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  {loading ? (
                    <>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff', display: 'inline-block',
                        animation: 'spin 0.7s linear infinite',
                      }} />
                      Ingresando...
                    </>
                  ) : 'Ingresar al panel'}
                </button>
              </form>

              <div style={{ marginTop: 28, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--color-text-disabled)', margin: 0,
                  fontFamily: "'Montserrat', system-ui, sans-serif" }}>
                  Este acceso está reservado para el equipo de RRHH y administradores.
                </p>
              </div>
            </>
          ) : (
            /* ── MFA ─────────────────────────────────────────────────────── */
            <>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'var(--color-primary-xlight)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}>
                <ShieldCheck size={26} style={{ color: 'var(--color-primary)' }} />
              </div>
              <h2 style={{
                fontSize: 22, fontWeight: 800, margin: '0 0 6px',
                color: 'var(--color-text-primary)',
                fontFamily: "'Montserrat', system-ui, sans-serif",
              }}>
                Verificación en dos pasos
              </h2>
              <p style={{
                fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 28px',
                fontFamily: "'Montserrat', system-ui, sans-serif",
              }}>
                Ingresá el código de tu app de autenticación
              </p>

              {error && <div style={{ marginBottom: 16 }}><ErrorBanner message={error} /></div>}

              <form onSubmit={handleMfa} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input
                  type="text" inputMode="numeric" autoComplete="one-time-code"
                  required maxLength={8} value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\s/g, ''))}
                  placeholder="000 000" autoFocus
                  style={{
                    textAlign: 'center', fontSize: 26, letterSpacing: '0.4em',
                    fontWeight: 700, height: 64, width: '100%',
                    border: '1.5px solid var(--color-border)', borderRadius: 10,
                    outline: 'none', background: 'var(--color-bg-subtle)',
                    fontFamily: "'Montserrat', system-ui, sans-serif",
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
                <button type="submit" disabled={loading} style={{
                  width: '100%', height: 48,
                  background: 'var(--color-primary)', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'Montserrat', system-ui, sans-serif",
                  transition: 'all 150ms ease',
                }}>
                  {loading ? 'Verificando...' : 'Verificar código'}
                </button>
              </form>

              <button
                onClick={() => { setMfaToken(null); setError(null); setTotpCode(''); }}
                style={{
                  marginTop: 18, background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  color: 'var(--color-text-secondary)',
                  fontSize: 13, fontFamily: "'Montserrat', system-ui, sans-serif",
                }}>
                <ArrowLeft size={14} /> Volver al login
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          #admin-login-brand { display: flex !important; }
          #admin-login-mobile-logo { display: none !important; }
        }
        @media (max-width: 767px) {
          #admin-login-mobile-logo { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
