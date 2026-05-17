import { apiClient } from "../lib/apiClient";
import type {
  TipoLicencia,
  SolicitudLicencia,
  SaldoLicencia,
  NuevaSolicitud,
  Paginated,
} from "../types";

interface CreateTipoPayload {
  codigo: string;
  nombre: string;
  descripcion?: string;
  requiere_certificado: boolean;
  dias_maximos?: number;
}

interface UpdateTipoPayload {
  nombre?: string;
  descripcion?: string | null;
  requiere_certificado?: boolean;
  dias_maximos?: number | null;
  is_active?: boolean;
}

export const licenciasService = {
  listTipos: () => apiClient.get<TipoLicencia[]>("/licencias/tipos"),

  createTipo: (data: CreateTipoPayload) =>
    apiClient.post<TipoLicencia>("/licencias/tipos", data),

  updateTipo: (id: string, data: UpdateTipoPayload) =>
    apiClient.patch<TipoLicencia>(`/licencias/tipos/${id}`, data),

  deleteTipo: (id: string) =>
    apiClient.delete<void>(`/licencias/tipos/${id}`),

  listMisSolicitudes: (page = 1, pageSize = 20) =>
    apiClient.get<Paginated<SolicitudLicencia>>(
      `/licencias/mis-solicitudes?page=${page}&page_size=${pageSize}`
    ),

  getSaldo: () => apiClient.get<SaldoLicencia[]>("/licencias/saldo"),

  crear: (data: NuevaSolicitud) =>
    apiClient.post<SolicitudLicencia>("/licencias/solicitudes", data),

  cancelar: (id: string) =>
    apiClient.post<SolicitudLicencia>(`/licencias/solicitudes/${id}/cancelar`, {}),

  pendientesAprobacion: (page = 1, pageSize = 50) =>
    apiClient.get<Paginated<SolicitudLicencia>>(
      `/licencias/pendientes-mi-aprobacion?page=${page}&page_size=${pageSize}`
    ),

  listMedicas: (params?: { estado?: string; user_id?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.estado) q.set("estado", params.estado);
    if (params?.user_id) q.set("user_id", params.user_id);
    if (params?.page) q.set("page", String(params.page));
    if (params?.page_size) q.set("page_size", String(params.page_size));
    return apiClient.get<Paginated<SolicitudLicencia>>(`/licencias/solicitudes-medicas?${q.toString()}`);
  },

  aprobarPaso: (solicitudId: string, comentario?: string) =>
    apiClient.post<SolicitudLicencia>(`/licencias/solicitudes/${solicitudId}/aprobar-paso`, { comentario }),

  rechazarPaso: (solicitudId: string, comentario: string) =>
    apiClient.post<SolicitudLicencia>(`/licencias/solicitudes/${solicitudId}/rechazar-paso`, { comentario }),

  derivarPaso: (solicitudId: string, comentario?: string) =>
    apiClient.post<SolicitudLicencia>(`/licencias/solicitudes/${solicitudId}/derivar-paso`, { comentario }),

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
