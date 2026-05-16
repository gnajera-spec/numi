import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, X, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import {
  flujoAprobacionService,
  DepartamentoOption,
  PasoFlujoCreate,
  FlujoAprobacionOut,
} from "../../services/flujoAprobacionService";

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
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--color-text-primary)",
  background: "var(--color-bg-app)",
  outline: "none",
  boxSizing: "border-box",
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
    <div style={{
      background: "var(--color-bg-card)",
      border: "1px solid var(--color-border)",
      borderRadius: 14, padding: 20,
      display: "flex", flexDirection: "column", gap: 16,
    }}>
      {/* Step header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase",
          color: "var(--color-primary)",
        }}>
          Paso {index + 1}
        </span>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "none", border: "none", cursor: "pointer", padding: "4px 8px",
              borderRadius: 6, fontSize: 12, color: "var(--color-text-secondary)",
            }}
          >
            <X size={13} /> Eliminar
          </button>
        )}
      </div>

      {/* Nombre */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Nombre del paso</label>
        <input
          required
          value={paso.nombre}
          onChange={e => set("nombre", e.target.value)}
          placeholder="Ej: Aprobación Jefe de Área"
          style={inputStyle}
        />
      </div>

      {/* Tipo de aprobador */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Aprobador</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["rol", "departamento"] as const).map(tipo => (
            <label key={tipo} style={{
              display: "flex", alignItems: "center", gap: 6,
              cursor: "pointer", fontSize: 13, color: "var(--color-text-primary)",
            }}>
              <input
                type="radio"
                checked={paso.tipo_aprobador === tipo}
                onChange={() => switchTipo(tipo)}
                style={{ accentColor: "var(--color-primary)" }}
              />
              {tipo === "rol" ? "Por rol del sistema" : "Por departamento"}
            </label>
          ))}
        </div>

        {paso.tipo_aprobador === "rol" && (
          <select
            value={paso.rol_aprobador}
            onChange={e => set("rol_aprobador", e.target.value as PasoFlujoCreate["rol_aprobador"])}
            style={inputStyle}
          >
            {ROL_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        )}

        {paso.tipo_aprobador === "departamento" && (
          departamentos.length === 0
            ? <p style={{ fontSize: 12, color: "var(--color-text-disabled)" }}>No hay departamentos activos.</p>
            : (
              <select
                value={paso.departamento_id}
                onChange={e => set("departamento_id", e.target.value)}
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
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 160 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
            SLA (horas hábiles)
          </label>
          <input
            type="number"
            min={1}
            value={paso.sla_horas ?? ""}
            onChange={e => set("sla_horas", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Sin SLA"
            style={inputStyle}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingBottom: 2 }}>
          <input
            type="checkbox"
            checked={paso.requiere_comentario}
            onChange={e => set("requiere_comentario", e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--color-primary)" }}
          />
          <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>
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
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 680 }}>

        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate("/admin/configuracion/aprobaciones")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontSize: 13, color: "var(--color-text-secondary)",
            alignSelf: "flex-start",
          }}
        >
          <ArrowLeft size={14} /> Flujos de aprobación
        </button>

        {/* Header */}
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)" }}>
            {isEditing ? "Editar flujo" : "Configurar flujo"}
          </h1>
          {tipoNombre && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
              Tipo de licencia: <strong>{tipoNombre}</strong>
            </p>
          )}
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>
            Cargando…
          </div>
        ) : (
          <>
            {/* Nombre y descripción */}
            <div style={{
              background: "var(--color-bg-card)", border: "1px solid var(--color-border)",
              borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 16,
            }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--color-text-disabled)" }}>
                Información del flujo
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Nombre</label>
                <input
                  required
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Jefe de Área + Médico + RRHH"
                  maxLength={100}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Descripción (opcional)</label>
                <textarea
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Descripción del flujo…"
                  rows={2}
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
                  <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
                    <ChevronDown size={18} style={{ color: "var(--color-text-disabled)" }} />
                  </div>
                )}
              </div>
            ))}

            {pasos.length < 5 && (
              <button
                type="button"
                onClick={addPaso}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 0", borderRadius: 10,
                  border: "2px dashed var(--color-border)",
                  background: "var(--color-bg-subtle)",
                  cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)",
                }}
              >
                <Plus size={15} /> Agregar paso
              </button>
            )}

            {/* Warning */}
            {isEditing && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "12px 14px", borderRadius: 10,
                background: "#fefce8", border: "1px solid #fde68a",
              }}>
                <AlertTriangle size={15} style={{ color: "#ca8a04", flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                  Los cambios en el flujo no afectarán solicitudes en curso.
                  Solo se aplicarán a nuevas solicitudes.
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 12 }}>
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
