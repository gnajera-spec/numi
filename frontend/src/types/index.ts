// Auth & User
export interface UserMe {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: "colaborador" | "rrhh" | "admin_empresa" | "super_admin" | "servicio_medico";
  estado: "pendiente" | "activo" | "suspendido" | "baja";
  tenant_id: string;
  tenant_nombre?: string;
  departamento_nombre?: string;
  puesto_nombre?: string;
  sede_nombre?: string;
  mfa_enabled?: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginResponse {
  // Normal login
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  user?: UserMe;
  // MFA challenge
  mfa_required?: boolean;
  mfa_token?: string;
}

export interface MfaSetupData {
  secret: string;
  qr_uri: string;
  backup_codes: string[];
}

// Recibos
export type EstadoRecibo = "pendiente" | "entregado" | "firmado" | "vencido";

export interface Recibo {
  id: string;
  periodo_id: string;
  periodo_nombre: string;
  fecha_periodo: string;
  estado: EstadoRecibo;
  storage_path?: string;
  visto_at?: string;
  firmado_at?: string;
  created_at: string;
}

export interface ReciboDetalle extends Recibo {
  signed_url: string;
}

export interface FirmaResponse {
  ok: boolean;
  firmado_at: string;
  hash: string;
}

// Licencias
export type EstadoSolicitud = "pendiente" | "aprobada" | "rechazada" | "cancelada";

export interface TipoLicencia {
  id: string;
  codigo: string;
  nombre: string;
  requiere_certificado: boolean;
  max_dias_por_anio?: number;
  es_global: boolean;
}

export interface SolicitudLicencia {
  id: string;
  numero: string;
  tipo_licencia_id: string;
  tipo_licencia_nombre: string;
  tipo_licencia_codigo: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_habiles: number;
  estado: EstadoSolicitud;
  comentario_colaborador?: string;
  comentario_revisor?: string;
  created_at: string;
}

export interface SaldoLicencia {
  tipo_licencia_id: string;
  tipo_licencia_nombre: string;
  tipo_licencia_codigo: string;
  anio: number;
  dias_asignados: number;
  dias_usados: number;
  dias_pendientes: number;
  dias_disponibles: number;
}

export interface NuevaSolicitud {
  tipo_licencia_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  comentario?: string;
}

// Comunicaciones
export type EstadoComunicacion = "borrador" | "enviada" | "programada";

export interface ComunicacionColaborador {
  id: string;
  titulo: string;
  cuerpo: string;
  requiere_confirmacion: boolean;
  leido_at?: string;
  confirmado_at?: string;
  created_at: string;
  adjuntos: AdjuntoComunicacion[];
}

export interface AdjuntoComunicacion {
  id: string;
  nombre_archivo: string;
  content_type: string;
  signed_url?: string;
}

// Admin — Usuarios
export type RolUsuario = "colaborador" | "rrhh" | "admin_empresa" | "super_admin" | "servicio_medico";
export type EstadoUsuario = "pendiente" | "activo" | "suspendido" | "baja";

export interface UserSummary {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: RolUsuario;
  estado: EstadoUsuario;
  cuil?: string;
  legajo?: string;
  sede_nombre?: string;
  departamento_nombre?: string;
  puesto_nombre?: string;
  whatsapp_numero?: string;
  fecha_ingreso?: string;
  created_at: string;
}

export interface CreateUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  cuil: string;
  role: RolUsuario;
  whatsapp_numero: string;
  sede_id?: string;
  departamento_id?: string;
  puesto_id?: string;
  legajo?: string;
  fecha_ingreso?: string;
  tipo_contrato?: "indefinido" | "determinado" | "eventual" | "pasantia";
}

// Admin — Periodos de liquidación
export type EstadoPeriodo = "abierto" | "cerrado";

export interface PeriodoLiquidacion {
  id: string;
  periodo: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_limite_firma?: string;
  estado: EstadoPeriodo;
  total_recibos: number;
  recibos_firmados: number;
  created_at: string;
}

export interface CreatePeriodoRequest {
  periodo: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_limite_firma?: string;
}

export interface UploadPreviewItem {
  cuil: string;
  nombre: string;
  archivo: string;
  user_id?: string;
}

export interface UploadPreviewResponse {
  job_id: string;
  total_archivos: number;
  preview: UploadPreviewItem[];
}

export interface UploadConfirmResponse {
  distribuidos: number;
  errores: string[];
}

export interface ReciboDashboardItem {
  user_id: string;
  full_name: string;
  cuil: string;
  legajo?: string;
  sede_nombre?: string;
  recibo_id?: string;
  estado: "pendiente" | "entregado" | "firmado" | "sin_recibo";
  firmado_at?: string;
}

// Admin — Comunicaciones
export interface ComunicacionAdmin {
  id: string;
  asunto: string;
  cuerpo: string;
  tipo_segmento: "todos" | "sede" | "departamento" | "puesto" | "lista_custom";
  requiere_confirmacion: boolean;
  estado: "borrador" | "enviada" | "programada";
  programado_at?: string;
  enviado_at?: string;
  total_destinatarios?: number;
  created_at: string;
}

export interface NuevaComunicacion {
  asunto: string;
  cuerpo: string;
  tipo_segmento: "todos" | "sede" | "departamento" | "puesto" | "lista_custom";
  segmento_config?: Record<string, unknown>;
  requiere_confirmacion: boolean;
  programado_at?: string;
}

export interface MetricasComunicacion {
  enviados: number;
  entregados: number;
  leidos: number;
  confirmados: number;
}

// Paginación
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// Reportes
export interface DashboardKPIs {
  headcount: number;
  licencias_activas_hoy: number;
  licencias_pendientes_aprobacion: number;
  vencimientos_proximos_30d: number;
  recibos_sin_firmar: number;
  comunicados_sin_confirmar: number;
}

export interface SedeCount {
  sede: string;
  count: number;
}

export interface DepartamentoCount {
  departamento: string;
  count: number;
}

export interface HeadcountDistribucion {
  total: number;
  por_sede: SedeCount[];
  por_departamento: DepartamentoCount[];
}

export interface TendenciaMes {
  mes: string;
  total: number;
  aprobadas: number;
  rechazadas: number;
  pendientes: number;
}

export interface TendenciaLicencias {
  tendencia: TendenciaMes[];
}
