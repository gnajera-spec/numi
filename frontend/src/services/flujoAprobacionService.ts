import { apiClient } from "../lib/apiClient";

export interface PasoFlujoCreate {
  orden: number;
  nombre: string;
  tipo_aprobador: "rol" | "departamento";
  rol_aprobador?: "rrhh" | "servicio_medico" | "admin_empresa";
  departamento_id?: string;
  sla_horas?: number;
  requiere_comentario: boolean;
  tipo_accion: "aprobar" | "solo_ver" | "derivar";
}

export interface FlujoCreate {
  tipo_licencia_id: string;
  nombre: string;
  descripcion?: string;
  pasos: PasoFlujoCreate[];
}

export interface FlujoUpdate {
  nombre?: string;
  descripcion?: string;
  pasos?: PasoFlujoCreate[];
}

export interface PasoFlujoOut {
  id: string;
  flujo_id: string;
  tenant_id: string;
  orden: number;
  nombre: string;
  tipo_aprobador: "rol" | "departamento";
  rol_aprobador: string | null;
  departamento_id: string | null;
  departamento_nombre: string | null;
  sla_horas: number | null;
  requiere_comentario: boolean;
  tipo_accion: "aprobar" | "solo_ver" | "derivar";
  created_at: string;
}

export interface FlujoAprobacionOut {
  id: string;
  tenant_id: string;
  tipo_licencia_id: string;
  tipo_licencia_nombre: string | null;
  tipo_licencia_codigo: string | null;
  nombre: string;
  descripcion: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  pasos: PasoFlujoOut[];
}

export interface TipoLicenciaConFlujo {
  tipo_licencia_id: string;
  tipo_licencia_nombre: string;
  tipo_licencia_codigo: string;
  flujo_id: string | null;
  flujo_nombre: string | null;
  pasos_count: number;
  is_active: boolean | null;
}

export interface DepartamentoOption {
  id: string;
  nombre: string;
}

const BASE = "/admin/flujos-aprobacion";

export const flujoAprobacionService = {
  async list(): Promise<TipoLicenciaConFlujo[]> {
    return apiClient.get<TipoLicenciaConFlujo[]>(BASE);
  },

  async get(flujoId: string): Promise<FlujoAprobacionOut> {
    return apiClient.get<FlujoAprobacionOut>(`${BASE}/${flujoId}`);
  },

  async create(data: FlujoCreate): Promise<FlujoAprobacionOut> {
    return apiClient.post<FlujoAprobacionOut>(BASE, data);
  },

  async update(flujoId: string, data: FlujoUpdate): Promise<FlujoAprobacionOut> {
    return apiClient.put<FlujoAprobacionOut>(`${BASE}/${flujoId}`, data);
  },

  async deactivate(flujoId: string): Promise<FlujoAprobacionOut> {
    return apiClient.patch<FlujoAprobacionOut>(`${BASE}/${flujoId}/deactivate`, {});
  },

  async getDepartamentos(): Promise<DepartamentoOption[]> {
    return apiClient.get<DepartamentoOption[]>(`${BASE}/departamentos`);
  },
};
