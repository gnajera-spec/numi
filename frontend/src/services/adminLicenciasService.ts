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
};
