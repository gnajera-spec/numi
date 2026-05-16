import { useEffect, useState, type FormEvent } from "react";
import { Plus, X, ClipboardList, CheckSquare, Square, AlertCircle, Trash2 } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";
import { licenciasService } from "../../services/licenciasService";
import type { TipoLicencia } from "../../types";

/* ── helpers ─────────────────────────────────────────────────────────────── */
function Badge({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <span
      className="text-xs rounded-full px-2 py-0.5 font-medium"
      style={{
        background: active ? "var(--color-state-present-bg, #f0fdf4)" : "var(--color-surface-empty)",
        color: active ? "var(--color-state-present, #16a34a)" : "var(--color-content-disabled)",
      }}
    >
      {children}
    </span>
  );
}

/* ── tipos row ───────────────────────────────────────────────────────────── */
function TipoRow({ tipo, onDelete }: { tipo: TipoLicencia; onDelete: (id: string, nombre: string) => void }) {
  return (
    <tr
      className="border-b transition-colors hover:bg-[var(--color-surface-empty)]"
      style={{ borderColor: "var(--color-surface-border)" }}
    >
      <td className="px-4 py-3">
        <span
          className="text-xs font-mono font-bold px-2 py-0.5 rounded"
          style={{ background: "var(--color-surface-empty)", color: "var(--color-primary)" }}
        >
          {tipo.codigo}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
        {tipo.nombre}
      </td>
      <td className="px-4 py-3 text-center">
        {tipo.requiere_certificado
          ? <CheckSquare size={16} className="mx-auto" style={{ color: "var(--color-primary)" }} />
          : <Square size={16} className="mx-auto" style={{ color: "var(--color-content-disabled)" }} />}
      </td>
      <td className="px-4 py-3 text-sm text-center" style={{ color: "var(--color-content-secondary)" }}>
        {tipo.max_dias_por_anio ?? tipo.dias_maximos ?? "—"}
      </td>
      <td className="px-4 py-3 text-center">
        <Badge active={tipo.tenant_id !== null}>{tipo.tenant_id === null ? "Global" : "Personalizado"}</Badge>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onDelete(tipo.id, tipo.nombre)}
          className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
          title="Eliminar tipo"
          style={{ color: "var(--color-content-disabled)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#dc2626")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--color-content-disabled)")}
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}

