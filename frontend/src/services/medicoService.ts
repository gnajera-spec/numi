import { apiClient } from "../lib/apiClient";
import type {
  FichaMedica,
  PaginatedFichas,
  ExamenMedico,
  Vacunacion,
  AptitudLaboral,
  AptitudPorVencerItem,
  AccidenteTrabajo,
  PaginatedAccidentes,
  ReporteAbsentismo,
  Alergia,
  Condicion,
} from "../types";

export const medicoService = {
  // ── Fichas ─────────────────────────────────────────────────────────────────
  listFichas: (params: { search?: string; sede_id?: string; departamento_id?: string; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.sede_id) qs.set("sede_id", params.sede_id);
    if (params.departamento_id) qs.set("departamento_id", params.departamento_id);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 20));
    return apiClient.get<PaginatedFichas>(`/medico/fichas?${qs}`);
  },

  getFicha: (userId: string) =>
    apiClient.get<FichaMedica>(`/medico/fichas/${userId}`),

  updateFicha: (userId: string, data: {
    grupo_sanguineo?: string;
    factor_rh?: string;
    alergias?: Alergia[];
    condiciones?: Condicion[];
    observaciones?: string;
  }) => apiClient.put<FichaMedica>(`/medico/fichas/${userId}`, data),

  // ── Exámenes ───────────────────────────────────────────────────────────────
  listExamenes: (userId: string) =>
    apiClient.get<ExamenMedico[]>(`/medico/examenes/${userId}`),

  createExamen: (userId: string, data: {
    tipo: string;
    fecha: string;
    resultado?: string;
    medico_responsable?: string;
  }) => apiClient.post<ExamenMedico>(`/medico/examenes/${userId}`, data),

  // ── Vacunaciones ───────────────────────────────────────────────────────────
  listVacunaciones: (userId: string) =>
    apiClient.get<Vacunacion[]>(`/medico/vacunaciones/${userId}`),

  createVacunacion: (userId: string, data: {
    vacuna: string;
    fecha: string;
    lote?: string;
    proxima_dosis?: string;
  }) => apiClient.post<Vacunacion>(`/medico/vacunaciones/${userId}`, data),

  // ── Aptitudes ──────────────────────────────────────────────────────────────
  listAptitudes: (userId: string) =>
    apiClient.get<AptitudLaboral[]>(`/medico/aptitudes/${userId}`),

  createAptitud: (userId: string, data: {
    puesto_id: string;
    estado: string;
    restricciones?: string;
    fecha_emision: string;
    fecha_vencimiento?: string;
  }) => apiClient.post<AptitudLaboral>(`/medico/aptitudes/${userId}`, data),

  aptitudesPorVencer: (params: { dias?: number; sede_id?: string; departamento_id?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.dias) qs.set("dias", String(params.dias));
    if (params.sede_id) qs.set("sede_id", params.sede_id);
    if (params.departamento_id) qs.set("departamento_id", params.departamento_id);
    return apiClient.get<AptitudPorVencerItem[]>(`/medico/reportes/aptitudes-por-vencer?${qs}`);
  },

  // ── Accidentes ─────────────────────────────────────────────────────────────
  listAccidentes: (params: { estado?: string; desde?: string; hasta?: string; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.estado) qs.set("estado", params.estado);
    if (params.desde) qs.set("desde", params.desde);
    if (params.hasta) qs.set("hasta", params.hasta);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 20));
    return apiClient.get<PaginatedAccidentes>(`/medico/accidentes?${qs}`);
  },

  createAccidente: (data: {
    user_id: string;
    fecha_hora: string;
    lugar: string;
    descripcion: string;
    testigos?: { nombre: string; legajo?: string }[];
  }) => apiClient.post<AccidenteTrabajo>("/medico/accidentes", data),

  updateAccidente: (id: string, data: { estado?: string; numero_art?: string }) =>
    apiClient.patch<AccidenteTrabajo>(`/medico/accidentes/${id}`, data),

  // ── Reportes ───────────────────────────────────────────────────────────────
  reporteAbsentismo: (params: { desde: string; hasta: string; departamento_id?: string }) => {
    const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta });
    if (params.departamento_id) qs.set("departamento_id", params.departamento_id);
    return apiClient.get<{ data: ReporteAbsentismo }>(`/medico/reportes/absentismo?${qs}`);
  },
};
