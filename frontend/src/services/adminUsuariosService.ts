import { apiClient } from "../lib/apiClient";
import type { UserSummary, UserDetail, CreateUserRequest, UpdateUserRequest, Paginated, RolUsuario, HorarioLaboral, ColaboradorDocumento } from "../types";

const BASE_URL = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "";

async function uploadDocumentoMultipart(userId: string, file: File, tipo: string, descripcion?: string): Promise<ColaboradorDocumento> {
  const token = localStorage.getItem("access_token");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("tipo", tipo);
  if (descripcion) fd.append("descripcion", descripcion);
  const res = await fetch(`${BASE_URL}/users/${userId}/documentos`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (res.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? "Error al subir documento");
  }
  return res.json() as Promise<ColaboradorDocumento>;
}

export const adminUsuariosService = {
  list: (params: {
    estado?: string;
    role?: string;
    search?: string;
    page?: number;
    page_size?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.estado) qs.set("estado", params.estado);
    if (params.role) qs.set("role", params.role);
    if (params.search) qs.set("search", params.search);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 20));
    return apiClient.get<Paginated<UserSummary>>(`/users?${qs}`);
  },

  create: (data: CreateUserRequest) =>
    apiClient.post<UserSummary>("/users", data),

  invite: (id: string) =>
    apiClient.post<{ expires_at: string; sent_via: string }>(
      `/users/${id}/invite`,
      {}
    ),

  suspend: (id: string, motivo?: string) =>
    apiClient.post<void>(`/users/${id}/suspend`, { motivo: motivo ?? "" }),

  reactivate: (id: string) =>
    apiClient.post<UserSummary>(`/users/${id}/reactivate`, {}),

  baja: (id: string, motivo?: string) =>
    apiClient.post<void>(`/users/${id}/baja`, { motivo: motivo ?? "" }),

  getOne: (id: string) =>
    apiClient.get<UserDetail>(`/users/${id}`),

  update: (id: string, data: UpdateUserRequest) =>
    apiClient.patch<UserDetail>(`/users/${id}`, data),

  setRoles: (id: string, roles: RolUsuario[]) =>
    apiClient.patch<UserSummary>(`/users/${id}/roles`, { roles }),

  getHorarios: (id: string) =>
    apiClient.get<HorarioLaboral[]>(`/users/${id}/horarios`),

  saveHorarios: (id: string, horarios: HorarioLaboral[]) =>
    apiClient.put<HorarioLaboral[]>(`/users/${id}/horarios`, { horarios }),

  getDocumentos: (id: string) =>
    apiClient.get<ColaboradorDocumento[]>(`/users/${id}/documentos`),

  uploadDocumento: (id: string, file: File, tipo: string, descripcion?: string) =>
    uploadDocumentoMultipart(id, file, tipo, descripcion),

  deleteDocumento: (userId: string, docId: string) =>
    apiClient.delete<void>(`/users/${userId}/documentos/${docId}`),
};

// ── Invitaciones ──────────────────────────────────────────────────────────────

export interface InvitacionCreada {
  token: string;
  email: string;
  cuil: string;
  link: string;
  expires_at: string;
}

export interface LoteResultado {
  exitosos: InvitacionCreada[];
  errores: { cuil: string; email: string; error: string }[];
}

export interface InvitacionPendiente {
  token: string;
  email: string;
  cuil: string;
  link: string;
  expires_at: string;
  created_at: string;
}

export const invitacionesService = {
  listPendientes: () =>
    apiClient.get<InvitacionPendiente[]>("/admin/invitaciones"),

  eliminar: (token: string) =>
    apiClient.delete<void>(`/admin/invitaciones/${token}`),

  invitarIndividual: (cuil: string, email: string) =>
    apiClient.post<InvitacionCreada>("/admin/invitaciones/individual", { cuil, email }),

  invitarLote: (colaboradores: { cuil: string; email: string }[]) =>
    apiClient.post<LoteResultado>("/admin/invitaciones/lote", { colaboradores }),

  invitarLoteCSV: async (file: File): Promise<LoteResultado> => {
    const token = localStorage.getItem("access_token");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/admin/invitaciones/lote/csv`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (res.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/admin/login";
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? "Error al procesar CSV");
    }
    return res.json();
  },
};

// ── Onboarding público ────────────────────────────────────────────────────────

export interface OnboardingTokenInfo {
  cuil: string;
  email: string;
  tenant_nombre: string;
  expires_at: string;
}

export const onboardingService = {
  getInfo: (token: string) =>
    apiClient.get<OnboardingTokenInfo>(`/onboarding/${token}`),

  sendCode: (token: string) =>
    apiClient.post<{ message: string; email: string }>(`/onboarding/${token}/send-code`, {}),

  verifyCode: (token: string, code: string) =>
    apiClient.post<{ message: string }>(`/onboarding/${token}/verify-code`, { code }),

  completar: (token: string, data: {
    nombre: string;
    apellido: string;
    email: string;
    nro_documento: string;
    fecha_nacimiento?: string;
    genero?: string;
    password: string;
  }) => apiClient.post<{ message: string; user_id: string }>(`/onboarding/${token}/completar`, data),
};
