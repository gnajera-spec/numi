import { useEffect, useState, useCallback } from "react";
import {
  Bell, Paperclip, Check, X,
  FileText, FileImage, FileArchive, FileSpreadsheet,
  Download, File, Eye, AlertCircle, Loader2,
} from "lucide-react";
import { comunicacionesService } from "../services/comunicacionesService";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import { Spinner } from "../components/Spinner";
import { Button } from "../components/Button";
import type { ComunicacionColaborador, AdjuntoComunicacion } from "../types";

type FilterType = "todas" | "no_leidas" | "confirmadas";

const filters: { key: FilterType; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "no_leidas", label: "No leídas" },
  { key: "confirmadas", label: "Confirmadas" },
];

// ─── File type helpers ────────────────────────────────────────────────────────

type ViewerType = "image" | "pdf" | "office" | "none";

function resolveViewerType(mime: string): ViewerType {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "application/vnd.ms-powerpoint"
  ) return "office";
  return "none";
}

function getFileIcon(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime === "application/pdf") return FileText;
  if (mime.includes("sheet") || mime.includes("excel")) return FileSpreadsheet;
  if (mime.includes("zip") || mime.includes("compressed")) return FileArchive;
  return File;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Embedded Document Viewer ─────────────────────────────────────────────────

function DocumentViewer({
  adj,
  onClose,
}: {
  adj: AdjuntoComunicacion;
  onClose: () => void;
}) {
  const viewerType = resolveViewerType(adj.mime_type);
  const [iframeError, setIframeError] = useState(false);
  const [loading, setLoading] = useState(viewerType !== "none");

  // Microsoft Office Online viewer URL
  const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(adj.file_url)}`;
  const embedSrc = viewerType === "office" ? officeUrl : adj.file_url;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      {/* Viewer header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{
          background: "var(--color-surface-card)",
          borderColor: "var(--color-surface-border)",
        }}
      >
        {(() => {
          const Icon = getFileIcon(adj.mime_type);
          return <Icon size={16} style={{ color: "var(--color-primary)" }} className="shrink-0" />;
        })()}
        <span
          className="flex-1 text-sm font-semibold truncate"
          style={{ color: "var(--color-content-primary)" }}
        >
          {adj.filename}
        </span>
        {adj.file_size_bytes && (
          <span
            className="text-xs shrink-0"
            style={{ color: "var(--color-content-secondary)" }}
          >
            {formatFileSize(adj.file_size_bytes)}
          </span>
        )}
        <a
          href={adj.file_url}
          download={adj.filename}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors hover:opacity-80"
          style={{
            background: "var(--color-surface-subtle, #f0f2f5)",
            borderColor: "var(--color-surface-border)",
            color: "var(--color-content-primary)",
            textDecoration: "none",
          }}
        >
          <Download size={13} />
          Descargar
        </a>
        <button
          onClick={onClose}
          aria-label="Cerrar visor"
          className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-black/5"
        >
          <X size={18} style={{ color: "var(--color-content-secondary)" }} />
        </button>
      </div>

      {/* Viewer body */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
            style={{ background: "var(--color-surface-app, #f5f6fa)" }}>
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: "var(--color-primary)" }}
            />
            <span className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
              Cargando documento…
            </span>
          </div>
        )}

        {/* Error / no-viewer fallback */}
        {(iframeError || viewerType === "none") && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
            <div
              className="rounded-full p-4"
              style={{ background: "var(--color-surface-card)" }}
            >
              <AlertCircle size={32} style={{ color: "var(--color-content-secondary)" }} />
            </div>
            <p className="text-sm text-center" style={{ color: "var(--color-content-secondary)" }}>
              {viewerType === "none"
                ? "Este tipo de archivo no tiene vista previa disponible."
                : "No se pudo cargar la vista previa."}
            </p>
            <a
              href={adj.file_url}
              download={adj.filename}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--color-primary)", textDecoration: "none" }}
            >
              <Download size={15} />
              Descargar archivo
            </a>
          </div>
        )}

        {/* Image viewer */}
        {viewerType === "image" && !iframeError && (
          <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
            <img
              src={adj.file_url}
              alt={adj.filename}
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              style={{ background: "white" }}
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setIframeError(true); }}
            />
          </div>
        )}

        {/* PDF / Office iframe viewer */}
        {(viewerType === "pdf" || viewerType === "office") && !iframeError && (
          <iframe
            key={embedSrc}
            src={embedSrc}
            className="w-full h-full border-0"
            title={adj.filename}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setIframeError(true); }}
            allow="fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        )}
      </div>
    </div>
  );
}

// ─── Attachment Chip ──────────────────────────────────────────────────────────

function AttachmentChip({
  adj,
  onPreview,
}: {
  adj: AdjuntoComunicacion;
  onPreview: (adj: AdjuntoComunicacion) => void;
}) {
  const Icon = getFileIcon(adj.mime_type);
  const size = formatFileSize(adj.file_size_bytes);
  const canPreview = resolveViewerType(adj.mime_type) !== "none";

  return (
    <div
      className="flex items-center gap-2 rounded-lg border overflow-hidden"
      style={{
        background: "var(--color-surface-subtle, #f8f9fb)",
        borderColor: "var(--color-surface-border)",
      }}
    >
      {/* File info area */}
      <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2">
        <Icon
          size={16}
          className="shrink-0"
          style={{ color: "var(--color-primary)" }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: "var(--color-content-primary)" }}
          >
            {adj.filename}
          </p>
          {size && (
            <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
              {size}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div
        className="flex items-center shrink-0 border-l"
        style={{ borderColor: "var(--color-surface-border)" }}
      >
        {canPreview && (
          <button
            onClick={() => onPreview(adj)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors hover:opacity-70 border-r"
            style={{
              color: "var(--color-primary)",
              borderColor: "var(--color-surface-border)",
            }}
            title="Ver documento"
          >
            <Eye size={13} />
            Ver
          </button>
        )}
        <a
          href={adj.file_url}
          download={adj.filename}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors hover:opacity-70"
          style={{ color: "var(--color-content-secondary)", textDecoration: "none" }}
          title="Descargar"
        >
          <Download size={13} />
          {canPreview ? "" : "Descargar"}
        </a>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  com,
  onClose,
  onConfirmed,
  onRead,
}: {
  com: ComunicacionColaborador;
  onClose: () => void;
  onConfirmed: () => void;
  onRead: (comunicacionId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingAdj, setViewingAdj] = useState<AdjuntoComunicacion | null>(null);
  const comData = com.comunicaciones;
  const adjuntos = comData.comunicacion_adjuntos ?? [];

  // Mark as read on mount — fire-and-forget, idempotent
  useEffect(() => {
    if (!com.leido_at) {
      comunicacionesService.marcarLeido(comData.id)
        .then(() => onRead(comData.id))
        .catch(() => { /* best-effort — don't surface errors to the user */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      await comunicacionesService.confirmar(comData.id);
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="w-full max-w-lg rounded-xl border"
          style={{
            background: "var(--color-surface-card)",
            borderColor: "var(--color-surface-border)",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            className="flex items-start justify-between p-6 border-b"
            style={{ borderColor: "var(--color-surface-border)" }}
          >
            <h2
              className="text-base font-semibold pr-4 leading-snug"
              style={{ color: "var(--color-content-primary)" }}
            >
              {comData.asunto}
            </h2>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5"
            >
              <X size={18} style={{ color: "var(--color-content-secondary)" }} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4">
                <ErrorBanner message={error} />
              </div>
            )}

            {/* Rich text body */}
            <div
              className="text-sm prose prose-sm max-w-none"
              style={{ color: "var(--color-content-primary)", wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap" }}
              dangerouslySetInnerHTML={{ __html: comData.cuerpo }}
            />

            {/* Attachments section */}
            {adjuntos.length > 0 && (
              <div
                className="mt-6 pt-5 border-t"
                style={{ borderColor: "var(--color-surface-border)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip
                    size={14}
                    style={{ color: "var(--color-content-secondary)" }}
                  />
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-content-secondary)" }}
                  >
                    Adjuntos ({adjuntos.length})
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {adjuntos.map((adj) => (
                    <AttachmentChip
                      key={adj.id}
                      adj={adj}
                      onPreview={setViewingAdj}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer: confirm button */}
          {comData.requiere_confirmacion && !com.confirmado_at && (
            <div
              className="p-6 border-t flex justify-end"
              style={{ borderColor: "var(--color-surface-border)" }}
            >
              <Button onClick={handleConfirm} loading={loading}>
                <Check size={14} /> Confirmar lectura
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Document viewer layer (z-[60], above modal) */}
      {viewingAdj && (
        <DocumentViewer
          adj={viewingAdj}
          onClose={() => setViewingAdj(null)}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CommunicationsPage() {
  const [comunicaciones, setComunicaciones] = useState<ComunicacionColaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("todas");
  const [selected, setSelected] = useState<ComunicacionColaborador | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await comunicacionesService.list(1, 50);
      setComunicaciones(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar comunicados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = comunicaciones.filter((c) => {
    if (filter === "no_leidas") return !c.leido_at;
    if (filter === "confirmadas") return !!c.confirmado_at;
    return true;
  });

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <Bell size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
          Comunicados
        </h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors"
            style={{
              background: filter === key ? "var(--color-primary)" : "transparent",
              color: filter === key ? "#fff" : "var(--color-content-secondary)",
              borderColor: filter === key ? "var(--color-primary)" : "var(--color-surface-border)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={load} /></div>}
      {loading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={Bell}
          title="Sin comunicados"
          description={
            filter === "no_leidas"
              ? "Ya leíste todos los comunicados."
              : "Todavía no hay comunicados para vos."
          }
        />
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((com) => {
            const comData = com.comunicaciones;
            if (!comData) return null;
            const isUnread = !com.leido_at;
            const adjuntos = comData.comunicacion_adjuntos ?? [];

            return (
              <button
                key={com.id}
                onClick={() => setSelected(com)}
                className="w-full text-left rounded-xl border px-5 py-4 transition-shadow hover:shadow-md"
                style={{
                  background: "var(--color-surface-card)",
                  borderColor: isUnread ? "var(--color-primary)" : "var(--color-surface-border)",
                }}
              >
                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>
                      {comData.asunto}
                    </span>
                    {isUnread && (
                      <span className="text-xs font-bold rounded-full px-2 py-0.5 text-white"
                        style={{ background: "var(--color-primary)" }}>
                        NUEVA
                      </span>
                    )}
                    {comData.requiere_confirmacion && !com.confirmado_at && (
                      <span className="text-xs font-bold rounded-full px-2 py-0.5 text-white"
                        style={{ background: "var(--color-state-pending)" }}>
                        Requiere confirmación
                      </span>
                    )}
                    {com.confirmado_at && (
                      <span className="flex items-center gap-1 text-xs font-medium"
                        style={{ color: "var(--color-state-present)" }}>
                        <Check size={12} /> Confirmada
                      </span>
                    )}
                  </div>

                  {/* Footer row */}
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-xs" style={{ color: "var(--color-content-disabled)" }}>
                      {comData.enviado_at
                        ? new Date(comData.enviado_at).toLocaleDateString("es-AR")
                        : "—"}
                    </p>
                    {adjuntos.length > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium"
                        style={{ color: "var(--color-content-secondary)" }}>
                        <Paperclip size={11} />
                        {adjuntos.length === 1 ? "1 adjunto" : `${adjuntos.length} adjuntos`}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <DetailModal
          com={selected}
          onClose={() => setSelected(null)}
          onConfirmed={() => { setSelected(null); load(); }}
          onRead={(comunicacionId) => {
            // Optimistically clear leido_at badge without full reload
            setComunicaciones((prev) =>
              prev.map((c) =>
                c.comunicaciones.id === comunicacionId
                  ? { ...c, leido_at: new Date().toISOString() }
                  : c
              )
            );
          }}
        />
      )}
    </div>
  );
}
