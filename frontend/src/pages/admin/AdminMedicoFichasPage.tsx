import { useEffect, useState, useCallback, type FormEvent } from "react";
import { Stethoscope, Search, X, Plus, Syringe, ClipboardList, ShieldCheck } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { medicoService } from "../../services/medicoService";
import { organizacionService } from "../../services/organizacionService";
import type {
  FichaMedicaSummary,
  FichaMedica,
  ExamenMedico,
  Vacunacion,
  AptitudLaboral,
  Puesto,
} from "../../types";

// ── helpers ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-lg rounded-xl border p-6 flex flex-col gap-4 my-auto"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" style={{ color: "var(--color-content-secondary)" }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldRow({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>{label}</label>
      {children}
    </div>
  );
}

function inputCls() {
  return "rounded-lg border px-3 py-2 text-sm outline-none";
}

function inputStyle() {
  return { borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" };
}

const tipoExamenLabel: Record<string, string> = {
  ingreso: "Ingreso", periodico: "Periódico", post_ausencia: "Post-ausencia", egreso: "Egreso",
};

const aptitudBadge: Record<string, { label: string; color: string }> = {
  apto: { label: "Apto", color: "var(--color-state-present)" },
  apto_con_restricciones: { label: "Con restricciones", color: "var(--color-state-pending)" },
  no_apto: { label: "No apto", color: "var(--color-state-absent)" },
};

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-AR");
}

// ── detail tabs ────────────────────────────────────────────────────────────────

type DetailTab = "ficha" | "examenes" | "aptitudes" | "vacunaciones";

function FichaTab({ userId, nombre }: { userId: string; nombre: string }) {
  const [ficha, setFicha] = useState<FichaMedica | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ grupo_sanguineo: "", factor_rh: "", observaciones: "", alergias: "", condiciones: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await medicoService.getFicha(userId);
      setFicha(data);
      setForm({
        grupo_sanguineo: data.grupo_sanguineo ?? "",
        factor_rh: data.factor_rh ?? "",
        observaciones: data.observaciones ?? "",
        alergias: data.alergias?.map((a) => a.nombre).join(", ") ?? "",
        condiciones: data.condiciones?.map((c) => c.nombre).join(", ") ?? "",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("404") || msg.includes("no encontrada")) {
        setFicha(null);
      } else {
        setError(msg || "Error al cargar ficha");
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await medicoService.updateFicha(userId, {
        grupo_sanguineo: form.grupo_sanguineo || undefined,
        factor_rh: form.factor_rh || undefined,
        observaciones: form.observaciones || undefined,
        alergias: form.alergias ? form.alergias.split(",").map((s) => ({ nombre: s.trim() })).filter((a) => a.nombre) : undefined,
        condiciones: form.condiciones ? form.condiciones.split(",").map((s) => ({ nombre: s.trim() })).filter((c) => c.nombre) : undefined,
      });
      setEditing(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  if (!ficha && !editing) {
    return (
      <div className="text-center py-6">
        <p className="text-sm mb-3" style={{ color: "var(--color-content-secondary)" }}>
          {nombre} no tiene ficha médica registrada.
        </p>
        <Button onClick={() => setEditing(true)}><Plus size={14} /> Crear ficha</Button>
      </div>
    );
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Grupo sanguíneo" id="gs">
            <select id="gs" value={form.grupo_sanguineo} onChange={(e) => setForm({ ...form, grupo_sanguineo: e.target.value })}
              className={inputCls()} style={inputStyle()}>
              <option value="">—</option>
              {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Factor RH" id="rh">
            <select id="rh" value={form.factor_rh} onChange={(e) => setForm({ ...form, factor_rh: e.target.value })}
              className={inputCls()} style={inputStyle()}>
              <option value="">—</option>
              <option value="positivo">Positivo</option>
              <option value="negativo">Negativo</option>
            </select>
          </FieldRow>
        </div>
        <FieldRow label="Alergias (separadas por coma)" id="alg">
          <input id="alg" className={inputCls()} style={inputStyle()} value={form.alergias}
            onChange={(e) => setForm({ ...form, alergias: e.target.value })} placeholder="Penicilina, Ibuprofeno" />
        </FieldRow>
        <FieldRow label="Condiciones preexistentes (separadas por coma)" id="cond">
          <input id="cond" className={inputCls()} style={inputStyle()} value={form.condiciones}
            onChange={(e) => setForm({ ...form, condiciones: e.target.value })} placeholder="Hipertensión, Diabetes" />
        </FieldRow>
        <FieldRow label="Observaciones" id="obs">
          <textarea id="obs" rows={3} className={inputCls()} style={inputStyle()} value={form.observaciones}
            onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
        </FieldRow>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => { setEditing(false); if (!ficha) load(); }}>Cancelar</Button>
          <Button type="submit" loading={saving}>Guardar</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Grupo sanguíneo", value: ficha?.grupo_sanguineo },
          { label: "Factor RH", value: ficha?.factor_rh },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg p-3" style={{ background: "var(--color-surface-empty)" }}>
            <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>{label}</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: "var(--color-content-primary)" }}>{value ?? "—"}</p>
          </div>
        ))}
      </div>
      {(ficha?.alergias?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--color-content-secondary)" }}>Alergias</p>
          <div className="flex flex-wrap gap-1">
            {ficha!.alergias!.map((a, i) => (
              <span key={i} className="text-xs rounded-full px-2 py-0.5"
                style={{ background: "#fef2f2", color: "var(--color-state-absent)" }}>{a.nombre}</span>
            ))}
          </div>
        </div>
      )}
      {(ficha?.condiciones?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--color-content-secondary)" }}>Condiciones</p>
          <div className="flex flex-wrap gap-1">
            {ficha!.condiciones!.map((c, i) => (
              <span key={i} className="text-xs rounded-full px-2 py-0.5"
                style={{ background: "var(--color-surface-empty)", color: "var(--color-content-secondary)" }}>{c.nombre}</span>
            ))}
          </div>
        </div>
      )}
      {ficha?.observaciones && (
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--color-content-secondary)" }}>Observaciones</p>
          <p className="text-sm" style={{ color: "var(--color-content-primary)" }}>{ficha.observaciones}</p>
        </div>
      )}
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setEditing(true)}>Editar</Button>
      </div>
    </div>
  );
}

function ExamenesTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<ExamenMedico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ tipo: "periodico", fecha: "", resultado: "", medico_responsable: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await medicoService.listExamenes(userId)); }
    catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await medicoService.createExamen(userId, {
        tipo: form.tipo, fecha: form.fecha,
        resultado: form.resultado || undefined,
        medico_responsable: form.medico_responsable || undefined,
      });
      setShowModal(false);
      setForm({ tipo: "periodico", fecha: "", resultado: "", medico_responsable: "" });
      load();
    } catch (err) { setFormError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-6"><Spinner /></div>;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button onClick={() => setShowModal(true)}><Plus size={14} /> Nuevo examen</Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: "var(--color-content-secondary)" }}>Sin exámenes registrados.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((ex) => (
            <div key={ex.id} className="rounded-lg border px-3 py-2 flex items-start justify-between"
              style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
              <div>
                <span className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                  {tipoExamenLabel[ex.tipo] ?? ex.tipo}
                </span>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                  {formatDate(ex.fecha)}{ex.medico_responsable && ` · Dr/a. ${ex.medico_responsable}`}
                </p>
                {ex.resultado && <p className="text-xs mt-1" style={{ color: "var(--color-content-primary)" }}>{ex.resultado}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {showModal && (
        <Modal title="Nuevo examen" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            {formError && <ErrorBanner message={formError} />}
            <FieldRow label="Tipo *" id="et">
              <select id="et" required value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className={inputCls()} style={inputStyle()}>
                {Object.entries(tipoExamenLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Fecha *" id="ef">
              <input id="ef" type="date" required value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className={inputCls()} style={inputStyle()} />
            </FieldRow>
            <FieldRow label="Médico responsable" id="em">
              <input id="em" value={form.medico_responsable} onChange={(e) => setForm({ ...form, medico_responsable: e.target.value })}
                className={inputCls()} style={inputStyle()} placeholder="Dr/a. Apellido" />
            </FieldRow>
            <FieldRow label="Resultado" id="er">
              <textarea id="er" rows={2} value={form.resultado} onChange={(e) => setForm({ ...form, resultado: e.target.value })}
                className={inputCls()} style={inputStyle()} />
            </FieldRow>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Registrar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AptitudesTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<AptitudLaboral[]>([]);
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ puesto_id: "", estado: "apto", restricciones: "", fecha_emision: "", fecha_vencimiento: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [apt, pst] = await Promise.all([
        medicoService.listAptitudes(userId),
        organizacionService.listPuestos({ is_active: true }),
      ]);
      setItems(apt);
      setPuestos(pst.items);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await medicoService.createAptitud(userId, {
        puesto_id: form.puesto_id,
        estado: form.estado,
        restricciones: form.restricciones || undefined,
        fecha_emision: form.fecha_emision,
        fecha_vencimiento: form.fecha_vencimiento || undefined,
      });
      setShowModal(false);
      setForm({ puesto_id: "", estado: "apto", restricciones: "", fecha_emision: "", fecha_vencimiento: "" });
      load();
    } catch (err) { setFormError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-6"><Spinner /></div>;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button onClick={() => setShowModal(true)}><Plus size={14} /> Nueva aptitud</Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: "var(--color-content-secondary)" }}>Sin aptitudes registradas.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((apt) => {
            const badge = aptitudBadge[apt.estado] ?? { label: apt.estado, color: "var(--color-content-secondary)" };
            const puesto = puestos.find((p) => p.id === apt.puesto_id);
            return (
              <div key={apt.id} className="rounded-lg border px-3 py-2"
                style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                    {puesto?.nombre ?? apt.puesto_id}
                  </span>
                  <span className="text-xs font-medium rounded-full px-2 py-0.5"
                    style={{ color: badge.color, background: `${badge.color}18` }}>{badge.label}</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                  Emitida {formatDate(apt.fecha_emision)}
                  {apt.fecha_vencimiento && ` · Vence ${formatDate(apt.fecha_vencimiento)}`}
                </p>
                {apt.restricciones && (
                  <p className="text-xs mt-1" style={{ color: "var(--color-state-pending)" }}>Restricciones: {apt.restricciones}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showModal && (
        <Modal title="Nueva aptitud laboral" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            {formError && <ErrorBanner message={formError} />}
            <FieldRow label="Puesto *" id="ap">
              <select id="ap" required value={form.puesto_id} onChange={(e) => setForm({ ...form, puesto_id: e.target.value })}
                className={inputCls()} style={inputStyle()}>
                <option value="">Seleccionar puesto</option>
                {puestos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Estado *" id="ae">
              <select id="ae" required value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}
                className={inputCls()} style={inputStyle()}>
                <option value="apto">Apto</option>
                <option value="apto_con_restricciones">Apto con restricciones</option>
                <option value="no_apto">No apto</option>
              </select>
            </FieldRow>
            {form.estado === "apto_con_restricciones" && (
              <FieldRow label="Restricciones *" id="ar">
                <textarea id="ar" required rows={2} value={form.restricciones}
                  onChange={(e) => setForm({ ...form, restricciones: e.target.value })}
                  className={inputCls()} style={inputStyle()} />
              </FieldRow>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Fecha emisión *" id="aef">
                <input id="aef" type="date" required value={form.fecha_emision}
                  onChange={(e) => setForm({ ...form, fecha_emision: e.target.value })}
                  className={inputCls()} style={inputStyle()} />
              </FieldRow>
              <FieldRow label="Vencimiento" id="afv">
                <input id="afv" type="date" value={form.fecha_vencimiento}
                  onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
                  className={inputCls()} style={inputStyle()} />
              </FieldRow>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Emitir</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function VacunacionesTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<Vacunacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ vacuna: "", fecha: "", lote: "", proxima_dosis: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await medicoService.listVacunaciones(userId)); }
    catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await medicoService.createVacunacion(userId, {
        vacuna: form.vacuna, fecha: form.fecha,
        lote: form.lote || undefined,
        proxima_dosis: form.proxima_dosis || undefined,
      });
      setShowModal(false);
      setForm({ vacuna: "", fecha: "", lote: "", proxima_dosis: "" });
      load();
    } catch (err) { setFormError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-6"><Spinner /></div>;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button onClick={() => setShowModal(true)}><Plus size={14} /> Registrar vacuna</Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: "var(--color-content-secondary)" }}>Sin vacunas registradas.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((v) => (
            <div key={v.id} className="rounded-lg border px-3 py-2"
              style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>{v.vacuna}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                {formatDate(v.fecha)}
                {v.lote && ` · Lote: ${v.lote}`}
                {v.proxima_dosis && ` · Próxima dosis: ${formatDate(v.proxima_dosis)}`}
              </p>
            </div>
          ))}
        </div>
      )}
      {showModal && (
        <Modal title="Registrar vacuna" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            {formError && <ErrorBanner message={formError} />}
            <FieldRow label="Vacuna *" id="vn">
              <input id="vn" required value={form.vacuna} onChange={(e) => setForm({ ...form, vacuna: e.target.value })}
                className={inputCls()} style={inputStyle()} placeholder="Ej: Hepatitis B" />
            </FieldRow>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Fecha *" id="vf">
                <input id="vf" type="date" required value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className={inputCls()} style={inputStyle()} />
              </FieldRow>
              <FieldRow label="Lote" id="vl">
                <input id="vl" value={form.lote} onChange={(e) => setForm({ ...form, lote: e.target.value })}
                  className={inputCls()} style={inputStyle()} />
              </FieldRow>
            </div>
            <FieldRow label="Próxima dosis" id="vpd">
              <input id="vpd" type="date" value={form.proxima_dosis} onChange={(e) => setForm({ ...form, proxima_dosis: e.target.value })}
                className={inputCls()} style={inputStyle()} />
            </FieldRow>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Registrar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── detail modal ───────────────────────────────────────────────────────────────

const detailTabs: { id: DetailTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "ficha", label: "Ficha", icon: ClipboardList },
  { id: "examenes", label: "Exámenes", icon: Stethoscope },
  { id: "aptitudes", label: "Aptitudes", icon: ShieldCheck },
  { id: "vacunaciones", label: "Vacunas", icon: Syringe },
];

function FichaDetailModal({ item, onClose }: { item: FichaMedicaSummary; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<DetailTab>("ficha");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-2xl rounded-xl border mt-8 mb-8 flex flex-col"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--color-surface-border)" }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>{item.nombre_completo}</h2>
            <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>{item.email}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" style={{ color: "var(--color-content-secondary)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {detailTabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
              style={activeTab === id
                ? { color: "var(--color-primary)", background: "var(--color-surface-empty)" }
                : { color: "var(--color-content-secondary)" }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-4">
          {activeTab === "ficha" && <FichaTab userId={item.user_id} nombre={item.nombre_completo} />}
          {activeTab === "examenes" && <ExamenesTab userId={item.user_id} />}
          {activeTab === "aptitudes" && <AptitudesTab userId={item.user_id} />}
          {activeTab === "vacunaciones" && <VacunacionesTab userId={item.user_id} />}
        </div>
      </div>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────────

export function AdminMedicoFichasPage() {
  const [items, setItems] = useState<FichaMedicaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<FichaMedicaSummary | null>(null);

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await medicoService.listFichas({ search: search || undefined, page, page_size: PAGE_SIZE });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar fichas");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div>
        <div className="mb-6 flex items-center gap-3">
          <Stethoscope size={22} style={{ color: "var(--color-primary)" }} />
          <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
            Fichas médicas
          </h1>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-content-secondary)" }} />
          <input
            type="text"
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border pl-9 pr-3 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
          />
        </div>

        {error && <ErrorBanner message={error} onRetry={load} />}

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={Stethoscope} title="Sin resultados" description="No hay colaboradores que coincidan con la búsqueda." />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <button
                  key={item.user_id}
                  onClick={() => setSelected(item)}
                  className="rounded-xl border px-4 py-3 flex items-center justify-between text-left transition-colors hover:border-[--color-primary]"
                  style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>{item.nombre_completo}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>{item.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.grupo_sanguineo && (
                      <span className="text-xs font-mono font-semibold rounded px-1.5 py-0.5"
                        style={{ background: "#fef2f2", color: "var(--color-state-absent)" }}>{item.grupo_sanguineo}</span>
                    )}
                    <span className="text-xs rounded-full px-2 py-0.5"
                      style={{
                        background: item.tiene_ficha ? "var(--color-state-present-bg, #f0fdf4)" : "var(--color-surface-empty)",
                        color: item.tiene_ficha ? "var(--color-state-present)" : "var(--color-content-disabled)",
                      }}>
                      {item.tiene_ficha ? "Con ficha" : "Sin ficha"}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                  {total} colaboradores
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Anterior</Button>
                  <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page * PAGE_SIZE >= total}>Siguiente</Button>
                </div>
              </div>
            )}
          </>
        )}

        {selected && <FichaDetailModal item={selected} onClose={() => setSelected(null)} />}
      </div>
    </AdminLayout>
  );
}