/* ── modal nuevo tipo ────────────────────────────────────────────────────── */
interface NuevoTipoModalProps {
  onClose: () => void;
  onCreated: (t: TipoLicencia) => void;
}
function NuevoTipoModal({ onClose, onCreated }: NuevoTipoModalProps) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [requiereCert, setRequiereCert] = useState(false);
  const [diasMax, setDiasMax] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await licenciasService.createTipo({
        codigo: codigo.toUpperCase(),
        nombre,
        descripcion: descripcion || undefined,
        requiere_certificado: requiereCert,
        dias_maximos: diasMax ? Number(diasMax) : undefined,
      });
      onCreated(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl p-6 flex flex-col gap-5"
        style={{ background: "var(--color-surface-card)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: "var(--color-content-primary)" }}>
            Nuevo tipo de licencia
          </h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-[var(--color-surface-empty)]">
            <X size={18} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
            style={{ background: "var(--color-state-error-bg, #fef2f2)", color: "var(--color-state-error, #dc2626)" }}>
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Código */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Código <span style={{ color: "var(--color-primary)" }}>*</span>
            </label>
            <input
              value={codigo}
              onChange={e => setCodigo(e.target.value.toUpperCase())}
              required
              maxLength={10}
              placeholder="ej. LIC-ANT"
              className="px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2"
              style={{
                borderColor: "var(--color-surface-border)",
                background: "var(--color-surface-empty)",
                color: "var(--color-content-primary)",
              }}
            />
            <p className="text-xs" style={{ color: "var(--color-content-disabled)" }}>
              Solo letras mayúsculas, números y guiones. Máx. 10 caracteres.
            </p>
          </div>

          {/* Nombre */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Nombre <span style={{ color: "var(--color-primary)" }}>*</span>
            </label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
              placeholder="ej. Licencia por antigüedad"
              className="px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2"
              style={{
                borderColor: "var(--color-surface-border)",
                background: "var(--color-surface-empty)",
                color: "var(--color-content-primary)",
              }}
            />
          </div>

          {/* Descripción */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Descripción opcional..."
              className="px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 resize-none"
              style={{
                borderColor: "var(--color-surface-border)",
                background: "var(--color-surface-empty)",
                color: "var(--color-content-primary)",
              }}
            />
          </div>

          {/* Días máximos */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Días máximos por año
            </label>
            <input
              type="number"
              value={diasMax}
              onChange={e => setDiasMax(e.target.value)}
              min={1}
              max={365}
              placeholder="Sin límite"
              className="px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 w-36"
              style={{
                borderColor: "var(--color-surface-border)",
                background: "var(--color-surface-empty)",
                color: "var(--color-content-primary)",
              }}
            />
          </div>

          {/* Requiere certificado */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={requiereCert}
              onChange={e => setRequiereCert(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: "var(--color-primary)" }}
            />
            <span className="text-sm" style={{ color: "var(--color-content-primary)" }}>
              Requiere certificado médico / documentación
            </span>
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-[var(--color-surface-empty)]"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-secondary)" }}
            >
              Cancelar
            </button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Crear tipo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ── modal confirmar borrado ─────────────────────────────────────────────── */
interface ConfirmDeleteModalProps {
  nombre: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
  error?: string | null;
}
function ConfirmDeleteModal({ nombre, onConfirm, onCancel, deleting, error }: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl p-6 flex flex-col gap-5"
        style={{ background: "var(--color-surface-card)" }}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-full p-2" style={{ background: "#fef2f2" }}>
            <Trash2 size={18} style={{ color: "#dc2626" }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--color-content-primary)" }}>
              Eliminar tipo de licencia
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--color-content-secondary)" }}>
              ¿Confirmás que querés eliminar <strong>{nombre}</strong>?
              Esta acción no puede deshacerse.
            </p>
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
            style={{ background: "#fef2f2", color: "#dc2626" }}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-[var(--color-surface-empty)]"
            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-secondary)" }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm rounded-lg font-semibold transition-colors"
            style={{ background: "#dc2626", color: "#fff", opacity: deleting ? 0.6 : 1 }}
          >
            {deleting ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────────── */
export function AdminTiposLicenciasPage() {
  const [tipos, setTipos] = useState<TipoLicencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nombre: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    licenciasService.listTipos()
      .then(setTipos)
      .catch(() => setError("No se pudieron cargar los tipos de licencia."))
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(t: TipoLicencia) {
    setTipos(prev => [...prev, t]);
    setShowModal(false);
  }

  function requestDelete(id: string, nombre: string) {
    setConfirmDelete({ id, nombre });
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await licenciasService.deleteTipo(confirmDelete.id);
      setTipos(prev => prev.filter(t => t.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "No se pudo eliminar el tipo.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-content-primary)" }}>
              Tipos de licencias
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
              Parametrizá los tipos de licencias administrativas disponibles para tu empresa.
            </p>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nuevo tipo
          </Button>
        </div>

        {/* Table */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}
        >
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-sm" style={{ color: "var(--color-content-secondary)" }}>
              <AlertCircle size={32} style={{ color: "var(--color-state-error, #dc2626)" }} />
              {error}
            </div>
          ) : tipos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <ClipboardList size={40} style={{ color: "var(--color-content-disabled)" }} />
              <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
                No hay tipos de licencia configurados aún.
              </p>
              <Button onClick={() => setShowModal(true)}>
                <Plus size={15} /> Crear el primero
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid var(--color-surface-border)`, background: "var(--color-surface-empty)" }}>
                  {["Código", "Nombre", "Requiere cert.", "Días máx./año", "Tipo", ""].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--color-content-secondary)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tipos.map(t => <TipoRow key={t.id} tipo={t} onDelete={requestDelete} />)}
              </tbody>
            </table>
          )}
        </div>

        {/* Info */}
        <p className="text-xs" style={{ color: "var(--color-content-disabled)" }}>
          Los tipos marcados como <strong>Global</strong> son provistos por NUMI y no pueden modificarse.
          Los tipos <strong>Personalizados</strong> son propios de tu empresa.
        </p>
      </div>

      {showModal && (
        <NuevoTipoModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
      {confirmDelete && (
        <ConfirmDeleteModal
          nombre={confirmDelete.nombre}
          onConfirm={handleDelete}
          onCancel={() => { setConfirmDelete(null); setDeleteError(null); }}
          deleting={deleting}
          error={deleteError}
        />
      )}
    </AdminLayout>
  );
}
