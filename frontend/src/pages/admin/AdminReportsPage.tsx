import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { reportesService } from "../../services/reportesService";

type EstadoLicencia = "pendiente" | "aprobada" | "rechazada" | "cancelada" | "";

export function AdminReportsPage() {
  // Filtros licencias
  const [licDesde, setLicDesde] = useState("");
  const [licHasta, setLicHasta] = useState("");
  const [licEstado, setLicEstado] = useState<EstadoLicencia>("");
  const [licLoading, setLicLoading] = useState(false);
  const [licError, setLicError] = useState<string | null>(null);

  // Filtros comunicaciones
  const [comDesde, setComDesde] = useState("");
  const [comHasta, setComHasta] = useState("");
  const [comLoading, setComLoading] = useState(false);
  const [comError, setComError] = useState<string | null>(null);

  const handleExportLicencias = async () => {
    setLicLoading(true);
    setLicError(null);
    try {
      const url = reportesService.getExportLicenciasUrl({
        desde: licDesde || undefined,
        hasta: licHasta || undefined,
        estado: licEstado || undefined,
      });
      await reportesService.downloadCsv(url, "licencias.csv");
    } catch (err) {
      setLicError(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setLicLoading(false);
    }
  };

  const handleExportComunicaciones = async () => {
    setComLoading(true);
    setComError(null);
    try {
      const url = reportesService.getExportComunicacionesUrl({
        desde: comDesde || undefined,
        hasta: comHasta || undefined,
      });
      await reportesService.downloadCsv(url, "comunicaciones.csv");
    } catch (err) {
      setComError(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setComLoading(false);
    }
  };

  return (
    <AdminLayout>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>
          Reportes
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
          Exportá datos de cada módulo en formato CSV
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Export licencias */}
        <div
          className="rounded-lg border p-6"
          style={{
            background: "var(--color-surface-card)",
            borderColor: "var(--color-surface-border)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet size={18} style={{ color: "var(--color-primary)" }} />
            <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
              Solicitudes de licencias
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="lic-desde"
                className="text-sm font-medium"
                style={{ color: "var(--color-content-secondary)" }}
              >
                Desde
              </label>
              <input
                id="lic-desde"
                type="date"
                value={licDesde}
                onChange={(e) => setLicDesde(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: "var(--color-surface-border)",
                  color: "var(--color-content-primary)",
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="lic-hasta"
                className="text-sm font-medium"
                style={{ color: "var(--color-content-secondary)" }}
              >
                Hasta
              </label>
              <input
                id="lic-hasta"
                type="date"
                value={licHasta}
                onChange={(e) => setLicHasta(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: "var(--color-surface-border)",
                  color: "var(--color-content-primary)",
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="lic-estado"
                className="text-sm font-medium"
                style={{ color: "var(--color-content-secondary)" }}
              >
                Estado
              </label>
              <select
                id="lic-estado"
                value={licEstado}
                onChange={(e) => setLicEstado(e.target.value as EstadoLicencia)}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: "var(--color-surface-border)",
                  color: "var(--color-content-primary)",
                  background: "var(--color-surface-card)",
                }}
              >
                <option value="">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="aprobada">Aprobada</option>
                <option value="rechazada">Rechazada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          {licError && <ErrorBanner message={licError} />}

          <Button
            onClick={handleExportLicencias}
            loading={licLoading}
            variant="secondary"
          >
            <Download size={15} />
            Descargar CSV
          </Button>
        </div>

        {/* Export comunicaciones */}
        <div
          className="rounded-lg border p-6"
          style={{
            background: "var(--color-surface-card)",
            borderColor: "var(--color-surface-border)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet size={18} style={{ color: "var(--color-primary)" }} />
            <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
              Comunicaciones institucionales
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="com-desde"
                className="text-sm font-medium"
                style={{ color: "var(--color-content-secondary)" }}
              >
                Desde
              </label>
              <input
                id="com-desde"
                type="date"
                value={comDesde}
                onChange={(e) => setComDesde(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: "var(--color-surface-border)",
                  color: "var(--color-content-primary)",
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="com-hasta"
                className="text-sm font-medium"
                style={{ color: "var(--color-content-secondary)" }}
              >
                Hasta
              </label>
              <input
                id="com-hasta"
                type="date"
                value={comHasta}
                onChange={(e) => setComHasta(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: "var(--color-surface-border)",
                  color: "var(--color-content-primary)",
                }}
              />
            </div>
          </div>

          {comError && <ErrorBanner message={comError} />}

          <Button
            onClick={handleExportComunicaciones}
            loading={comLoading}
            variant="secondary"
          >
            <Download size={15} />
            Descargar CSV
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
