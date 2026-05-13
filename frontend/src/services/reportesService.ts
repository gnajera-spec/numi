import { apiClient } from "../lib/apiClient";
import type {
  DashboardKPIs,
  HeadcountDistribucion,
  TendenciaLicencias,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const reportesService = {
  getDashboard: () => apiClient.get<DashboardKPIs>("/reportes/dashboard"),

  getHeadcount: () =>
    apiClient.get<HeadcountDistribucion>("/reportes/headcount"),

  getTendenciaLicencias: (meses = 6) =>
    apiClient.get<TendenciaLicencias>(`/reportes/licencias?meses=${meses}`),

  getExportLicenciasUrl: (params: {
    desde?: string;
    hasta?: string;
    estado?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params.desde) qs.set("desde", params.desde);
    if (params.hasta) qs.set("hasta", params.hasta);
    if (params.estado) qs.set("estado", params.estado);
    return `${BASE_URL}/reportes/export/licencias?${qs.toString()}`;
  },

  getExportComunicacionesUrl: (params: {
    desde?: string;
    hasta?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params.desde) qs.set("desde", params.desde);
    if (params.hasta) qs.set("hasta", params.hasta);
    return `${BASE_URL}/reportes/export/comunicaciones?${qs.toString()}`;
  },

  downloadCsv: async (url: string, filename: string) => {
    const token = localStorage.getItem("access_token") ?? "";
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error("Error al descargar el reporte");
    const blob = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  },
};
