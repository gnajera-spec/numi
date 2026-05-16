import { useEffect, useState, useCallback, useRef } from "react";
import {
  MessageSquare, Plus, X, Send, RefreshCw, Paperclip, Trash2,
  Bold, Italic, Underline, List, ListOrdered, FileText, Search, UserCheck,
  BarChart2, CheckCircle2, Eye, Clock,
} from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { adminComunicacionesService } from "../../services/adminComunicacionesService";
import { adminUsuariosService } from "../../services/adminUsuariosService";
import type { ComunicacionAdmin, DestinatarioTracking, NuevaComunicacion, EstadoComunicacion, UserSummary } from "../../types";
import { useAuth } from "../../contexts/AuthContext";

// ── Badge config ────────────────────────────────────────────────────────────

const estadoBadge: Partial<Record<EstadoComunicacion, { label: string; color: string; bg: string }>> = {
  borrador:  { label: "Borrador",   color: "var(--color-content-secondary)", bg: "var(--color-surface-empty)" },
  enviando:  { label: "Enviando…",  color: "#fff", bg: "var(--color-state-pending)" },
  enviado:   { label: "Enviada",    color: "#fff", bg: "var(--color-state-present)" },
  programado:{ label: "Programada", color: "#fff", bg: "var(--color-state-pending)" },
  cancelado: { label: "Cancelada",  color: "#fff", bg: "var(--color-state-absent)" },
};

const segmentoLabel: Record<NuevaComunicacion["tipo_segmento"], string> = {
  todos: "Todos los colaboradores",
  sede: "Por sede",
  departamento: "Por departamento",
  puesto: "Por puesto",
  lista_custom: "Lista personalizada",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function textLength(html: string): number {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").length;
}

// ── RichTextEditor ────────────────────────────────────────────────────────

interface RichTextEditorProps {
  onChange: (html: string) => void;
  maxLength?: number;
  placeholder?: string;
}

function RichTextEditor({ onChange, maxLength = 5000, placeholder = "Texto de la comunicación..." }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const handleInput = () => {
    const html = editorRef.current?.innerHTML ?? "";
    const len = textLength(html);
    setCharCount(len);
    onChange(html);
    updateActiveFormats();
  };

  const updateActiveFormats = () => {
    const formats = new Set<string>();
    if (document.queryCommandState("bold")) formats.add("bold");
    if (document.queryCommandState("italic")) formats.add("italic");
    if (document.queryCommandState("underline")) formats.add("underline");
    setActiveFormats(formats);
  };

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value ?? "");
    handleInput();
  };

  const btnCls = (cmd: string) =>
    `p-1.5 rounded transition-colors ${
      activeFormats.has(cmd)
        ? "text-white"
        : "hover:bg-gray-100"
    }`;

  const btnStyle = (cmd: string): React.CSSProperties =>
    activeFormats.has(cmd)
      ? { background: "var(--color-primary)", color: "#fff" }
      : { color: "var(--color-content-secondary)" };

  const ToolBtn = ({
    cmd, val, children, title,
  }: { cmd: string; val?: string; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); exec(cmd, val); }}
      className={btnCls(cmd)}
      style={btnStyle(cmd)}
    >
      {children}
    </button>
  );

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: "var(--color-surface-border)" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap"
        style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-empty)" }}
      >
        <ToolBtn cmd="bold" title="Negrita (Ctrl+B)"><Bold size={14} /></ToolBtn>
        <ToolBtn cmd="italic" title="Cursiva (Ctrl+I)"><Italic size={14} /></ToolBtn>
        <ToolBtn cmd="underline" title="Subrayado (Ctrl+U)"><Underline size={14} /></ToolBtn>
        <div className="w-px h-4 mx-1" style={{ background: "var(--color-surface-border)" }} />
        <ToolBtn cmd="insertUnorderedList" title="Lista con viñetas"><List size={14} /></ToolBtn>
        <ToolBtn cmd="insertOrderedList" title="Lista numerada"><ListOrdered size={14} /></ToolBtn>
        <div className="w-px h-4 mx-1" style={{ background: "var(--color-surface-border)" }} />
        <ToolBtn cmd="formatBlock" val="h3" title="Encabezado">
          <span className="text-xs font-bold">H</span>
        </ToolBtn>
        <ToolBtn cmd="formatBlock" val="p" title="Párrafo normal">
          <span className="text-xs">¶</span>
        </ToolBtn>
        <button
          type="button"
          title="Limpiar formato"
          onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); }}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors text-xs ml-auto"
          style={{ color: "var(--color-content-secondary)" }}
        >
          Limpiar
        </button>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        className="px-3 py-2.5 text-sm outline-none min-h-[160px] max-h-[300px] overflow-y-auto"
        style={{ color: "var(--color-content-primary)" }}
        data-placeholder={placeholder}
      />

      {/* Footer */}
      <div
        className="flex justify-end px-3 py-1 border-t"
        style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-empty)" }}
      >
        <span
          className="text-xs"
          style={{ color: charCount > maxLength ? "var(--color-state-absent)" : "var(--color-content-secondary)" }}
        >
          {charCount}/{maxLength}
        </span>
      </div>
    </div>
  );
}

