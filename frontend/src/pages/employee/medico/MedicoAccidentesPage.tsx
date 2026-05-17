import { useEffect, useState, useCallback, type FormEvent } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { MedicoLayout } from "../../../components/MedicoLayout";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { Spinner } from "../../../components/Spinner";
import { medicoService } from "../../../services/medicoService";
import { adminUsuariosService } from "../../../services/adminUsuariosService";
import type { AccidenteTrabajo, UserSummary } from "../../../types";

const estadoBadge: Record<string, { label: string; color: string; bg: string }> = {
  abierto: { label: "Abierto", color: "#fff", bg: "var(--color-state-absent)" },
  tratamiento: { label: "En tratamiento", color: "#fff", bg: "var(--color-state-pending)" },
  alta: { label: "Alta médica", color: "#fff", bg: "var(--color-state-present)" },
  cerrado: { label: "Cerrado", color: "var(--color-content-secondary)", bg: "var(--color-surface-empty)" },
};

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

function NuevoAccidenteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [form, setForm] = useState({
    user_id: "",
    fecha_hora: new Date().toISOString().slice(0, 16),
    lugar: "",
    descripcion: "",
    testigo_nombre: "",
    testigo_legajo: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminUsuariosService.list({ estado: "activo", page_size: 200 })
      .then((res) => setUsers(res.data))
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const testigos = form.testigo_nombre
        ? [{ nombre: form.testigo_nombre, legajo: form.testigo_legajo || undefined }]
        : undefined;
      await medicoService.createAccidente({
        user_id: form.user_id,
        fecha_hora: new Date(form.fecha_hora).toISOString(),
        lugar: form.lugar,
        descripcion: form.descripcion,
        testigos,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar accidente");
    } finally {
      setSaving(false);
    }
  };

  const cls = "rounded-lg border px-3 py-2 text-sm outline-none w-full";
  const sty = { borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-lg rounded-xl border p-6 flex flex-col gap-4" style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>Registrar accidente</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" style={{ color: "var(--color-content-secondary)" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && <ErrorBanner message={error} />}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>Colaborador *</label>
            {loadingUsers ? <Spinner /> : (
              <select required value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} className={cls} style={sty}>
                <option value="">Seleccionar colaborador</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
              </select>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>Fecha y hora *</label>
            <input type="datetime-local" required value={form.fecha_hora} onChange={(e) => setForm({ ...form, fecha_hora: e.target.value })} className={cls} style={sty} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>Lugar *</label>
            <input required value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} className={cls} style={sty} placeholder="Ej: Planta baja, sector logística" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>Descripción *</label>
            <textarea required rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className={cls} style={sty} />
          </div>
          <div className="border-t pt-3" style={{ borderColor: "var(--color-surface-border)" }}>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--color-content-secondary)" }}>Testigo (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.testigo_nombre} onChange={(e) => setForm({ ...form, testigo_nombre: e.target.value })} className={cls} style={sty} placeholder="Nombre" />
              <input value={form.testigo_legajo} onChange={(e) => setForm({ ...form, testigo_legajo: e.target.value })} className={cls} style={sty} placeholder="Legajo" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving}>Registrar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UpdateEstadoModal({ accidente, onClose, onUpdated }: { accidente: AccidenteTrabajo; onClose: () => void; onUpdated: () => void }) {
  const [estado, setEstado] = useState<AccidenteTrabajo["estado"]>(accidente.estado);
  const [numero_art, setNumeroArt] = useState(accidente.numero_art ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cls = "rounded-lg border px-3 py-2 text-sm outline-none w-full";
  const sty = { borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await medicoService.updateAccidente(accidente.id, { estado, numero_art: numero_art || undefined });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-sm rounded-xl border p-6 flex flex-col gap-4" style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>Actualizar accidente</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" style={{ color: "var(--color-content-secondary)" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && <ErrorBanner message={error} />}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value as AccidenteTrabajo["estado"])} className={cls} style={sty}>
              <option value="abierto">Abierto</option>
              <option value="tratamiento">En tratamiento</option>
              <option value="alta">Alta médica</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>N° ART</label>
            <input value={numero_art} onChange={(e) => setNumeroArt(e.target.value)} className={cls} style={sty} placeholder="Número de expediente ART" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving}>Guardar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MedicoAccidentesPage() {
  const [items, setItems] = useState<AccidenteTrabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [updating, setUpdating] = useState<AccidenteTrabajo | null>(null);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await medicoService.listAccidentes({ estado: filterEstado || undefined, page, page_size: PAGE_SIZE });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar accidentes");
    } finally {
      setLoading(false);
    }
  }, [filterEstado, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <MedicoLayout>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={22} style={{ color: "#1a7a45" }} />
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>Accidentes de trabajo</h1>
          </div>
          <Button onClick={() => setShowNew(true)}><Plus size={14} /> Registrar accidente</Button>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {["", "abierto", "tratamiento", "alta", "cerrado"].map((e) => (
            <button key={e} onClick={() => { setFilterEstado(e); setPage(1); }}
              className="text-xs rounded-full px-3 py-1 font-medium transition-colors"
              style={filterEstado === e
                ? { background: "#1a7a45", color: "#fff" }
                : { background: "var(--color-surface-empty)", color: "var(--color-content-secondary)" }}>
              {e === "" ? "Todos" : estadoBadge[e]?.label ?? e}
            </button>
          ))}
        </div>

        {error && <ErrorBanner message={error} onRetry={load} />}

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="Sin accidentes" description="No hay accidentes registrados para el filtro seleccionado." />
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {items.map((acc) => {
                const badge = estadoBadge[acc.estado] ?? { label: acc.estado, color: "#fff", bg: "var(--color-surface-empty)" };
                return (
                  <div key={acc.id} className="rounded-xl border p-4" style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>{formatDateTime(acc.fecha_hora)}</span>
                          <span className="text-xs font-medium rounded-full px-2 py-0.5 border"
                            style={{
                              color: badge.bg === "var(--color-surface-empty)" ? "var(--color-content-secondary)" : badge.bg,
                              borderColor: badge.bg === "var(--color-surface-empty)" ? "var(--color-surface-border)" : badge.bg,
                              background: "transparent",
                            }}>{badge.label}</span>
                          {acc.numero_art && <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>ART: {acc.numero_art}</span>}
                        </div>
                        <p className="text-xs mb-1" style={{ color: "var(--color-content-secondary)" }}>Lugar: {acc.lugar}</p>
                        <p className="text-sm" style={{ color: "var(--color-content-primary)" }}>{acc.descripcion}</p>
                        {acc.testigos && acc.testigos.length > 0 && (
                          <p className="text-xs mt-1" style={{ color: "var(--color-content-secondary)" }}>
                            Testigos: {acc.testigos.map((t) => t.nombre).join(", ")}
                          </p>
                        )}
                      </div>
                      {acc.estado !== "cerrado" && (
                        <Button variant="secondary" onClick={() => setUpdating(acc)}>Actualizar</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>{total} accidentes</p>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Anterior</Button>
                  <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page * PAGE_SIZE >= total}>Siguiente</Button>
                </div>
              </div>
            )}
          </>
        )}

        {showNew && <NuevoAccidenteModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
        {updating && <UpdateEstadoModal accidente={updating} onClose={() => setUpdating(null)} onUpdated={() => { setUpdating(null); load(); }} />}
      </div>
    </MedicoLayout>
  );
}
