import { useState } from "react";
import { FileText, Plus, X, Pencil } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";

interface TipoLicencia {
  id: string;
  nombre: string;
  descripcion: string;
  dias_maximos: number | null;
  requiere_certificado: boolean;
  activo: boolean;
}

const MOCK_TIPOS: TipoLicencia[] = [
  { id: "1", nombre: "Vacaciones", descripcion: "Días de descanso anuales remunerados", dias_maximos: 14, requiere_certificado: false, activo: true },
  { id: "2", nombre: "Enfermedad", descripcion: "Licencia por enfermedad con certificado médico", dias_maximos: 30, requiere_certificado: true, activo: true },
  { id: "3", nombre: "Maternidad", descripcion: "Licencia por maternidad según convenio", dias_maximos: 90, requiere_certificado: true, activo: true },
  { id: "4", nombre: "Paternidad", descripcion: "Licencia por paternidad", dias_maximos: 5, requiere_certificado: false, activo: true },
  { id: "5", nombre: "Estudio", descripcion: "Días para rendir exámenes", dias_maximos: 10, requiere_certificado: true, activo: false },
];

interface FormState {
  nombre: string;
  descripcion: string;
  dias_maximos: string;
  requiere_certificado: boolean;
  activo: boolean;
}

const emptyForm: FormState = {
  nombre: "",
  descripcion: "",
  dias_maximos: "",
  requiere_certificado: false,
  activo: true,
};

interface ModalProps {
  editing: TipoLicencia | null;
  onClose: () => void;
  onSave: (data: FormState) => void;
}

function TipoLicenciaModal({ editing, onClose, onSave }: ModalProps) {
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          nombre: editing.nombre,
          descripcion: editing.descripcion,
          dias_maximos: editing.dias_maximos != null ? String(editing.dias_maximos) : "",
          requiere_certificado: editing.requiere_certificado,
          activo: editing.activo,
        }
      : emptyForm
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const inputClass =
    "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 transition";

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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Vacaciones"
              className={inputClass}
              style={{
                borderColor: "var(--color-surface-border)",
                color: "var(--color-content-primary)",
                background: "var(--color-surface-app)",
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Descripción
            </label>
            <textarea
              rows={2}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Descripción breve"
              className={inputClass}
              style={{
                borderColor: "var(--color-surface-border)",
                color: "var(--color-content-primary)",
                background: "var(--color-surface-app)",
                resize: "none",
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Días máximos <span className="text-xs font-normal" style={{ color: "var(--color-content-secondary)" }}>(dejar vacío = ilimitado)</span>
            </label>
            <input
              type="number"
              min={1}
              value={form.dias_maximos}
              onChange={(e) => setForm((f) => ({ ...f, dias_maximos: e.target.value }))}
              placeholder="30"
              className={inputClass}
              style={{
                borderColor: "var(--color-surface-border)",
                color: "var(--color-content-primary)",
                background: "var(--color-surface-app)",
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requiere_certificado}
                onChange={(e) => setForm((f) => ({ ...f, requiere_certificado: e.target.checked }))}
                className="w-4 h-4 rounded"
                style={{ accentColor: "var(--color-primary)" }}
              />
              <span className="text-sm" style={{ color: "var(--color-content-primary)" }}>
                Requiere certificado médico
              </span>
            </label>
            {editing && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: "var(--color-primary)" }}
                />
                <span className="text-sm" style={{ color: "var(--color-content-primary)" }}>
                  Activo
                </span>
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              {editing ? "Guardar cambios" : "Crear tipo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminTiposLicenciasPage() {
  const [tipos, setTipos] = useState<TipoLicencia[]>(MOCK_TIPOS);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TipoLicencia | null>(null);

  const handleSave = (data: FormState) => {
    if (editing) {
      setTipos((prev) =>
        prev.map((t) =>
          t.id === editing.id
            ? {
                ...t,
                ...data,
                dias_maximos: data.dias_maximos ? Number(data.dias_maximos) : null,
              }
            : t
        )
      );
    } else {
      setTipos((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          ...data,
          dias_maximos: data.dias_maximos ? Number(data.dias_maximos) : null,
        },
      ]);
    }
    setShowModal(false);
    setEditing(null);
  };

  const openEdit = (tipo: TipoLicencia) => {
    setEditing(tipo);
    setShowModal(true);
  };

  const openNew = () => {
    setEditing(null);
    setShowModal(true);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
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

        {/* Lista */}
        {tipos.length === 0 ? (
          <EmptyState
            icon={<FileText size={40} />}
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
                  <tr
                    key={tipo.id}
                    className="hover:bg-[--color-surface-app] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--color-content-primary)" }}>
                      {tipo.nombre}
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
                          background: tipo.requiere_certificado
                            ? "var(--color-primary-light)"
                            : "var(--color-surface-empty)",
                          color: tipo.requiere_certificado
                            ? "var(--color-primary)"
                            : "var(--color-content-disabled)",
                        }}
                      >
                        {tipo.requiere_certificado ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="text-xs rounded-full px-2 py-0.5 font-medium"
                        style={{
                          background: tipo.activo
                            ? "var(--color-state-present-bg, #f0fdf4)"
                            : "var(--color-surface-empty)",
                          color: tipo.activo
                            ? "var(--color-state-present)"
                            : "var(--color-content-disabled)",
                        }}
                      >
                        {tipo.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(tipo)}
                        className="p-1.5 rounded-lg hover:bg-[--color-surface-app] transition-colors"
                        aria-label="Editar"
                      >
                        <Pencil size={14} style={{ color: "var(--color-content-secondary)" }} />
                      </button>
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
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </AdminLayout>
  );
}