// ── AttachmentPicker ─────────────────────────────────────────────────────────

interface AttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
}

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.docx,.xlsx";
const MAX_SIZE_MB = 10;

function AttachmentPicker({ files, onChange }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter((f) => {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`"${f.name}" supera ${MAX_SIZE_MB} MB y no se puede adjuntar.`);
        return false;
      }
      return true;
    });
    onChange([...files, ...valid]);
  };

  const remove = (idx: number) => onChange(files.filter((_, i) => i !== idx));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const fileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    return ext === "pdf" ? "📄" : ext === "png" || ext === "jpg" || ext === "jpeg" ? "🖼️" : "📎";
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Drop zone */}
      <div
        className="rounded-lg border-2 border-dashed px-4 py-4 text-center cursor-pointer transition-colors hover:border-[var(--color-primary)]"
        style={{ borderColor: "var(--color-surface-border)" }}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <Paperclip size={18} className="mx-auto mb-1" style={{ color: "var(--color-content-disabled)" }} />
        <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
          Clic o arrastrá archivos · PDF, imagen, Word, Excel · Máx. {MAX_SIZE_MB} MB c/u
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-empty)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span>{fileIcon(f.name)}</span>
                <span className="truncate font-medium" style={{ color: "var(--color-content-primary)" }}>
                  {f.name}
                </span>
                <span style={{ color: "var(--color-content-disabled)", flexShrink: 0 }}>
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="ml-2 shrink-0 p-0.5 rounded hover:bg-red-50 transition-colors"
                style={{ color: "var(--color-state-absent)" }}
                title="Quitar"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── NuevaComunicacionModal ────────────────────────────────────────────────

interface NuevaComunicacionModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function NuevaComunicacionModal({ onClose, onCreated }: NuevaComunicacionModalProps) {
  const [form, setForm] = useState<NuevaComunicacion>({
    asunto: "",
    cuerpo: "",
    tipo_segmento: "todos",
    requiere_confirmacion: false,
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lista personalizada — buscador de colaboradores
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserSummary[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserSummary[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchUsers = useCallback((q: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.trim().length < 2) { setUserResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await adminUsuariosService.list({ search: q, page_size: 10, estado: "activo" });
        setUserResults(res.data ?? []);
      } catch { setUserResults([]); }
      finally { setSearchingUsers(false); }
    }, 300);
  }, []);

  const addUser = (u: UserSummary) => {
    if (!selectedUsers.find(s => s.id === u.id)) {
      const next = [...selectedUsers, u];
      setSelectedUsers(next);
      setForm(f => ({ ...f, segmento_config: { user_ids: next.map(x => x.id) } }));
    }
    setUserSearch("");
    setUserResults([]);
  };

  const removeUser = (id: string) => {
    const next = selectedUsers.filter(u => u.id !== id);
    setSelectedUsers(next);
    setForm(f => ({ ...f, segmento_config: { user_ids: next.map(x => x.id) } }));
  };

  const [showConfirm, setShowConfirm] = useState(false);

  const validate = (): string | null => {
    if (!form.asunto.trim()) return "El asunto es obligatorio.";
    const bodyText = textLength(form.cuerpo);
    if (bodyText === 0) return "El cuerpo del mensaje no puede estar vacío.";
    if (bodyText > 5000) return "El cuerpo supera los 5000 caracteres.";
    if (form.tipo_segmento === "lista_custom" && selectedUsers.length === 0)
      return "Seleccioná al menos un destinatario para la lista personalizada.";
    return null;
  };

  const handleEnviar = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setShowConfirm(true);
  };

