import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GitBranch, Plus, Edit2, ToggleLeft, CheckCircle, AlertCircle } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { flujoAprobacionService } from "../../services/flujoAprobacionService";
import type { TipoLicenciaConFlujo } from "../../services/flujoAprobacionService";

function StatusBadge({ flujo }: { flujo: TipoLicenciaConFlujo }) {
  if (flujo.flujo_id === null) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
        background: "var(--color-bg-subtle)", color: "var(--color-text-secondary)",
      }}>Default</span>
    );
  }
  if (flujo.is_active) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
        background: "#f0fdf4", color: "#16a34a",
      }}>
        <CheckCircle size={10} /> Activo
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
      background: "#fefce8", color: "#ca8a04",
    }}>
      <AlertCircle size={10} /> Inactivo
    </span>
  );
}

export function AdminAprobacionesConfigPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<TipoLicenciaConFlujo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await flujoAprobacionService.list());
    } catch {
      setError("No se pudo cargar la configuración de flujos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(flujoId: string) {
    if (!confirm("¿Desactivar este flujo? Las solicitudes en curso continuarán con el flujo actual. Las nuevas usarán el aprobador por defecto.")) return;
    setDeactivating(flujoId);
    try {
      await flujoAprobacionService.deactivate(flujoId);
      await load();
    } catch {
      setError("No se pudo desactivar el flujo.");
    } finally {
      setDeactivating(null);
    }
  }

  return (
    <AdminLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 860 }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)" }}>
              Flujos de aprobación
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
              Define cómo se aprueban las solicitudes de licencia en tu empresa.
            </p>
          </div>
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        <p style={{
          margin: 0, fontSize: 12, color: "var(--color-text-disabled)",
          padding: "10px 14px", borderRadius: 10,
          background: "var(--color-bg-subtle)", border: "1px solid var(--color-border)",
        }}>
          <strong>Default</strong> = usa el aprobador configurado en políticas de licencia.
          Los cambios en el flujo no afectan solicitudes en curso.
        </p>

        <div style={{
          background: "var(--color-bg-card)", border: "1px solid var(--color-border)",
          borderRadius: 14, overflow: "hidden",
        }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>
              Cargando…
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-subtle)" }}>
                  {["Tipo de licencia", "Flujo configurado", "Pasos", "Estado", "Acciones"].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.5px",
                      textTransform: "uppercase", color: "var(--color-text-disabled)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.tipo_licencia_id} style={{
                    borderBottom: i < items.length - 1 ? "1px solid var(--color-border)" : "none",
                  }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                        {item.tipo_licencia_nombre}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
                        {item.tipo_licencia_codigo}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {item.flujo_nombre
                        ? <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{item.flujo_nombre}</span>
                        : <span style={{ fontSize: 13, color: "var(--color-text-disabled)" }}>—</span>
                      }
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>
                        {item.flujo_id ? item.pasos_count : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge flujo={item} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {!item.flujo_id || !item.is_active ? (
                          <Button
                            variant="secondary"
                            onClick={() => navigate(
                              `/admin/configuracion/aprobaciones/nuevo?tipo=${item.tipo_licencia_id}&nombre=${encodeURIComponent(item.tipo_licencia_nombre)}`
                            )}
                          >
                            <Plus size={13} style={{ marginRight: 4 }} />
                            {item.flujo_id ? "Nuevo flujo" : "Configurar flujo"}
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="secondary"
                              onClick={() => navigate(`/admin/configuracion/aprobaciones/${item.flujo_id}`)}
                            >
                              <Edit2 size={13} style={{ marginRight: 4 }} />
                              Editar
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={deactivating === item.flujo_id}
                              onClick={() => handleDeactivate(item.flujo_id!)}
                            >
                              <ToggleLeft size={13} style={{ marginRight: 4 }} />
                              {deactivating === item.flujo_id ? "Desactivando…" : "Desactivar"}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>
                      <GitBranch size={32} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
                      No hay tipos de licencia configurados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
