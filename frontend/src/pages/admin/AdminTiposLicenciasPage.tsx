import { useEffect, useState } from "react";
import { FileText, Plus, X, Pencil, Trash2 } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { licenciasService } from "../../services/licenciasService";
import type { TipoLicencia } from "../../types";

interface FormState {
  codigo: string;
  nombre: string;
  descripcion: string;
  dias_maximos: string;
  requiere_certificado: boolean;
  is_active: boolean;
}

const emptyForm: FormState = {
  codigo: "",
  nombre: "",
  descripcion: "",
  dias_maximos: "",
  requiere_certificado: false,
  is_active: true,
};

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 transition";

const inputStyle = {
  borderColor: "var(--color-surface-border)",
  color: "var(--color-content-primary)",
  background: "var(--color-surface-app)",
};

interface ModalProps {
  editing: TipoLicencia | null;
  saving: boolean;
  onClose: () => void;
  onSave: (data: FormState) => void;
}

function TipoLicenciaModal({ editing, saving, onClose, onSave }: ModalProps) {
  const isGlobal = !!(editing && !editing.tenant_id);
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          codigo: editing.codigo,
          nombre: editing.nombre,
          descripcion: editing.descripcion ?? "",
          dias_maximos: editing.dias_maximos != null ? String(editing.dias_maximos) : "",
          requiere_certificado: editing.requiere_certificado,
          is_active: editing.is_active ?? true,
        }
      : emptyForm
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl p-6 flex flex-col gap-5"
        style={{ background: "var(--color-surface-card)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
            {editing ? "Editar tipo de licencia" : "Nuevo tipo de licencia"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <X size={16} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>

        {isGlobal && (
          <p style={{
            fontSize: 12, padding: "8px 12px", borderRadius: 8,
            background: "#fefce8", color: "#92400e",
            border: "1px solid #fde68a",
          }}>
            Este es un tipo de licencia global del sistema. Solo podés ver sus datos, no modificarlos.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Código <span className="text-red-500">*</span>
            </label>
            <input
              required
              disabled={!!editing}
              value={form.codigo}
              onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
              placeholder="Ej: VAC"
              maxLength={10}
              className={inputClass}
              style={{ ...inputStyle, opacity: editing ? 0.6 : 1 }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              required
              disabled={isGlobal}
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Vacaciones"
              className={inputClass}
              style={{ ...inputStyle, opacity: isGlobal ? 0.6 : 1 }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Descripción
            </label>
            <textarea
              rows={2}
              disabled={isGlobal}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Descripción breve"
              className={inputClass}
              style={{ ...inputStyle, resize: "none", opacity: isGlobal ? 0.6 : 1 }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Días máximos{" "}
              <span className="text-xs font-normal" style={{ color: "var(--color-content-secondary)" }}>
                (dejar vacío = ilimitado)
              </span>
            </label>
            <input
              type="number"
              min={1}
              max={365}
              disabled={isGlobal}
              value={form.dias_maximos}
              onChange={(e) => setForm((f) => ({ ...f, dias_maximos: e.target.value }))}
              placeholder="30"
              className={inputClass}
              style={{ ...inputStyle, opacity: isGlobal ? 0.6 : 1 }}
            />
          </div>

          <div className="flex flex-col gap-2">
            {editing && !isGlobal && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: "var(--color-primary)" }}
                />
                <span className="text-sm" style={{ color: "var(--color-content-primary)" }}>Activo</span>
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              {isGlobal ? "Cerrar" : "Cancelar"}
            </Button>
            {!isGlobal && (
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear tipo"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminTiposLicenciasPage() {
  const [tipos, setTipos] = useState<TipoLicencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TipoLicencia | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const all = await licenciasService.listTipos();
      // Solo mostrar tipos administrativos — los médicos (es_medica=true) se gestionan aparte
      setTipos(all.filter((t: TipoLicencia) => !t.es_medica));
    } catch {
      setError("No se pudieron cargar los tipos de licencia.");
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (data: FormState) => {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await licenciasService.updateTipo(editing.id, {
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          requiere_certificado: data.requiere_certificado,
          dias_maximos: data.dias_maximos ? Number(data.dias_maximos) : null,
          is_active: data.is_active,
        });
      } else {
        await licenciasService.createTipo({
          codigo: data.codigo,
          nombre: data.nombre,
          descripcion: data.descripcion || undefined,
          requiere_certificado: data.requiere_certificado,
          dias_maximos: data.dias_maximos ? Number(data.dias_maximos) : undefined,
        });
      }
      await load();
      setShowModal(false);
      setEditing(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tipo: TipoLicencia) => {
    if (!confirm(`¿Eliminar el tipo de licencia "${tipo.nombre}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(tipo.id);
    setError(null);
    try {
      await licenciasService.deleteTipo(tipo.id);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo eliminar el tipo de licencia.";
      setError(msg);
    } finally {
      setDeleting(null);
    }
  };

  const openEdit = (tipo: TipoLicencia) => { setEditing(tipo); setShowModal(true); };
  const openNew = () => { setEditing(null); setShowModal(true); };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>
              Tipos de licencias
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
              Configurá los tipos de licencia disponibles para los colaboradores
            </p>
          </div>
          <Button onClick={openNew} className="flex items-center gap-2">
            <Plus size={16} />
            Nuevo tipo
          </Button>
        </div>

        {error && <ErrorBanner message={error} onRetry={load} />}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-content-secondary)", fontSize: 13 }}>
            Cargando…
          </div>
        ) : tipos.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin tipos de licencia"
            description="Creá el primer tipo de licencia para que los colaboradores puedan solicitarlas."
          />
        ) : (
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs font-medium uppercase tracking-wide"
                  style={{
                    borderBottom: "1px solid var(--color-surface-border)",
                    color: "var(--color-content-secondary)",
                    background: "var(--color-surface-app)",
                  }}
                >
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3 hidden md:table-cell">Descripción</th>
                  <th className="px-4 py-3 text-center">Días máx.</th>
                  <th className="px-4 py-3 text-center hidden sm:table-cell">Certificado</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-surface-border)" }}>
                {tipos.map((tipo) => (
                  <tr key={tipo.id} className="hover:bg-[--color-surface-app] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--color-content-secondary)" }}>
                      {tipo.codigo}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--color-content-primary)" }}>
                      {tipo.nombre}
                      {!tipo.tenant_id && (
                        <span style={{
                          marginLeft: 6, fontSize: 10, fontWeight: 600, padding: "1px 6px",
                          borderRadius: 10, background: "var(--color-primary-light)",
                          color: "var(--color-primary)",
                        }}>Global</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell" style={{ color: "var(--color-content-secondary)" }}>
                      {tipo.descripcion || "—"}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: "var(--color-content-primary)" }}>
                      {tipo.dias_maximos != null ? tipo.dias_maximos : "Ilimitado"}
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span
                        className="text-xs rounded-full px-2 py-0.5 font-medium"
                        style={{
                          background: tipo.requiere_certificado ? "var(--color-primary-light)" : "var(--color-surface-empty)",
                          color: tipo.requiere_certificado ? "var(--color-primary)" : "var(--color-content-disabled)",
                        }}
                      >
                        {tipo.requiere_certificado ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="text-xs rounded-full px-2 py-0.5 font-medium"
                        style={{
                          background: tipo.is_active ? "var(--color-state-present-bg, #f0fdf4)" : "var(--color-surface-empty)",
                          color: tipo.is_active ? "var(--color-state-present)" : "var(--color-content-disabled)",
                        }}
                      >
                        {tipo.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(tipo)}
                          className="p-1.5 rounded-lg hover:bg-[--color-surface-app] transition-colors"
                          aria-label="Editar"
                        >
                          <Pencil size={14} style={{ color: "var(--color-content-secondary)" }} />
                        </button>
                        {tipo.tenant_id && (
                          <button
                            onClick={() => handleDelete(tipo)}
                            disabled={deleting === tipo.id}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                            aria-label="Eliminar"
                          >
                            <Trash2 size={14} style={{ color: deleting === tipo.id ? "var(--color-content-disabled)" : "#ef4444" }} />
                          </button>
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

      {showModal && (
        <TipoLicenciaModal
          editing={editing}
          saving={saving}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </AdminLayout>
  );
}
