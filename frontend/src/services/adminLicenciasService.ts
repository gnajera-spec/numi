import { apiClient } from "../lib/apiClient";
import type { SolicitudLicencia, Paginated } from "../types";

export const adminLicenciasService = {
  listSolicitudes: (params: {
    estado?: string;
    tipo_licencia_id?: string;
    page?: number;
    page_size?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.estado) qs.set("estado", params.estado);
    if (params.tipo_licencia_id) qs.set("tipo_licencia_id", params.tipo_licencia_id);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 20));
    return apiClient.get<Paginated<SolicitudLicencia>>(`/licencias/solicitudes?${qs}`);
  },

  aprobar: (id: string, comentario?: string) =>
    apiClient.post<SolicitudLicencia>(`/licencias/solicitudes/${id}/aprobar`, {
      comentario: comentario ?? "",
    }),

  rechazar: (id: string, comentario: string) =>
    apiClient.post<SolicitudLicencia>(`/licencias/solicitudes/${id}/rechazar`, {
      comentario,
    }),

  aprobarPaso: (id: string, comentario?: string) =>
    apiClient.post<SolicitudLicencia>(`/licencias/solicitudes/${id}/aprobar-paso`, {
      comentario: comentario ?? null,
    }),

  rechazarPaso: (id: string, comentario: string) =>
    apiClient.post<SolicitudLicencia>(`/licencias/solicitudes/${id}/rechazar-paso`, {
      comentario,
    }),

  getHistorial: (id: string) =>
    apiClient.get<AprobacionPaso[]>(`/licencias/solicitudes/${id}/historial-aprobacion`),
};

export interface AprobacionPaso {
  id: string;
  solicitud_id: string;
  orden: number;
  nombre_paso: string;
  tipo_aprobador: "rol" | "departamento";
  rol_aprobador: string | null;
  departamento_id: string | null;
  departamento_nombre: string | null;
  estado: "pendiente" | "aprobado" | "rechazado" | "omitido";
  aprobado_por: string | null;
  aprobado_por_nombre: string | null;
  comentario: string | null;
  notificado_at: string | null;
  fecha_decision: string | null;
  created_at: string;
}
