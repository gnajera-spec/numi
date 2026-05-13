import { apiClient } from "../lib/apiClient";
import type { Sede, PaginatedSedes, Departamento, Puesto, PaginatedPuestos, Convenio } from "../types";

export const organizacionService = {
  // ── Sedes ──────────────────────────────────────────────────────────────────
  listSedes: (params: { is_active?: boolean; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 100));
    return apiClient.get<PaginatedSedes>(`/sedes?${qs}`);
  },

  createSede: (data: { nombre: string; direccion?: string; ciudad?: string; provincia?: string }) =>
    apiClient.post<Sede>("/sedes", data),

  updateSede: (id: string, data: { nombre?: string; direccion?: string; ciudad?: string; provincia?: string; is_active?: boolean }) =>
    apiClient.patch<Sede>(`/sedes/${id}`, data),

  // ── Departamentos ──────────────────────────────────────────────────────────
  listDepartamentos: (params: { is_active?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
    return apiClient.get<Departamento[]>(`/departamentos?${qs}`);
  },

  createDepartamento: (data: { nombre: string; padre_id?: string }) =>
    apiClient.post<Departamento>("/departamentos", data),

  updateDepartamento: (id: string, data: { nombre?: string; padre_id?: string; is_active?: boolean }) =>
    apiClient.patch<Departamento>(`/departamentos/${id}`, data),

  // ── Puestos ────────────────────────────────────────────────────────────────
  listPuestos: (params: { is_active?: boolean; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 100));
    return apiClient.get<PaginatedPuestos>(`/puestos?${qs}`);
  },

  createPuesto: (data: { nombre: string; descripcion?: string; meses_vigencia_aptitud?: number }) =>
    apiClient.post<Puesto>("/puestos", data),

  updatePuesto: (id: string, data: { nombre?: string; descripcion?: string; meses_vigencia_aptitud?: number; is_active?: boolean }) =>
    apiClient.patch<Puesto>(`/puestos/${id}`, data),

  // ── Convenios ──────────────────────────────────────────────────────────────
  listConvenios: () =>
    apiClient.get<Convenio[]>("/convenios"),

  createConvenio: (data: { nombre: string; descripcion?: string }) =>
    apiClient.post<Convenio>("/convenios", data),
};
