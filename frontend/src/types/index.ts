// Auth & User
export interface UserMe {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: "colaborador" | "rrhh" | "admin_empresa" | "super_admin" | "servicio_medico";
  roles?: string[];
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
export type EstadoSolicitud = "pendiente" | "en_revision" | "aprobada" | "rechazada" | "cancelada";

export interface TipoLicencia {
  id: string;
  tenant_id: string | null;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  requiere_certificado: boolean;
  es_medica?: boolean;
  max_dias_por_anio?: number;
  dias_maximos?: number;
  is_active?: boolean;
}

export interface SolicitudLicencia {
  id: string;
  numero_solicitud: string;
  tipo_licencia: { id: string; codigo: string; nombre: string; es_medica?: boolean };
  fecha_inicio: string;
  fecha_fin: string;
  dias_habiles: number;
  estado: EstadoSolicitud;
  comentario_empleado?: string;
  comentario_rrhh?: string;
  revisado_por?: { id: string; first_name: string; last_name: string } | null;
  revisado_at?: string | null;
  flujo_id?: string | null;
  paso_actual?: number | null;
  created_at: string;
  // Solicitante
  user_nombre?: string;
  user_cuil?: string;
  // Acción del usuario autenticado en el paso actual (solo en pendientes-mi-aprobacion)
  mi_tipo_accion?: "aprobar" | "solo_ver" | "derivar";
  // Medical fields
  medico_nombre?: string;
  medico_apellido?: string;
  medico_matricula?: string;
  dias_reposo?: number;
  // Attached documents (documentos_solicitud)
  documentos?: { id: string; filename: string; file_url: string; mime_type?: string }[];
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
  // Medical fields
  medico_nombre?: string;
  medico_apellido?: string;
  medico_matricula?: string;
  dias_reposo?: number;
}

// Comunicaciones
// Estado values match DB CHECK: borrador | enviando | enviado | programado | cancelado
export type EstadoComunicacion = "borrador" | "enviando" | "enviado" | "programado" | "cancelado";

// Represents a comunicacion_destinatarios row with nested comunicaciones data
// The "id" here is the DESTINATARIO record id; communication id is in comunicaciones.id
export interface ComunicacionColaborador {
  id: string;           // destinatario record id
  estado: string;
  enviado_at?: string;
  leido_at?: string;
  confirmado_at?: string;
  comunicaciones: {
    id: string;         // communication id — use this for confirmar()
    asunto: string;
    cuerpo: string;
    requiere_confirmacion: boolean;
    enviado_at?: string;
    comunicacion_adjuntos?: AdjuntoComunicacion[];
  };
}

export interface AdjuntoComunicacion {
  id: string;
  filename: string;           // backend: AdjuntoOut.filename
  mime_type: string;          // backend: AdjuntoOut.mime_type
  file_url: string;           // backend: AdjuntoOut.file_url (signed URL from Supabase Storage)
  file_size_bytes?: number;
  comunicacion_id?: string;
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
  roles: RolUsuario[];
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

export interface ColaboradorPerfil {
  sede_id?: string | null;
  departamento_id?: string | null;
  puesto_id?: string | null;
  convenio_id?: string | null;
  legajo?: string | null;
  fecha_ingreso?: string | null;
  tipo_contrato?: string | null;
  email_personal?: string | null;
  telefono_personal?: string | null;
}

export interface UserDetail extends UserSummary {
  tenant_id?: string;
  whatsapp_numero_masked?: string;
  last_login_at?: string;
  activated_at?: string;
  colaborador_perfil?: ColaboradorPerfil | null;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  sede_id?: string | null;
  departamento_id?: string | null;
  puesto_id?: string | null;
  convenio_id?: string | null;
  legajo?: string | null;
  tipo_contrato?: string | null;
  fecha_ingreso?: string | null;
}

// Admin — Periodos de liquidación
export type EstadoPeriodo = "borrador" | "distribuido" | "cerrado";

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
  nombre: string | null;
  archivo: string;
  user_id?: string | null;
  matched: boolean;
  rechazo_motivo?: string | null;
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
  estado: EstadoComunicacion;
  programado_at?: string;
  enviado_at?: string;
  total_destinatarios?: number;
  // Backend returns adjuntos under "comunicacion_adjuntos" (the table join name)
  comunicacion_adjuntos?: AdjuntoComunicacion[];
  metricas?: MetricasComunicacion;
  created_at: string;
}

export interface DestinatarioTracking {
  id: string;
  user_id: string;
  nombre: string;
  email: string;
  estado: string;
  leido_at?: string;
  confirmado_at?: string;
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

// Super Admin — Tenants
export type TenantPlan = "starter" | "professional" | "enterprise";
export type TenantEstado = "activo" | "suspendido" | "baja";

export interface TenantSummary {
  id: string;
  nombre: string;
  nombre_corto: string;
  subdominio: string;
  plan: TenantPlan;
  estado: TenantEstado;
  logo_url?: string;
  color_primario?: string;
}

export interface TenantOut extends TenantSummary {
  cuit: string;
  whatsapp_numero?: string;
  max_colaboradores: number;
  created_at: string;
  updated_at: string;
}

export interface TenantCreateResponse extends TenantOut {
  admin_email: string;
  initial_password: string;
}

export interface CreateTenantRequest {
  nombre: string;
  nombre_corto: string;
  cuit: string;
  subdominio: string;
  plan: TenantPlan;
  admin_email: string;
  admin_first_name: string;
  admin_last_name: string;
  logo_url?: string;
  color_primario?: string;
}

export interface UpdateTenantRequest {
  nombre?: string;
  nombre_corto?: string;
  plan?: TenantPlan;
  estado?: TenantEstado;
  logo_url?: string;
  color_primario?: string;
}

// Paginación
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// Paginación con campo "items" (usado por comunicaciones, médico, organización)
export interface PaginatedItems<T> {
  items: T[];
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

// Organización — estructura org
export interface Sede {
  id: string;
  tenant_id: string;
  nombre: string;
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedSedes {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  items: Sede[];
}

export interface Departamento {
  id: string;
  tenant_id: string;
  nombre: string;
  padre_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  hijos: Departamento[];
}

export interface Puesto {
  id: string;
  tenant_id: string;
  nombre: string;
  descripcion?: string;
  meses_vigencia_aptitud?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedPuestos {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  items: Puesto[];
}

export interface Convenio {
  id: string;
  tenant_id: string;
  nombre: string;
  descripcion?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Servicio médico
export interface FichaMedicaSummary {
  user_id: string;
  nombre_completo: string;
  email: string;
  grupo_sanguineo?: string;
  tiene_ficha: boolean;
}

export interface PaginatedFichas {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  items: FichaMedicaSummary[];
}

export interface Alergia {
  nombre: string;
  severidad?: string;
}

export interface Condicion {
  nombre: string;
  desde?: string;
}

export interface FichaMedica {
  id: string;
  user_id: string;
  grupo_sanguineo?: string;
  factor_rh?: string;
  alergias?: Alergia[];
  condiciones?: Condicion[];
  observaciones?: string;
  created_at: string;
  updated_at: string;
}

export interface ExamenMedico {
  id: string;
  user_id: string;
  tipo: "ingreso" | "periodico" | "post_ausencia" | "egreso";
  fecha: string;
  resultado?: string;
  medico_responsable?: string;
  storage_path?: string;
  created_at: string;
}

export interface Vacunacion {
  id: string;
  user_id: string;
  vacuna: string;
  fecha: string;
  lote?: string;
  proxima_dosis?: string;
  created_at: string;
}

export interface AptitudLaboral {
  id: string;
  user_id: string;
  puesto_id: string;
  estado: "apto" | "apto_con_restricciones" | "no_apto";
  restricciones?: string;
  fecha_emision: string;
  fecha_vencimiento?: string;
  created_at: string;
}

export interface AccidenteTrabajo {
  id: string;
  user_id: string;
  fecha_hora: string;
  lugar: string;
  descripcion: string;
  testigos?: { nombre: string; legajo?: string }[];
  numero_art?: string;
  estado: "abierto" | "tratamiento" | "alta" | "cerrado";
  created_at: string;
  updated_at: string;
}

export interface PaginatedAccidentes {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  items: AccidenteTrabajo[];
}

export interface AbsentismoDeptItem {
  departamento: string;
  dias_ausentes: number;
  colaboradores: number;
  tasa_pct: number;
}

export interface ReporteAbsentismo {
  periodo: { desde: string; hasta: string };
  por_departamento: AbsentismoDeptItem[];
  total_dias_ausentes: number;
  tasa_global_pct: number;
}

export interface AptitudPorVencerItem {
  user_id: string;
  nombre_completo: string;
  puesto: string;
  estado: string;
  fecha_vencimiento: string;
  dias_restantes: number;
}

// Horario laboral
export interface HorarioLaboral {
  dia_semana: number; // 1=Lun … 7=Dom
  hora_inicio: string; // "HH:MM"
  hora_fin: string;
}

// Documentos del legajo
export interface ColaboradorDocumento {
  id: string;
  tipo: string;
  filename: string;
  file_url: string;
  file_size_bytes: number;
  mime_type: string;
  descripcion?: string | null;
  uploaded_by: string;
  created_at: string;
}