  const confirmSend = async () => {
    setShowConfirm(false);
    setLoading(true);
    setError(null);
    try {
      const com = await adminComunicacionesService.create(form);
      for (let i = 0; i < attachments.length; i++) {
        setUploadProgress(`Subiendo adjunto ${i + 1} de ${attachments.length}…`);
        await adminComunicacionesService.uploadAdjunto(com.id, attachments[i]);
      }
      setUploadProgress("Enviando…");
      await adminComunicacionesService.enviar(com.id);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar comunicación");
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-xl border flex flex-col overflow-hidden"
        style={{
          background: "var(--color-surface-card)",
          borderColor: "var(--color-surface-border)",
          height: "min(92vh, 700px)",
        }}
      >
        {/* Header — fixed */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
        >
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
            Nueva comunicación
          </h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X size={18} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto flex-1">
          {error && <ErrorBanner message={error} />}

          {/* Asunto */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Asunto <span style={{ color: "var(--color-state-absent)" }}>*</span>
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={form.asunto}
              onChange={(e) => setForm((f) => ({ ...f, asunto: e.target.value }))}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
              placeholder="Ej: Comunicado sobre cambio de horario"
            />
          </div>

          {/* Cuerpo — Rich text */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Cuerpo <span style={{ color: "var(--color-state-absent)" }}>*</span>
            </label>
            <RichTextEditor
              onChange={(html) => setForm((f) => ({ ...f, cuerpo: html }))}
              maxLength={5000}
              placeholder="Escribí el contenido de la comunicación…"
            />
          </div>

          {/* Destinatarios */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Destinatarios
            </label>
            <select
              value={form.tipo_segmento}
              onChange={(e) => {
                const val = e.target.value as NuevaComunicacion["tipo_segmento"];
                setForm((f) => ({ ...f, tipo_segmento: val, segmento_config: undefined }));
                setSelectedUsers([]);
                setUserSearch("");
                setUserResults([]);
              }}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            >
              {Object.entries(segmentoLabel).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>

            {/* User picker — only when lista_custom */}
            {form.tipo_segmento === "lista_custom" && (
              <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-empty)" }}>
                {/* Selected chips */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUsers.map(u => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                        style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)", background: "transparent" }}
                      >
                        <UserCheck size={11} />
                        {u.first_name} {u.last_name}
                        <button
                          type="button"
                          onClick={() => removeUser(u.id)}
                          className="ml-0.5 hover:opacity-70"
                          aria-label="Quitar"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-content-disabled)" }} />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); searchUsers(e.target.value); }}
                    placeholder="Buscar colaborador por nombre o email…"
                    className="w-full rounded-lg border pl-8 pr-3 py-2 text-sm outline-none"
                    style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
                  />
                  {searchingUsers && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--color-content-disabled)" }}>…</span>
                  )}
                </div>

                {/* Results dropdown */}
                {userResults.length > 0 && (
                  <ul className="flex flex-col gap-0.5 max-h-40 overflow-y-auto rounded-lg border" style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}>
                    {userResults.map(u => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => addUser(u)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-empty)] transition-colors flex items-center justify-between"
                        >
                          <span style={{ color: "var(--color-content-primary)" }}>
                            {u.first_name} {u.last_name}
                          </span>
                          <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                            {u.email ?? (u as unknown as Record<string, string>).correo ?? ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {userSearch.trim().length >= 2 && !searchingUsers && userResults.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--color-content-disabled)" }}>Sin resultados para "{userSearch}"</p>
                )}
                {selectedUsers.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                    Buscá y seleccioná los colaboradores que recibirán este mensaje.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Confirmación */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.requiere_confirmacion}
              onChange={(e) => setForm((f) => ({ ...f, requiere_confirmacion: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm" style={{ color: "var(--color-content-primary)" }}>
              Requiere confirmación de lectura
            </span>
          </label>

          {/* Adjuntos */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Adjuntos
            </label>
            <AttachmentPicker files={attachments} onChange={setAttachments} />
          </div>

        </div>{/* end scrollable body */}

        {/* Actions — footer always visible */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4 border-t"
          style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)", flexShrink: 0 }}
        >
          <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" loading={loading} disabled={loading} onClick={handleEnviar}>
            {!loading && <Send size={14} />}
            {uploadProgress ?? "Enviar"}
          </Button>
        </div>

        {/* Confirm dialog */}
          {showConfirm && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.5)" }}
            >
              <div
                className="w-full max-w-sm rounded-xl border p-6 flex flex-col gap-4"
                style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex items-center justify-center rounded-xl w-10 h-10 shrink-0"
                    style={{ background: "rgba(52,107,240,0.1)" }}
                  >
                    <Send size={18} style={{ color: "var(--color-primary)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>
                      ¿Enviar comunicación?
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--color-content-secondary)" }}>
                      Se enviará <strong>"{form.asunto}"</strong> a{" "}
                      {form.tipo_segmento === "todos"
                        ? "todos los colaboradores"
                        : form.tipo_segmento === "lista_custom"
                        ? `${selectedUsers.length} colaborador${selectedUsers.length !== 1 ? "es" : ""}`
                        : segmentoLabel[form.tipo_segmento]}
                      . Esta acción no se puede deshacer.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" type="button" onClick={() => setShowConfirm(false)}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={confirmSend}>
                    <Send size={13} /> Confirmar envío
                  </Button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

// ── SeguimientoModal ──────────────────────────────────────────────────────────

const estadoDestinatarioBadge: Record<string, { label: string; color: string }> = {
  enviado:    { label: "Enviado",     color: "var(--color-content-secondary)" },
  entregado:  { label: "Entregado",   color: "var(--color-state-pending)" },
  leido:      { label: "Leído",       color: "var(--color-state-present)" },
  confirmado: { label: "Confirmado",  color: "var(--color-primary)" },
};

function fmt(d: string | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function SeguimientoModal({ com, onClose }: { com: ComunicacionAdmin; onClose: () => void }) {
  const [detail, setDetail] = useState<ComunicacionAdmin | null>(null);
  const [destinatarios, setDestinatarios] = useState<DestinatarioTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      adminComunicacionesService.get(com.id),
      adminComunicacionesService.getDestinatarios(com.id),
    ])
      .then(([d, dest]) => { setDetail(d); setDestinatarios(dest); })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar seguimiento"))
      .finally(() => setLoading(false));
  }, [com.id]);

  const m = detail?.metricas;
  const total = m?.enviados ?? 0;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  const filtered = destinatarios.filter((d) =>
    !search || d.nombre.toLowerCase().includes(search.toLowerCase()) || d.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-xl border flex flex-col overflow-hidden"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)", height: "min(92vh, 680px)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--color-surface-border)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <BarChart2 size={18} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--color-content-primary)" }}>{com.asunto}</p>
              <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>Seguimiento de lectura</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar">
            <X size={18} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {error && <ErrorBanner message={error} />}

          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <>
              {/* KPI cards */}
              {m && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: Send,         label: "Enviados",   value: m.enviados,   pct: 100 },
                    { icon: Eye,          label: "Leídos",     value: m.leidos,     pct: pct(m.leidos) },
                    { icon: CheckCircle2, label: "Confirmados",value: m.confirmados,pct: pct(m.confirmados) },
                    { icon: Clock,        label: "Sin leer",   value: m.enviados - m.leidos, pct: pct(m.enviados - m.leidos) },
                  ].map(({ icon: Icon, label, value, pct: p }) => (
                    <div key={label} className="rounded-xl border p-3 flex flex-col gap-1"
                      style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-empty)" }}>
                      <div className="flex items-center gap-1.5">
                        <Icon size={13} style={{ color: "var(--color-content-secondary)" }} />
                        <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>{label}</span>
                      </div>
                      <p className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>{value}</p>
                      <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: "var(--color-surface-border)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: "var(--color-primary)" }} />
                      </div>
                      <p className="text-xs" style={{ color: "var(--color-content-disabled)" }}>{p}%</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Recipient table */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                    Destinatarios ({destinatarios.length})
                  </p>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: "var(--color-content-disabled)" }} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar…"
                      className="rounded-lg border pl-7 pr-3 py-1.5 text-xs outline-none"
                      style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)", width: 180 }} />
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <p className="text-sm py-4 text-center" style={{ color: "var(--color-content-disabled)" }}>Sin resultados</p>
                ) : (
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-surface-border)" }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: "var(--color-surface-empty)", borderBottom: `1px solid var(--color-surface-border)` }}>
                          <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-content-secondary)" }}>Colaborador</th>
                          <th className="text-left px-3 py-2.5 font-medium" style={{ color: "var(--color-content-secondary)" }}>Estado</th>
                          <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell" style={{ color: "var(--color-content-secondary)" }}>Leído</th>
                          {com.requiere_confirmacion && (
                            <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell" style={{ color: "var(--color-content-secondary)" }}>Confirmado</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((d, i) => {
                          const badge = estadoDestinatarioBadge[d.estado] ?? { label: d.estado, color: "var(--color-content-secondary)" };
                          return (
                            <tr key={d.id} style={{ borderTop: i > 0 ? `1px solid var(--color-surface-border)` : undefined }}>
                              <td className="px-4 py-3">
                                <p className="font-medium" style={{ color: "var(--color-content-primary)" }}>{d.nombre || "—"}</p>
                                <p style={{ color: "var(--color-content-secondary)" }}>{d.email}</p>
                              </td>
                              <td className="px-3 py-3">
                                <span className="font-medium" style={{ color: badge.color }}>{badge.label}</span>
                              </td>
                              <td className="px-3 py-3 hidden sm:table-cell" style={{ color: "var(--color-content-secondary)" }}>
                                {fmt(d.leido_at)}
                              </td>
                              {com.requiere_confirmacion && (
                                <td className="px-3 py-3 hidden sm:table-cell" style={{ color: "var(--color-content-secondary)" }}>
                                  {fmt(d.confirmado_at)}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────

export function AdminComunicacionesPage() {
  const { user } = useAuth();
  const canCreate = user?.role === "admin_empresa" || user?.role === "super_admin" || user?.role === "rrhh";
  const [comunicaciones, setComunicaciones] = useState<ComunicacionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<ComunicacionAdmin | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminComunicacionesService.list({ page_size: 50 });
      setComunicaciones(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar comunicaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const enviar = async (id: string) => {
    setSendingId(id);
    try {
      await adminComunicacionesService.enviar(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSendingId(null);
    }
  };

  const reenviar = async (id: string) => {
    setResendingId(id);
    try {
      await adminComunicacionesService.reenviar(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reenviar");
    } finally {
      setResendingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <MessageSquare size={22} style={{ color: "var(--color-primary)" }} />
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
              Comunicaciones
            </h1>
            <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
              Comunicados institucionales
            </p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Nueva comunicación
          </Button>
        )}
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={load} /></div>}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      ) : comunicaciones.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Sin comunicaciones"
          description="Creá el primer comunicado institucional."
          action={
            canCreate ? (
              <Button variant="secondary" onClick={() => setShowModal(true)}>
                <Plus size={14} /> Nueva comunicación
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {comunicaciones.map((com) => {
            const badge = estadoBadge[com.estado] ?? {
              label: com.estado,
              bg: "var(--color-surface-empty)",
              color: "var(--color-content-secondary)",
            };
            const isSending = sendingId === com.id;
            const isResending = resendingId === com.id;
            const adjuntosCount = com.comunicacion_adjuntos?.length ?? 0;

            return (
              <div
                key={com.id}
                className="rounded-xl border px-5 py-4"
                style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    {/* Title + badge */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>
                        {com.asunto}
                      </span>
                      <span
                        className="text-xs font-semibold rounded-full px-2.5 py-0.5 border"
                        style={{
                          color: badge.bg === "var(--color-surface-empty)" ? "var(--color-content-secondary)" : badge.bg,
                          borderColor: badge.bg === "var(--color-surface-empty)" ? "var(--color-surface-border)" : badge.bg,
                          background: "transparent",
                        }}
                      >
                        {badge.label}
                      </span>
                      {adjuntosCount > 0 && (
                        <span
                          className="flex items-center gap-1 text-xs"
                          style={{ color: "var(--color-content-secondary)" }}
                          title={`${adjuntosCount} adjunto${adjuntosCount !== 1 ? "s" : ""}`}
                        >
                          <Paperclip size={11} />
                          {adjuntosCount}
                        </span>
                      )}
                    </div>

                    {/* Cuerpo preview — strip HTML */}
                    <p
                      className="text-xs line-clamp-2"
                      style={{ color: "var(--color-content-secondary)" }}
                      dangerouslySetInnerHTML={{
                        __html: com.cuerpo.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
                      }}
                    />

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: "var(--color-content-secondary)" }}>
                      <span>{segmentoLabel[com.tipo_segmento] ?? com.tipo_segmento}</span>
                      {com.requiere_confirmacion && <span>· Requiere confirmación</span>}
                      {com.total_destinatarios !== undefined && (
                        <span>· {com.total_destinatarios} destinatarios</span>
                      )}
                      <span>· {new Date(com.created_at).toLocaleDateString("es-AR")}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {(com.estado === "enviado" || com.estado === "enviando") && (
                      <button
                        onClick={() => setTracking(com)}
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-blue-50"
                        style={{ color: "var(--color-primary)", borderColor: "var(--color-surface-border)" }}
                      >
                        <BarChart2 size={13} />
                        Seguimiento
                      </button>
                    )}
                    {canCreate && com.estado === "borrador" && (
                      <button
                        onClick={() => enviar(com.id)}
                        disabled={isSending}
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-blue-50 disabled:opacity-50"
                        style={{ color: "var(--color-primary)", borderColor: "var(--color-surface-border)" }}
                      >
                        <Send size={13} />
                        {isSending ? "Enviando…" : "Enviar"}
                      </button>
                    )}
                    {canCreate && (com.estado === "enviado" || com.estado === "enviando") && (
                      <button
                        onClick={() => reenviar(com.id)}
                        disabled={isResending}
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 disabled:opacity-50"
                        style={{ color: "var(--color-content-secondary)", borderColor: "var(--color-surface-border)" }}
                      >
                        <RefreshCw size={13} />
                        {isResending ? "Reenviando…" : "Reenviar"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Adjuntos list (if available from API) */}
                {adjuntosCount > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {com.comunicacion_adjuntos!.map((adj) => (
                      <a
                        key={adj.id}
                        href={adj.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border hover:bg-blue-50 transition-colors"
                        style={{ color: "var(--color-primary)", borderColor: "var(--color-surface-border)" }}
                      >
                        <FileText size={11} />
                        {adj.filename}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <NuevaComunicacionModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
      {tracking && (
        <SeguimientoModal com={tracking} onClose={() => setTracking(null)} />
      )}
    </AdminLayout>
  );
}
