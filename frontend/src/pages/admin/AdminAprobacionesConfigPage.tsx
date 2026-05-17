import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GitBranch, Plus, Edit2, ToggleLeft, CheckCircle, AlertCircle, Info } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import { flujoAprobacionService } from "../../services/flujoAprobacionService";
import type { TipoLicenciaConFlujo } from "../../services/flujoAprobacionService";

function StatusBadge({ flujo }: { flujo: TipoLicenciaConFlujo }) {
  if (!flujo.flujo_id) {
    return (
      <span className="badge badge-neutral">
        Default
      </span>
    );
  }
  if (flujo.is_active) {
    return (
      <span className="badge badge-activo">
        <CheckCircle size={10} />
        Activo
      </span>
    );
  }
  return (
    <span className="badge badge-pendiente">
      <AlertCircle size={10} />
      Inactivo
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
      <div className="flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>
              Flujos de aprobación
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
              Definí cómo se aprueban las solicitudes de licencia en tu empresa.
            </p>
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        {/* Info box */}
        <div
          className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
          style={{
            background: "var(--color-primary-xlight)",
            borderColor: "var(--color-primary-light)",
            color: "var(--color-primary)",
          }}
        >
          <Info size={15} className="mt-0.5 shrink-0" />
          <p style={{ color: "var(--color-text-secondary)" }}>
            <strong style={{ color: "var(--color-text-primary)" }}>Default</strong> = usa el aprobador configurado en políticas de licencia.
            Los cambios en un flujo no afectan solicitudes en curso.
          </p>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size={28} />
          </div>
        ) : (items ?? []).length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="Sin tipos de licencia"
            description="No hay tipos de licencia configurados en tu empresa."
          />
        ) : (
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs font-semibold uppercase tracking-wide"
                  style={{
                    borderBottom: "1px solid var(--color-surface-border)",
                    color: "var(--color-content-secondary)",
                    background: "var(--color-surface-app)",
                  }}
                >
                  <th className="px-4 py-3">Tipo de licencia</th>
                  <th className="px-4 py-3">Flujo configurado</th>
                  <th className="px-4 py-3 text-center">Pasos</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-surface-border)" }}>
                {(items ?? []).map((item) => (
                  <tr
                    key={item.tipo_licencia_id}
                    className="transition-colors"
                    style={{ ["--hover-bg" as string]: "var(--color-surface-app)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-app)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: "var(--color-content-primary)" }}>
                        {item.tipo_licencia_nombre}
                      </p>
                      <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--color-content-secondary)" }}>
                        {item.tipo_licencia_codigo}
                      </p>
                    </td>
                    <td className="px-4 py-3" style={{ color: item.flujo_nombre ? "var(--color-content-primary)" : "var(--color-content-disabled)" }}>
                      {item.flujo_nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: "var(--color-content-primary)" }}>
                      {item.flujo_id ? item.pasos_count : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge flujo={item} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {!item.flujo_id || !item.is_active ? (
                          <Button
                            variant="secondary"
                            onClick={() => navigate(
                              `/admin/configuracion/aprobaciones/nuevo?tipo=${item.tipo_licencia_id}&nombre=${encodeURIComponent(item.tipo_licencia_nombre)}`
                            )}
                          >
                            <Plus size={13} className="mr-1" />
                            {item.flujo_id ? "Nuevo flujo" : "Configurar"}
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="secondary"
                              onClick={() => navigate(`/admin/configuracion/aprobaciones/${item.flujo_id}`)}
                            >
                              <Edit2 size={13} className="mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={deactivating === item.flujo_id}
                              onClick={() => handleDeactivate(item.flujo_id!)}
                            >
                              <ToggleLeft size={13} className="mr-1" />
                              {deactivating === item.flujo_id ? "Desactivando…" : "Desactivar"}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
