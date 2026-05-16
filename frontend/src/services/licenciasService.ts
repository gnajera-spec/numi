import { apiClient } from "../lib/apiClient";
import type {
  TipoLicencia,
  SolicitudLicencia,
  SaldoLicencia,
  NuevaSolicitud,
  Paginated,
} from "../types";

export const licenciasService = {
  listTipos: () => apiClient.get<TipoLicencia[]>("/licencias/tipos"),

  listMisSolicitudes: (page = 1, pageSize = 20) =>
    apiClient.get<Paginated<SolicitudLicencia>>(
      `/licencias/mis-solicitudes?page=${page}&page_size=${pageSize}`
    ),

  deleteTipo: (id: string) =>
    apiClient.delete<void>(`/licencias/tipos/${id}`),
  createTipo: (data: {
    codigo: string;
    nombre: string;
    descripcion?: string;
    requiere_certificado?: boolean;
    dias_maximos?: number;
  }) => apiClient.post<TipoLicencia>("/licencias/tipos", data),
  getSaldo: () => apiClient.get<SaldoLicencia[]>("/licencias/saldo"),

  crear: (data: NuevaSolicitud) =>
    apiClient.post<SolicitudLicencia>("/licencias/solicitudes", data),

  cancelar: (id: string) =>
    apiClient.post<SolicitudLicencia>(`/licencias/solicitudes/${id}/cancelar`, {}),

  subirDocumento: async (solicitudId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${BASE_URL}/licencias/solicitudes/${solicitudId}/documento`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail ?? "Error al subir documento");
    }
    return res.json();
  },
};
