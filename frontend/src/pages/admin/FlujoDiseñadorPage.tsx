import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, X, ChevronDown, AlertTriangle } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { flujoAprobacionService } from "../../services/flujoAprobacionService";
import type { DepartamentoOption, PasoFlujoCreate, FlujoAprobacionOut } from "../../services/flujoAprobacionService";

const ROL_OPTIONS = [
  { value: "rrhh", label: "RR.HH." },
  { value: "servicio_medico", label: "Servicio Médico" },
  { value: "admin_empresa", label: "Administrador de Empresa" },
] as const;

const EMPTY_PASO: PasoFlujoCreate = {
  orden: 1,
  nombre: "",
  tipo_aprobador: "rol",
  rol_aprobador: "rrhh",
  requiere_comentario: false,
  tipo_accion: "aprobar",
};

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[--color-primary] transition";

const inputStyle = {
  borderColor: "var(--color-surface-border)",
  color: "var(--color-content-primary)",
  background: "var(--color-surface-app)",
};

function PasoCard({
  paso,
  index,
  total,
  departamentos,
  onChange,
  onRemove,
}: {
  paso: PasoFlujoCreate;
  index: number;
  total: number;
  departamentos: DepartamentoOption[];
  onChange: (p: PasoFlujoCreate) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof PasoFlujoCreate>(key: K, val: PasoFlujoCreate[K]) =>
    onChange({ ...paso, [key]: val });

  const switchTipo = (tipo: "rol" | "departamento") => {
    if (tipo === "rol") {
      onChange({ ...paso, tipo_aprobador: "rol", rol_aprobador: "rrhh", departamento_id: undefined });
    } else {
      onChange({ ...paso, tipo_aprobador: "departamento", departamento_id: departamentos[0]?.id, rol_aprobador: undefined });
    }
  };

  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-4"
      style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: "var(--color-primary)" }}
        >
          Paso {index + 1}
        </span>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs transition hover:bg-red-50 hover:text-red-600"
            style={{ color: "var(--color-content-secondary)", background: "none", border: "none", cursor: "pointer" }}
          >
            <X size={12} /> Eliminar
          </button>
        )}
      </div>

      {/* Nombre */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
          Nombre del paso
        </label>
        <input
          required
          value={paso.nombre}
          onChange={e => set("nombre", e.target.value)}
          placeholder="Ej: Aprobación Jefe de Área"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* Tipo de aprobador */}
      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
          Aprobador
        </label>
        <div className="flex gap-5">
          {(["rol", "departamento"] as const).map(tipo => (
            <label key={tipo} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "var(--color-content-primary)" }}>
              <input
                type="radio"
                checked={paso.tipo_aprobador === tipo}
                onChange={() => switchTipo(tipo)}
              />
              {tipo === "rol" ? "Por rol del sistema" : "Por departamento"}
            </label>
          ))}
        </div>

        {paso.tipo_aprobador === "rol" && (
          <select
            value={paso.rol_aprobador}
            onChange={e => set("rol_aprobador", e.target.value as PasoFlujoCreate["rol_aprobador"])}
            className={inputClass}
            style={inputStyle}
          >
            {ROL_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        )}

        {paso.tipo_aprobador === "departamento" && (
          departamentos.length === 0
            ? <p className="text-xs" style={{ color: "var(--color-content-disabled)" }}>No hay departamentos activos.</p>
            : (
              <select
                value={paso.departamento_id}
                onChange={e => set("departamento_id", e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                {departamentos.map(d => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            )
        )}
      </div>

      {/* SLA + comentario */}
      <div className="flex flex-wrap items-end gap-5">
        <div className="flex flex-col gap-1 w-40">
          <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
            SLA (horas hábiles)
          </label>
          <input
            type="number"
            min={1}
            value={paso.sla_horas ?? ""}
            onChange={e => set("sla_horas", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Sin SLA"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        {/* Tipo de acción */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium" style={{ color: "var(--color-content-secondary)" }}>
            Acción del aprobador
          </span>
          <div className="flex gap-2 flex-wrap">
            {(["aprobar", "solo_ver", "derivar"] as const).map(accion => (
              <label key={accion} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name={`tipo_accion_${paso.orden}`}
                  value={accion}
                  checked={paso.tipo_accion === accion}
                  onChange={() => set("tipo_accion", accion)}
                  className="w-3.5 h-3.5"
                />
                <span className="text-xs" style={{ color: "var(--color-content-primary)" }}>
                  {accion === "aprobar" ? "Aprobar / Rechazar" : accion === "solo_ver" ? "Solo notificar" : "Derivar al siguiente"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer pb-0.5">
          <input
            type="checkbox"
            checked={paso.requiere_comentario}
            onChange={e => set("requiere_comentario", e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm" style={{ color: "var(--color-content-primary)" }}>
            Comentario obligatorio al aprobar
          </span>
        </label>
      </div>
    </div>
  );
}

export function FlujoDiseñadorPage() {
  const { flujoId } = useParams<{ flujoId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = Boolean(flujoId);

  const tipoIdParam = searchParams.get("tipo") ?? "";
  const tipoNombreParam = searchParams.get("nombre") ?? "";

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pasos, setPasos] = useState<PasoFlujoCreate[]>([{ ...EMPTY_PASO }]);
  const [departamentos, setDepartamentos] = useState<DepartamentoOption[]>([]);
  const [flujoOriginal, setFlujoOriginal] = useState<FlujoAprobacionOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    flujoAprobacionService.getDepartamentos().then(setDepartamentos).catch(() => {});

    if (isEditing && flujoId) {
      setLoading(true);
      flujoAprobacionService.get(flujoId)
        .then(f => {
          setFlujoOriginal(f);
          setNombre(f.nombre);
          setDescripcion(f.descripcion ?? "");
          setPasos(f.pasos.map(p => ({
            orden: p.orden,
            nombre: p.nombre,
            tipo_aprobador: p.tipo_aprobador,
            rol_aprobador: p.rol_aprobador as PasoFlujoCreate["rol_aprobador"],
            departamento_id: p.departamento_id ?? undefined,
            sla_horas: p.sla_horas ?? undefined,
            requiere_comentario: p.requiere_comentario,
            tipo_accion: p.tipo_accion ?? "aprobar",
          })));
        })
        .catch(() => setError("No se pudo cargar el flujo."))
        .finally(() => setLoading(false));
    }
  }, [isEditing, flujoId]);

  function addPaso() {
    if (pasos.length >= 5) return;
    setPasos(prev => [...prev, { ...EMPTY_PASO, orden: prev.length + 1 }]);
  }

  function removePaso(i: number) {
    setPasos(prev => prev
      .filter((_, idx) => idx !== i)
      .map((p, idx) => ({ ...p, orden: idx + 1 }))
    );
  }

  function updatePaso(i: number, p: PasoFlujoCreate) {
    setPasos(prev => prev.map((old, idx) => idx === i ? { ...p, orden: idx + 1 } : old));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError("El nombre del flujo es obligatorio."); return; }
    setSaving(true);
    setError(null);
    try {
      if (isEditing && flujoId) {
        await flujoAprobacionService.update(flujoId, { nombre, descripcion: descripcion || undefined, pasos });
      } else {
        await flujoAprobacionService.create({
          tipo_licencia_id: tipoIdParam,
          nombre,
          descripcion: descripcion || undefined,
          pasos,
        });
      }
      navigate("/admin/configuracion/aprobaciones");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar el flujo.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const tipoNombre = flujoOriginal
    ? (flujoOriginal.tipo_licencia_nombre ?? "")
    : tipoNombreParam;

  return (
    <AdminLayout>
      <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-2xl">

        {/* Back */}
        <button
          type="button"
          onClick={() => navigate("/admin/configuracion/aprobaciones")}
          className="flex items-center gap-1.5 text-sm self-start hover:opacity-70 transition-opacity"
          style={{ color: "var(--color-content-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <ArrowLeft size={14} /> Flujos de aprobación
        </button>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>
            {isEditing ? "Editar flujo" : "Configurar flujo"}
          </h1>
          {tipoNombre && (
            <p className="text-sm mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
              Tipo de licencia: <strong style={{ color: "var(--color-content-primary)" }}>{tipoNombre}</strong>
            </p>
          )}
        </div>

        {error && <ErrorBanner message={error} />}

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size={28} />
          </div>
        ) : (
          <>
            {/* Info del flujo */}
            <div
              className="rounded-xl border p-5 flex flex-col gap-4"
              style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
            >
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-content-disabled)" }}>
                Información del flujo
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                  Nombre
                </label>
                <input
                  required
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Jefe de Área + Médico + RRHH"
                  maxLength={100}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                  Descripción{" "}
                  <span className="text-xs font-normal" style={{ color: "var(--color-content-secondary)" }}>(opcional)</span>
                </label>
                <textarea
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Descripción del flujo…"
                  rows={2}
                  className={inputClass}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            </div>

            {/* Pasos */}
            {pasos.map((paso, i) => (
              <div key={i}>
                <PasoCard
                  paso={paso}
                  index={i}
                  total={pasos.length}
                  departamentos={departamentos}
                  onChange={p => updatePaso(i, p)}
                  onRemove={() => removePaso(i)}
                />
                {i < pasos.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ChevronDown size={18} style={{ color: "var(--color-content-disabled)" }} />
                  </div>
                )}
              </div>
            ))}

            {/* Agregar paso */}
            {pasos.length < 5 && (
              <button
                type="button"
                onClick={addPaso}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm transition-colors"
                style={{
                  borderColor: "var(--color-surface-border)",
                  color: "var(--color-content-secondary)",
                  background: "var(--color-surface-app)",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.color = "var(--color-primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-surface-border)"; e.currentTarget.style.color = "var(--color-content-secondary)"; }}
              >
                <Plus size={15} /> Agregar paso
              </button>
            )}

            {/* Warning edición */}
            {isEditing && (
              <div
                className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
                style={{ background: "#fefce8", borderColor: "#fde68a" }}
              >
                <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: "#ca8a04" }} />
                <p style={{ color: "#92400e", lineHeight: 1.5 }}>
                  Los cambios en el flujo no afectarán solicitudes en curso.
                  Solo se aplicarán a nuevas solicitudes.
                </p>
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar flujo"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/admin/configuracion/aprobaciones")}
              >
                Cancelar
              </Button>
            </div>
          </>
        )}
      </form>
    </AdminLayout>
  );
}
