# CLAUDE_GUIDE.md — HRConnect

> **Propósito:** Memoria persistente del proyecto para Claude Code.
> Este archivo sobrevive la compactación de contexto. Es la fuente de verdad del estado actual.
> **Actualizar al inicio y al final de cada sesión de trabajo.**

---

## INSTRUCCIONES PARA CLAUDE (leer siempre primero)

Al iniciar cualquier sesión o detectar compactación de contexto:

1. Leer este archivo completo
2. Leer `git log --oneline -20` para entender los últimos cambios
3. Leer `git status` para ver qué hay en progreso
4. Si hay una tarea en curso en la sección **Estado actual**, continuarla desde ahí
5. Si hay dudas sobre arquitectura o contratos, leer `docs/API_SPEC.md` y `docs/DATA_MODEL.md`

**Regla de oro:** el sistema de archivos siempre tiene razón. Si tu memoria del chat contradice lo que ves en los archivos, confiá en los archivos.

**Prohibido:**
- Asumir que algo está implementado si no hay un commit que lo respalde
- Tomar decisiones de arquitectura sin actualizar este archivo
- Cambiar librerías core, schema de DB o mecanismo de auth sin registrarlo en **Decisiones técnicas**

---

## ESTADO ACTUAL

### Fase actual
```
v1.3 — Módulo Colaboradores RRHH completo, bugs críticos corregidos
Última actualización: 2026-05-16
Tests: 251 pasando
Commits pendientes: ninguno
```

### En este momento estoy trabajando en
```
Nada en progreso — sistema estable, todo commiteado.
```

### Próximo paso concreto
```
1. Aplicar migración pendiente en Supabase:
   ALTER TABLE solicitudes_licencia
     ADD COLUMN IF NOT EXISTS medico_nombre text,
     ADD COLUMN IF NOT EXISTS medico_apellido text,
     ADD COLUMN IF NOT EXISTS medico_matricula text,
     ADD COLUMN IF NOT EXISTS dias_reposo integer;
   (archivo: supabase/migrations/20260516000000_add_medical_fields_to_solicitudes.sql)
2. QA del flujo de licencias médicas (una vez aplicada la migración)
3. Deploy a Render cuando esté listo
```

### Bloqueantes activos
```
- Para activar WA en dev: configurar META_VERIFY_TOKEN + META_APP_SECRET en .env local + ngrok para webhook
- Para notificaciones reales: cada tenant debe hacer PUT /whatsapp/config con su access_token de Meta
- uvicorn --reload NO detecta cambios en .env — reiniciar manualmente si se cambia
```

### Notas de desarrollo local
```
- seed_demo.py en backend/ para seed de datos de prueba (no commitear — tiene service_role_key)
- Backend corre en :8000, frontend en :5580
- reset_superadmin.py en backend/ — script de utilidad (no commitear)
- iniciar_backend.command — script de conveniencia para iniciar backend en Mac (no commitear)

Credenciales demo (DEV):
  Super Admin     superadmin@softlink.com.ar / SuperAdmin1234  → http://localhost:5580/superadmin/login
  Admin Empresa   adminempresa@demo.com      / Admin1234       → http://localhost:5580/admin/login
  RRHH            rrhh@demo.com              / Rrhh1234        → http://localhost:5580/admin/login
  Servicio Médico medico@demo.com            / Medico1234      → http://localhost:5580/admin/login
  Colaborador     colab@demo.com             / Colab1234       → http://localhost:5580/employee/login
```

### Pendiente para próxima sesión
```
1. Aplicar migración 20260516000000_add_medical_fields_to_solicitudes.sql en Supabase dashboard
2. QA flujo completo de licencias (médica + administrativa) con colaborador demo
3. Deploy a Render (opcional)
4. WhatsApp con ngrok (opcional)
```

---

## PROGRESO DE FASES

| Fase | Descripción | Estado | Fecha |
|------|-------------|--------|-------|
| Fase 0 | Setup + documentación técnica base | ✅ Completada | 2026-05-09 |
| Fase 1 | Auth + Multi-tenant + Roles + Usuarios | ✅ Completada | 2026-05-09 |
| Fase 2 | Recibos de sueldo + Firma electrónica | ✅ Completada | 2026-05-09 |
| Fase 3 | WhatsApp Bot (FSM core + flujos recibos) | ✅ Completada | 2026-05-12 |
| Fase 4 | Licencias + Aprobación RRHH | ✅ Completada | 2026-05-12 |
| Fase 5 | Comunicaciones institucionales | ✅ Completada | 2026-05-12 |
| Fase 6 | Portal Web del colaborador | ✅ Completada | 2026-05-12 |
| Fase 7 | Servicio Médico | ✅ Completada | 2026-05-12 |
| Fase 8 | Reportes + Dashboard RRHH | ✅ Completada | 2026-05-12 |
| Fase 9 | Invitaciones + SMTP + SuperAdmin panel | ✅ Completada | 2026-05-15 |
| Fase 10 | QA + bugfixes + licencias médicas/administrativas | ✅ Completada | 2026-05-16 |
| Fase 11 | Módulo Colaboradores RRHH (lista + editor legajo) | ✅ Completada | 2026-05-16 |

---

## DECISIONES TÉCNICAS

### 2026-05-09 — Multi-tenant: shared database / shared schema
**Decisión:** Una sola base de datos PostgreSQL con `tenant_id` en cada tabla + RLS.
**Contexto:** HRConnect es SaaS multi-empresa. Necesita aislamiento de datos pero simplicidad operativa en v1.0.
**Razón:** Facilita queries cross-tenant para super_admin, menor overhead de infraestructura, escalable con particionado.
**Alternativas descartadas:** Schema por tenant (operaciones DDL complejas), DB por tenant (costo y complejidad de routing).
**Impacto:** Toda tabla de datos tiene `tenant_id`. El backend siempre filtra por `tenant_id` extraído del JWT.

### 2026-05-09 — WhatsApp como canal primario del colaborador
**Decisión:** El colaborador interactúa principalmente por WhatsApp Business API (Cloud API de Meta).
**Contexto:** Requerimiento de negocio central. El portal web es complementario, no reemplaza al bot.
**Razón:** Alta adopción de WhatsApp en Argentina. Cero fricción de instalación para el colaborador.
**Impacto:** Módulo `whatsapp/` con FSM de conversación, session manager, message queue (RabbitMQ/SQS en v1).

### 2026-05-09 — Firma electrónica probatoria (no Ley 25.506)
**Decisión:** La firma de recibos es probatoria: hash SHA-256 + timestamp UTC + sesión verificada. No firma digital con certificado.
**Contexto:** La firma digital certificada (Ley 25.506) está fuera de scope v1.0 por complejidad y costo.
**Razón:** La firma probatoria tiene valor legal suficiente para la mayoría de los casos. Escalable a firma digital en v1.1.
**Impacto:** Tabla `firmas_electronicas` con timestamp, hash, IP, session_id.

### 2026-05-09 — Datos médicos: encriptación AES-256 a nivel campo
**Decisión:** Los campos sensibles de `fichas_medicas` y `examenes_medicos` se encriptan con AES-256 en la aplicación antes de persistir.
**Contexto:** Ley 25.326 (protección de datos personales) exige tratamiento especial para datos de salud.
**Razón:** Encriptación a nivel campo garantiza que ni el DBA ni un acceso directo a la DB puede leer los datos sin la clave de la aplicación.
**Impacto:** `fichas_medicas.alergias_encrypted`, `condiciones_encrypted`, `examenes_medicos.resultado`. El módulo médico solo es accesible para el rol `servicio_medico`.

---

## DEUDA TÉCNICA

| ID | Descripción | Impacto | Prioridad | Agregado |
|----|-------------|---------|-----------|---------|
| DT-001 | Message queue (RabbitMQ/SQS) no implementada en v1 — envíos masivos serán síncronos inicialmente | Performance en envíos a >100 destinatarios | Alta | 2026-05-09 |
| DT-002 | ~~MFA (TOTP) pendiente hasta antes de producción~~ | ✅ Implementado — TOTP + backup codes + 2-step login + ProfilePage setup | — | 2026-05-13 |
| DT-003 | Firma digital Ley 25.506 fuera de scope v1.0 | Legal — implementar en v1.1 | Media | 2026-05-09 |
| DT-004 | Reset de contraseña por email fuera de scope v1.0 | UX — flujo de recuperación manual | Baja | 2026-05-09 |
| DT-005 | ~~Job store de upload de recibos en `dict` en memoria~~ | ✅ Resuelto — tabla `upload_jobs` + Supabase Storage temp paths (TTL 1h) | — | 2026-05-13 |
| DT-006 | `POST /periodos/{id}/renotificar` implementado pero requiere `whatsapp_numero_raw` en usuario para enviar — pendiente de flujo de registro de wa_id | Funcionalidad parcial | Media | 2026-05-12 |
| DT-007 | ~~`whatsapp_id_hash` en users no se puebla aún en `create_user`~~ | ✅ Resuelto en Fase 4 — se pueblan `whatsapp_id_hash` y `whatsapp_id_encrypted` al crear usuario | — | 2026-05-12 |

---

## PROBLEMAS CONOCIDOS

- **IDE diagnostics falsos positivos:** VSCode muestra warnings "Package X not installed" en `requirements.txt`. Se debe a que el intérprete de Python apuntado por VSCode no es el venv del proyecto. Los paquetes están correctamente instalados en `backend/.venv`. No es un error real.

---

## CONTEXTO DE ARQUITECTURA RÁPIDO

### Stack
- **Backend:** FastAPI + Uvicorn (Python 3.12+)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind
- **Base de datos:** Supabase (PostgreSQL 15+) via `supabase-py` AsyncClient
- **Auth:** JWT con PyJWT — access token 8h (portal) / no expiry (bot sessions gestionadas por Redis)
- **WhatsApp:** Meta Cloud API (webhooks entrantes + API REST saliente)
- **Deploy:** Render (backend + frontend estáticos)

### Flujo principal — Onboarding colaborador
```
1. RRHH crea usuario → genera invite_token (hash en DB, plano por WA)
2. Bot envía link de activación por WhatsApp
3. Colaborador abre link → confirma nombre + CUIL (anti-suplantación)
4. Colaborador setea contraseña → estado = 'activo'
5. Desde ese momento: puede usar bot WA Y portal web
```

### Flujo principal — Recibo de sueldo
```
1. RRHH sube ZIP con PDFs → sistema parsea CUIL de cada archivo
2. Preview del mapeo → RRHH confirma → distribución en background
3. Bot notifica a cada colaborador (Template Message HSM)
4. Colaborador responde VER → bot envía PDF (signed URL 24h)
5. Colaborador responde CONFIRMO → firma registrada (hash + timestamp + sesión)
```

### Flujo principal — Licencia
```
1. Colaborador inicia flujo en bot → selecciona tipo → ingresa fechas
2. Bot muestra balance disponible → colaborador confirma
3. Solicitud en estado PENDIENTE → RRHH recibe notificación
4. RRHH aprueba/rechaza en back-office → notificación WhatsApp <30s
5. Si aprobada: saldo_licencias se actualiza automáticamente
```

### Frontend — estructura completa
```
frontend/src/
  types/index.ts                  ✅ Tipos TS para auth, recibos, licencias, comunicaciones, reportes
  lib/apiClient.ts                ✅ Cliente base (interceptores 401→login según path /admin o /employee)
  contexts/AuthContext.tsx        ✅ Auth state + login/logout/refreshUser
  components/
    ProtectedRoute.tsx            ✅ Redirect a /employee/login si no auth
    AdminLayout.tsx               ✅ Sidebar con nav admin (Dashboard, Reportes) + user footer
    Layout.tsx                    ✅ Header + nav desktop (tabs) + nav mobile (bottom bar)
    Button.tsx                    ✅ primary / secondary / destructive + loading state
    EmptyState.tsx                ✅ Ícono + título + subtítulo + CTA opcional
    ErrorBanner.tsx               ✅ Banner rojo + botón Reintentar
    KPICard.tsx                   ✅ Card métrica con variantes de color de estado
    Spinner.tsx                   ✅ Spinner animado
    TrendChart.tsx                ✅ Gráfico de barras recharts (tendencia licencias)
  services/
    authService.ts                ✅ login, activate, refresh, logout, me, mfaSetup, mfaEnable, mfaDisable, mfaChallenge
    recibosService.ts             ✅ list, get (signed URL), firmar
    licenciasService.ts           ✅ tipos, mis-solicitudes, saldo, crear, cancelar, subirDocumento
    comunicacionesService.ts      ✅ list, confirmar
    reportesService.ts            ✅ getDashboard, getHeadcount, getTendenciaLicencias, downloadCsv
    adminLicenciasService.ts      ✅ listSolicitudes, aprobar, rechazar
    adminComunicacionesService.ts ✅ list, create, get, enviar, reenviar
    adminRecibosService.ts        ✅ listPeriodos, createPeriodo, upload, confirmUpload, getRecibos, downloadCsv
    adminUsuariosService.ts       ✅ list, create, invite, suspend, reactivate, baja, getOne, update
    organizacionService.ts        ✅ sedes (list/create/toggle), departamentos (list/create/toggle), puestos (list/create/toggle), convenios (list/create)
    medicoService.ts              ✅ fichas (get/update), exámenes (list/create), vacunaciones (list/create), aptitudes (list/create), accidentes (list/create/update), reportes
    superAdminService.ts          🔄 listTenants, createTenant, getTenant, updateTenant, listTenantUsers, setTenantUserRoles
    smtpConfigService.ts          🔄 get, save, test

  Portal colaborador (/employee/*):
    pages/LoginPage.tsx           ✅ /employee/login
    pages/ActivatePage.tsx        ✅ /employee/activate?token=...
    pages/DashboardPage.tsx       ✅ /employee/dashboard — accesos directos + badge pendientes
    pages/ReceiptsPage.tsx        ✅ /employee/receipts — lista + descarga + modal firma
    pages/LeavesPage.tsx          ✅ /employee/leaves — saldo + historial + modal nueva solicitud (toggle Médica/Administrativa)
    pages/CommunicationsPage.tsx  ✅ /employee/communications — lista + filtros + modal detalle/confirmación
    pages/ProfilePage.tsx         ✅ /employee/profile — datos + cambio de contraseña + MFA setup/disable

  Portal RRHH (/admin/*):
    pages/admin/AdminLoginPage.tsx      ✅ /admin/login — valida que el rol sea rrhh/admin_empresa
    pages/admin/AdminDashboardPage.tsx  ✅ /admin/dashboard — 6 KPIs + gráfico tendencia licencias
    pages/admin/AdminReportsPage.tsx    ✅ /admin/reports — exports CSV licencias y comunicaciones

  Portal RRHH (/admin/*):
    pages/admin/AdminLoginPage.tsx          ✅ /admin/login
    pages/admin/AdminDashboardPage.tsx      ✅ /admin/dashboard — 6 KPIs + tendencia
    pages/admin/AdminReportsPage.tsx        ✅ /admin/reports — exports CSV
    pages/admin/AdminLicenciasPage.tsx      ✅ /admin/licencias — lista + filtro estado + aprobar/rechazar modal
    pages/admin/AdminComunicacionesPage.tsx ✅ /admin/comunicaciones — lista + crear borrador + enviar + reenviar
    pages/admin/AdminRecibosPage.tsx        ✅ /admin/recibos — períodos + upload ZIP/PDF + preview + confirm + dashboard recibos
    pages/admin/AdminUsuariosPage.tsx       ✅ /admin/usuarios — lista + search + crear + suspend/reactivate/baja + reinvitar
    pages/admin/AdminOrganizacionPage.tsx   ✅ /admin/organizacion — 4 tabs (Sedes, Departamentos árbol, Puestos, Convenios), create modal + toggle activo/inactivo
    pages/admin/AdminSmtpConfigPage.tsx     ✅ /admin/configuracion/smtp — toggle NUMI vs custom SMTP, form, test conexión
    pages/admin/AdminTiposLicenciasPage.tsx ✅ /admin/tipos-licencias — lista, crear, eliminar tipos de licencia
    pages/admin/AdminColaboradoresPage.tsx  ✅ /admin/colaboradores — lista con search + filtro estado, cards con avatar/legajo/sede/depto
    pages/admin/AdminColaboradorDetailPage.tsx ✅ /admin/colaboradores/:id — detalle + 3 secciones editables: datos personales, legajo laboral, estructura organizativa

  Portal colaborador (público):
    pages/OnboardingPage.tsx               ✅ /onboarding/:token — formulario self-service para colaboradores invitados

  Portal SuperAdmin (/superadmin/*):
    components/SuperAdminLayout.tsx        ✅ Sidebar NUMI branding + nav (Empresas) + logout
    pages/superadmin/SuperAdminLoginPage.tsx  ✅ /superadmin/login — login para super_admin
    pages/superadmin/SuperAdminTenantsPage.tsx ✅ /superadmin/tenants — gestión global de tenants: list/search/filter, create, edit, manage users con roles múltiples

  Portal médico (/admin/medico/*):
    pages/admin/AdminMedicoFichasPage.tsx      ✅ /admin/medico/fichas — lista + modal detalle (ficha, exámenes, aptitudes, vacunaciones)
    pages/admin/AdminMedicoAccidentesPage.tsx  ✅ /admin/medico/accidentes — lista + crear + actualizar estado/ART
    pages/admin/AdminMedicoReportesPage.tsx    ✅ /admin/medico/reportes — absentismo + aptitudes por vencer
```

### Módulos del backend — estado de implementación
```
app/routers/
  auth.py          ✅ POST /auth/login, /refresh, /logout, /activate, GET /auth/me, GET /auth/mfa/setup, POST /auth/mfa/enable, /auth/mfa/disable, /auth/mfa/challenge
  users.py         ✅ CRUD + invitaciones + ciclo de vida (suspend/reactivate/baja)
  recibos.py       ✅ Períodos, upload ZIP/PDF, distribución, firma, CSV export
  whatsapp.py      ✅ GET|POST /webhook, GET|PUT /config
  licencias.py     ✅ tipos, políticas, solicitudes (CRUD + aprobar/rechazar/cancelar), saldo
  comunicaciones.py ✅ POST /comunicaciones, GET /comunicaciones, GET /{id}, POST /{id}/adjuntos, POST /{id}/enviar, POST /{id}/reenviar, GET /colaborador, POST /{id}/confirmar
  medico.py        ✅ GET /medico/fichas, GET|PUT /medico/fichas/{user_id}, GET|POST /medico/examenes/{user_id}, GET|POST /medico/vacunaciones/{user_id}, GET|POST /medico/aptitudes/{user_id}, GET|POST /medico/accidentes, PATCH /medico/accidentes/{id}, GET /medico/reportes/absentismo, GET /medico/reportes/aptitudes-por-vencer
  reportes.py      ✅ GET /reportes/dashboard, GET /reportes/headcount, GET /reportes/licencias, GET /reportes/export/licencias, GET /reportes/export/comunicaciones
  tenants.py       ✅ GET|POST /tenants, GET|PATCH /tenants/{id}, GET /tenants/me, PATCH /tenants/me/branding, GET|POST /sedes, PATCH /sedes/{id}, GET|POST /departamentos, PATCH /departamentos/{id}, GET|POST /puestos, PATCH /puestos/{id}, GET|POST /convenios
  invitaciones.py  ✅ POST /admin/invitaciones/individual, /admin/invitaciones/lote, /admin/invitaciones/lote/csv, GET /onboarding/{token}, POST /onboarding/{token}/completar
  smtp_config.py   ✅ GET /admin/configuracion/smtp, PUT /admin/configuracion/smtp, POST /admin/configuracion/smtp/test
```

### Repositorios implementados
```
app/repositories/
  user_repository.py                       ✅ CRUD + ciclo de vida + búsqueda + get_by_wa_id
  token_repository.py                      ✅ refresh tokens + invite tokens
  colaborador_repository.py                ✅ crear/actualizar perfil
  periodo_repository.py                    ✅ CRUD períodos de liquidación
  recibo_repository.py                     ✅ CRUD recibos + firmas + export + get_latest_unsigned
  whatsapp_config_repository.py            ✅ CRUD config WA por tenant
  whatsapp_session_repository.py           ✅ FSM session manager (DB-based, TTL 10 min)
  whatsapp_log_repository.py               ✅ log de mensajes inbound/outbound
  tipo_licencia_repository.py              ✅ list (globales + tenant), get, create
  politica_licencia_repository.py          ✅ list, get_for_tipo, create
  solicitud_licencia_repository.py         ✅ create, get, list_all, list_by_user, has_overlap, update_estado
  saldo_licencia_repository.py             ✅ get, list_for_user, ensure_saldo, add/subtract_pendientes, approve
  comunicacion_repository.py               ✅ create, get, list_by_tenant, update_estado, set_enviado, mark_enviado_completo
  comunicacion_destinatario_repository.py  ✅ bulk_create, list_by_comunicacion, list_by_user, get_for_user, mark_leido/confirmado, get_metricas
  comunicacion_adjunto_repository.py       ✅ create, list_by_comunicacion, upload_and_create
  ficha_medica_repository.py               ✅ get, upsert (AES-256), list_with_users
  examen_medico_repository.py              ✅ create, list_by_user, update_storage_path
  vacunacion_repository.py                 ✅ create, list_by_user
  aptitud_laboral_repository.py            ✅ create, list_by_user, list_por_vencer
  accidente_trabajo_repository.py          ✅ create, get, list_by_tenant, update
  reportes_repository.py                   ✅ get_headcount, get_licencias_activas_hoy, get_licencias_pendientes, get_vencimientos_proximos, get_recibos_sin_firmar, get_comunicados_sin_confirmar, get_headcount_por_sede, get_headcount_por_departamento, get_tendencia_licencias, get_licencias_para_export, get_comunicaciones_para_export, get_metricas_comunicacion
  tenant_repository.py                     ✅ list, get, get_by_cuit, get_by_subdominio, create, update
  sede_repository.py                       ✅ list, get, get_by_nombre, create, update
  departamento_repository.py               ✅ list, get, get_by_nombre, count_niveles, create, update
  puesto_repository.py                     ✅ list, get, get_by_nombre, create, update
  convenio_repository.py                   ✅ list, get_by_nombre, create
  upload_job_repository.py                 ✅ create, get, delete — jobs en DB con TTL 1h (reemplaza dict en memoria, DT-005)
  mfa_repository.py                        ✅ get_secret, save_secret, is_enabled, save_backup_codes, use_backup_code
  invitacion_repository.py                 ✅ get_by_token, get_by_cuil_and_tenant, create, mark_completed, list_by_tenant
  smtp_config_repository.py                ✅ get_by_tenant, upsert
```

### Servicios del backend
```
app/services/
  auth_service.py     ✅ login (2-step si MFA activo), refresh, logout, activate, get_me
  mfa_service.py      ✅ setup_totp (genera QR), enable, disable, challenge — TOTP via pyotp + backup codes
  recibo_service.py   ✅ períodos, upload, confirm, distribuir, firmar, CSV
  licencia_service.py ✅ tipos, políticas, solicitudes + notificaciones WA best-effort
  comunicacion_service.py ✅ create, list, enviar (segmentado), reenviar, confirmar + dispatch WA
  medico_service.py   ✅ fichas (AES-256), exámenes (encriptado + storage), vacunaciones, aptitudes, accidentes, reportes
  reporte_service.py  ✅ dashboard KPIs (asyncio.gather), headcount, tendencia, exports CSV
  tenant_service.py   ✅ CRUD tenants + árbol departamentos (_build_tree) + validaciones
  whatsapp_service.py ✅ FSM (idle→menu→recibos/licencias/comunicaciones), verify_webhook, HMAC, notify
  invitacion_service.py ✅ invitar_individual, invitar_lote, parse_csv, get_token_info, completar_onboarding
  smtp_service.py    ✅ get_config, send_invitation (template email), test_connection — soporta TLS/SSL, desencripta password
```

### Variables de entorno requeridas
```
APP_ENV=development
SUPABASE_URL=                  # https://ssppdyvxaeplsyheylyt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=     # service_role key del proyecto Supabase
SECRET_KEY=                    # mín. 32 chars, aleatorio — firma JWTs
ALLOWED_ORIGINS=["http://localhost:5173"]
ENCRYPTION_KEY=                # AES-256 (64 hex chars = 32 bytes) — access_token WA + datos médicos
META_VERIFY_TOKEN=             # Token para verificar webhook de Meta (GET /whatsapp/webhook)
META_APP_SECRET=               # App Secret de Meta para validar firma HMAC-SHA256 de webhooks
```

### Migraciones aplicadas en Supabase remoto
```
20260509210736_init_base_schema.sql      — tenants, sedes, depto, puestos, convenios,
                                           users, colaborador_perfil, invite_tokens, audit_log
20260509212458_add_refresh_tokens.sql    — refresh_tokens
20260509215257_add_recibos_schema.sql    — periodos_liquidacion, recibos,
                                           firmas_electronicas, storage bucket 'recibos'
20260512000000_add_whatsapp_schema.sql   — users.whatsapp_id_hash, whatsapp_config,
                                           whatsapp_sessions, whatsapp_message_log,
                                           whatsapp_templates (con 5 templates seed)
20260512200000_add_licencias_schema.sql  — tipos_licencia, politicas_licencia,
                                           solicitudes_licencia, saldo_licencias,
                                           documentos_solicitud, seed 10 tipos
20260512210000_add_comunicaciones_schema.sql — comunicaciones, comunicacion_destinatarios,
                                               comunicacion_adjuntos, storage bucket 'comunicaciones'
20260512220000_add_medico_schema.sql         — fichas_medicas, examenes_medicos, vacunaciones,
                                               aptitudes_laborales, accidentes_trabajo,
                                               documentos_medicos, storage bucket 'documentos-medicos'
20260513000000_add_mfa_backup_codes.sql      — tabla mfa_backup_codes (user_id, code_hash, used_at)
20260513010000_add_upload_jobs_table.sql     — tabla upload_jobs (id, tenant_id, periodo_id, metadata JSONB, expires_at)
20260515000000_add_roles_array_to_users.sql  — columna roles text[] en users (multi-rol), inicializada desde role existente
20260515010000_add_invitaciones_smtp.sql     — tabla invitaciones (token, cuil, email, TTL 7d) + tabla smtp_config
```

### Storage Supabase
```
Bucket: recibos (privado)
Path:   {tenant_id}/{periodo_id}/{cuil}.pdf
Acceso: solo vía signed URL (TTL 24h) — nunca exponer storage_path al cliente
```

### Convenciones clave de código
```
- JWT: HS256, secret_key mín 32 chars — access 8h, refresh 30d
- Tokens: siempre hash SHA-256 en DB, nunca el valor plano
- Tenant isolation: tenant_id extraído del JWT, NUNCA del body/query
- Paginación: Pagination(total, page, page_size, pages, next, prev)
- Tests: UUIDs reales (formato 00000000-...), no strings como "user-uuid-1"
- pytest-asyncio mode: STRICT — todos los tests async deben tener @pytest.mark.asyncio
- Storage async: await db.storage.from_("bucket").upload/create_signed_url(...)
```

---

## LOG DE SESIONES

### 2026-05-16 — Sesión 17
**Duración aproximada:** 45 min
**Objetivo de la sesión:** Módulo Colaboradores RRHH + bugs críticos backend

**Completado:**

**Backend — bugfixes:**
- `backend/app/repositories/user_repository.py` — `update()`: eliminado `.single()` inválido después de `.update()` (`.single()` no existe en `AsyncFilterRequestBuilder`); cambiado a `res.data[0] if res.data else None`. Causa: PATCH `/users/{id}` retornaba 500 cuando se modificaban `first_name` o `last_name`.
- `backend/app/repositories/colaborador_repository.py` — `update()`: cambiado de `UPDATE` a `UPSERT` con `on_conflict="user_id"`, agregado `tenant_id` al payload y a la firma. Causa: colaboradores sin fila en `colaborador_perfil` (pendientes de activación) no guardaban ningún campo — era un silencioso no-op.
- `backend/app/services/user_service.py` — actualizado ambos calls a `_colaboradores.update()` para pasar `tenant_id`.

**Frontend — módulo Colaboradores RRHH:**
- `frontend/src/types/index.ts` — agregados `ColaboradorPerfil`, `UserDetail`, `UpdateUserRequest`
- `frontend/src/services/adminUsuariosService.ts` — agregados métodos `getOne` y `update`
- `frontend/src/components/AdminLayout.tsx` — "Colaboradores" agregado al nav de RRHH (icono `Users`)
- `frontend/src/pages/admin/AdminColaboradoresPage.tsx` — lista paginada filtrada a `role=colaborador`; search debounced (300ms); filtro por estado; cards con avatar initials, nombre, estado badge, email, legajo, sede, departamento; click navega a detalle
- `frontend/src/pages/admin/AdminColaboradorDetailPage.tsx` — breadcrumb; info card superior con nombre/estado/email/CUIL/WA masked; 3 secciones editables: Datos personales (nombre, apellido), Legajo laboral (N° legajo, tipo_contrato select, fecha_ingreso date), Estructura organizativa (sede, departamento flattenado, puesto, convenio); dropdowns cargan desde `organizacionService`; `handleSave` envía `null` para campos vacíos para permitir limpieza en DB; feedback "Cambios guardados" (2500ms auto-hide)
- `frontend/src/App.tsx` — rutas `/admin/colaboradores` y `/admin/colaboradores/:id` con `RoleGuardRoute allowedRoles=["super_admin","rrhh"]`

**Commit:** `e6f574f` — feat: add Colaboradores section for RRHH — list + legajo editor

**Estado al cerrar:** 251 tests pasando. Módulo Colaboradores RRHH completo y probado en browser. Datos persisten correctamente en `colaborador_perfil` vía upsert.

---

### 2026-05-15 — Sesión 16
**Duración aproximada:** En progreso
**Objetivo de la sesión:** Actualizar CLAUDE_GUIDE + documentar Fase 9

**Completado:**
- CLAUDE_GUIDE actualizado con sesiones 12-15 faltantes (DT-005, MFA, Org UI, Medical Portal)
- Nuevos módulos documentados: invitaciones, smtp, superadmin, onboarding, tipos-licencias
- Nuevas migraciones documentadas (roles array, invitaciones+smtp)
- Estado actual actualizado para reflejar trabajo sin commitear

**Trabajo detectado sin commitear (Fase 9):**
- Backend: invitacion_service + invitacion_repository, smtp_service + smtp_config_repository, schemas, 2 routers (ya registrados en main.py)
- Frontend: OnboardingPage, AdminSmtpConfigPage, AdminTiposLicenciasPage, SuperAdminLayout, SuperAdminLoginPage, SuperAdminTenantsPage, superAdminService, smtpConfigService
- Migraciones: 20260515000000_add_roles_array_to_users.sql, backend/migrations/004_invitaciones_smtp.sql
- 57 archivos modificados adicionales (refactors de UI, Badge, NumiLogo, etc.)
- Sin tests para nuevos módulos

**Commit:** Pendiente

**Estado al cerrar:** CLAUDE_GUIDE actualizado. Fase 9 documentada. Próximo: commitear trabajo no commiteado + tests.

---


### 2026-05-13 — Sesión 11
**Duración aproximada:** 45 min
**Objetivo de la sesión:** Front-office RRHH — portal admin completo

**Completado:**
- Commits pendientes de sesiones 9 y 10 (Fase 8 + Módulo Tenants)
- Tipos admin en `frontend/src/types/index.ts`: UserSummary, CreateUserRequest, PeriodoLiquidacion, CreatePeriodoRequest, UploadPreviewResponse/Item, UploadConfirmResponse, ReciboDashboardItem, ComunicacionAdmin, NuevaComunicacion, MetricasComunicacion, EstadoUsuario, RolUsuario
- `frontend/src/services/adminLicenciasService.ts` — listSolicitudes (filtros), aprobar, rechazar
- `frontend/src/services/adminComunicacionesService.ts` — list, create, get, enviar, reenviar
- `frontend/src/services/adminRecibosService.ts` — listPeriodos, createPeriodo, upload (multipart), confirmUpload, getRecibos, downloadCsv
- `frontend/src/services/adminUsuariosService.ts` — list (search+filtros), create, invite, suspend, reactivate, baja
- `frontend/src/pages/admin/AdminLicenciasPage.tsx` — lista con filtro estado + ReviewModal (aprobar/rechazar con comentario)
- `frontend/src/pages/admin/AdminComunicacionesPage.tsx` — lista + NuevaComunicacionModal (asunto/cuerpo/segmento/confirmación) + acciones enviar/reenviar inline
- `frontend/src/pages/admin/AdminRecibosPage.tsx` — NuevoPeriodoModal + UploadModal (selección archivo → preview CUIL → confirm distribución) + PeriodoDetalle (dashboard recibos + CSV export)
- `frontend/src/pages/admin/AdminUsuariosPage.tsx` — lista con search + filtro estado + NuevoUsuarioModal + ConfirmModal para suspend/baja/reactivate + acción reinvitar
- `AdminLayout.tsx` — sidebar actualizado con Licencias, Comunicaciones, Recibos, Usuarios
- `App.tsx` — rutas /admin/licencias, /admin/comunicaciones, /admin/recibos, /admin/usuarios
- Build TypeScript sin errores (2330 módulos)

**Estado al cerrar:** Portal RRHH completo. 4 módulos de front-office implementados. Próximo: MFA o Deploy.

---

### 2026-05-13 — Sesión 12
**Duración aproximada:** 30 min
**Objetivo de la sesión:** DT-005 — reemplazar job store en memoria por DB + Storage

**Completado:**
- Migración `20260513010000_add_upload_jobs_table.sql` — tabla `upload_jobs` con TTL 1h
- `app/repositories/upload_job_repository.py` — create, get, delete
- `app/services/recibo_service.py` — upload ahora guarda PDFs en `temp/{job_id}/` en Supabase Storage; confirm descarga de temp, mueve a path final, limpia temp
- Tests actualizados en `tests/services/test_recibo_service.py`
- DT-005 resuelto: job store ya no es process-scoped, sobrevive reinicios y múltiples workers

**Commit:** `1dfa8e9` — fix: replace in-memory upload job store with DB + Storage (DT-005)

**Estado al cerrar:** DT-005 resuelto. Próximo: MFA.

---

### 2026-05-13 — Sesión 13
**Duración aproximada:** 45 min
**Objetivo de la sesión:** DT-002 — MFA TOTP

**Completado:**
- Migración `20260513000000_add_mfa_backup_codes.sql` — tabla `mfa_backup_codes`
- `app/repositories/mfa_repository.py` — get/save secret, is_enabled, save/use backup codes
- `app/services/mfa_service.py` — setup_totp (genera QR + secret), enable (valida TOTP + genera 10 backup codes), disable (requiere TOTP), challenge (acepta TOTP o backup code)
- `app/routers/auth.py` — 4 nuevos endpoints: GET /auth/mfa/setup, POST /auth/mfa/enable, /auth/mfa/disable, /auth/mfa/challenge
- `app/schemas/auth.py` — MfaSetupResponse, MfaEnableRequest, MfaChallengeRequest, MfaChallengeResponse
- `pyotp` + `qrcode[pil]` agregados a requirements
- Login: flujo 2-step — si MFA activo, /auth/login retorna `mfa_required=true` + `mfa_token` (JWT corto de 5min); frontend llama /auth/mfa/challenge para obtener el JWT final
- Frontend: `LoginPage.tsx` + `AdminLoginPage.tsx` — 2 pasos inline (email/pass → código TOTP)
- Frontend: `ProfilePage.tsx` — sección MFA con setup QR + backup codes + disable
- `frontend/src/services/authService.ts` + `frontend/src/types/index.ts` actualizados
- 15 tests nuevos (8 service + 7 router), 195 totales pasando

**Commit:** `e8867ea` — feat: implement MFA TOTP authentication (DT-002)

**Estado al cerrar:** DT-002 resuelto. 195 tests pasando. Próximo: Admin Org Structure UI.

---

### 2026-05-13 — Sesión 14
**Duración aproximada:** 30 min
**Objetivo de la sesión:** Admin Org Structure UI — página /admin/organizacion

**Completado:**
- `frontend/src/services/organizacionService.ts` — sedes (list/create/toggle), departamentos (list/create/toggle), puestos (list/create/toggle), convenios (list/create)
- `frontend/src/pages/admin/AdminOrganizacionPage.tsx` — 4 tabs (Sedes, Departamentos, Puestos, Convenios); departamentos renderiza árbol anidado con expand/collapse (máx. 3 niveles); cada tab tiene create modal + toggle activo/inactivo
- `AdminLayout.tsx` — nav link "Organización" agregado
- `App.tsx` — ruta `/admin/organizacion`
- `frontend/src/types/index.ts` — tipos SedeOut, DepartamentoOut (árbol), PuestoOut, ConvenioOut

**Commit:** `f383a98` — feat: implement admin org structure UI (sedes, departamentos, puestos, convenios)

**Estado al cerrar:** UI de estructura organizacional completa. Próximo: Medical Portal UI.

---

### 2026-05-13 — Sesión 15
**Duración aproximada:** 45 min
**Objetivo de la sesión:** Medical Portal UI — /admin/medico/*

**Completado:**
- `frontend/src/services/medicoService.ts` — fichas (get/update), exámenes (list/create), vacunaciones (list/create), aptitudes (list/create), accidentes (list/create/update), reportes (absentismo, aptitudes por vencer)
- `frontend/src/pages/admin/AdminMedicoFichasPage.tsx` — lista de fichas con search + modal detalle con 4 tabs (ficha editable, exámenes, aptitudes, vacunaciones)
- `frontend/src/pages/admin/AdminMedicoAccidentesPage.tsx` — lista con filtro estado + create modal + update estado/ART
- `frontend/src/pages/admin/AdminMedicoReportesPage.tsx` — absentismo por departamento + aptitudes por vencer con horizonte configurable
- `AdminLayout.tsx` — nav médico solo visible para roles `servicio_medico`, `admin_empresa`, `super_admin`; `AdminLoginPage.tsx` redirige `servicio_medico` a `/admin/medico/fichas`
- `App.tsx` — rutas `/admin/medico/*`
- `frontend/src/types/index.ts` — tipos FichaMedica, ExamenMedico, AptitudLaboral, Vacunacion, AccidenteTrabajo, ReporteAbsentismo, AptitudPorVencer

**Commit:** `283a86c` — feat: implement medical portal (fichas, accidentes, reportes)

**Estado al cerrar:** Sistema feature-complete v1.0. 195 tests pasando. Build sin errores.

---

### 2026-05-13 — Sesión 10
**Duración aproximada:** 45 min
**Objetivo de la sesión:** Módulo Tenants (pendiente desde Fase 1)

**Completado:**
- `app/schemas/tenants.py` — TenantCreate/Update/BrandingUpdate/Out/Summary, SedeCreate/Update/Out, DepartamentoCreate/Update/Out (árbol recursivo), PuestoCreate/Update/Out, ConvenioCreate/Out + schemas paginados
- `app/repositories/tenant_repository.py` — list (con filtros), get, get_by_cuit, get_by_subdominio, create, update
- `app/repositories/sede_repository.py` — list, get, get_by_nombre, create, update
- `app/repositories/departamento_repository.py` — list, get, get_by_nombre, count_niveles (validación máx. 3 niveles), create, update
- `app/repositories/puesto_repository.py` — list, get, get_by_nombre, create, update
- `app/repositories/convenio_repository.py` — list, get_by_nombre, create
- `app/services/tenant_service.py` — CRUD completo + árbol departamentos (_build_tree) + validaciones de unicidad y jerarquía
- `app/routers/tenants.py` — 20 endpoints (tenants, sedes, departamentos, puestos, convenios)
- `main.py` actualizado con tenants router
- 31 tests nuevos (17 service + 14 router), 180 totales pasando

**Decisiones de scope:**
- Endpoints de org structure (`/sedes`, `/departamentos`, `/puestos`, `/convenios`) usan `tenant_id` del JWT → restringidos a `admin_empresa` y `rrhh` (no `super_admin`)
- `GET /tenants/me` y `PATCH /tenants/me/branding` restringidos a `admin_empresa` y `rrhh` (super_admin usa `/tenants/{id}`)
- Creación del primer `admin_empresa` al crear tenant: OUT OF SCOPE v1 (pendiente DT — requiere invite_token + email trigger)
- Importación masiva CSV de estructura: OUT OF SCOPE v1

**Estado al cerrar:** Módulo Tenants completo. 180 tests pasando.

---

### 2026-05-12 — Sesión 9
**Duración aproximada:** 1 hora
**Objetivo de la sesión:** Fase 8 — Reportes + Dashboard RRHH

**Completado:**
- `docs/API_SPEC.md` — nueva sección 13b con 5 endpoints `/reportes`
- `app/schemas/reportes.py` — DashboardKPIs, HeadcountDistribucion, TendenciaLicencias, SedeCount, DepartamentoCount, TendenciaMes
- `app/repositories/reportes_repository.py` — 12 métodos de solo lectura para KPIs y exports
- `app/services/reporte_service.py` — dashboard KPIs (asyncio.gather concurrente), headcount, tendencia mensual, exports CSV licencias y comunicaciones
- `app/routers/reportes.py` — 5 endpoints: GET /dashboard, /headcount, /licencias, /export/licencias, /export/comunicaciones
- `main.py` actualizado con reportes router
- 18 tests nuevos (10 service + 8 router), 149 totales pasando
- `frontend/src/lib/apiClient.ts` — redirect 401 inteligente: `/admin/login` si path es `/admin/*`, `/employee/login` en otro caso
- `frontend/src/types/index.ts` — tipos TS para DashboardKPIs, HeadcountDistribucion, TendenciaLicencias, etc.
- `frontend/src/services/reportesService.ts` — getDashboard, getHeadcount, getTendenciaLicencias, downloadCsv
- `frontend/src/components/AdminLayout.tsx` — sidebar con nav admin (Dashboard, Reportes) + user footer
- `frontend/src/components/KPICard.tsx` — card con variantes de color de estado
- `frontend/src/components/TrendChart.tsx` — gráfico de barras recharts con leyenda y tooltips
- `frontend/src/pages/admin/AdminLoginPage.tsx` — `/admin/login` con validación de rol
- `frontend/src/pages/admin/AdminDashboardPage.tsx` — `/admin/dashboard` con KPIs + gráfico tendencia
- `frontend/src/pages/admin/AdminReportsPage.tsx` — `/admin/reports` con filtros y exports CSV
- `frontend/src/App.tsx` — rutas `/admin/*` con AdminProtectedRoute (requiere rrhh/admin_empresa/super_admin)
- Build TypeScript sin errores

**Rutas admin implementadas:**
- `/admin/login` — login con validación de rol RRHH
- `/admin/dashboard` — 6 KPI cards + gráfico de barras tendencia licencias
- `/admin/reports` — exportaciones CSV de licencias y comunicaciones con filtros

**Commits realizados:** Pendiente

**Estado al cerrar:** Fase 8 completa. 149 tests pasando. Build exitoso. Todas las fases 1–8 completadas.

---

### 2026-05-12 — Sesión 8
**Duración aproximada:** 1 hora
**Objetivo de la sesión:** Fase 7 — Servicio Médico

**Completado:**
- Migración: `fichas_medicas`, `examenes_medicos`, `vacunaciones`, `aptitudes_laborales`, `accidentes_trabajo`, `documentos_medicos` + storage bucket `documentos-medicos`
- Triggers `updated_at` para `fichas_medicas` y `accidentes_trabajo`
- 5 repositorios: `ficha_medica_repository`, `examen_medico_repository`, `vacunacion_repository`, `aptitud_laboral_repository`, `accidente_trabajo_repository`
- `app/schemas/medico.py` — todos los schemas del módulo
- `app/services/medico_service.py` — fichas (AES-256 en campos), exámenes (resultado encriptado + upload a storage), vacunaciones, aptitudes (validación restricciones), accidentes + reportes absentismo y aptitudes-por-vencer
- `app/routers/medico.py` — 13 endpoints registrados bajo `/medico`
- `main.py` actualizado con medico router
- 24 tests nuevos (16 service + 8 router), 131 totales pasando
- Migración aplicada en Supabase remoto

**Arquitectura de seguridad del módulo médico:**
- `alergias` y `condiciones` en fichas: JSON encriptado AES-256-GCM via `ENCRYPTION_KEY`
- `resultado` en exámenes: texto encriptado AES-256-GCM
- Acceso exclusivo: `servicio_medico`, `admin_empresa`, `super_admin` — RRHH bloqueado
- Signed URLs documentos: 6h (más restrictivo que recibos 24h)

**Commits realizados:** Pendiente

**Estado al cerrar:** Fase 7 completa. 131 tests pasando. Migración aplicada. Próximo: Fase 8 Reportes + Dashboard RRHH.

---

### 2026-05-12 — Sesión 7
**Duración aproximada:** 1 hora
**Objetivo de la sesión:** Fase 6 — Portal Web del colaborador

**Completado:**
- Instalación: `react-router-dom` + `lucide-react`
- Tailwind v4 tokens en `index.css` (`@theme`) — colores de marca, estado, superficie, contenido
- `src/types/index.ts` — tipos para auth, recibos, licencias, comunicaciones
- `src/services/` — authService, recibosService, licenciasService, comunicacionesService
- `src/contexts/AuthContext.tsx` — estado global de auth + login/logout/refreshUser
- `src/components/` — ProtectedRoute, Layout, Button, EmptyState, ErrorBanner, Spinner
- `src/pages/` — LoginPage, ActivatePage, DashboardPage, ReceiptsPage, LeavesPage, CommunicationsPage, ProfilePage
- `App.tsx` — routing con react-router-dom (BrowserRouter + nested routes)
- Fix `apiClient.ts` redirect 401 → `/employee/login`
- Build TypeScript exitoso sin errores (tsc + vite build)

**Rutas implementadas:**
- `/employee/login` — login con email/contraseña
- `/employee/activate?token=...` — activación de cuenta
- `/employee/dashboard` — dashboard con badges pendientes
- `/employee/receipts` — recibos + modal firma electrónica
- `/employee/leaves` — licencias + saldo + modal nueva solicitud
- `/employee/communications` — comunicados + filtros + modal confirmación
- `/employee/profile` — datos personales + cambio contraseña

**Fixes adicionales en sesión:**
- `app/db/supabase.py` — bug crítico: `create_client` async no se awaiteaba (lru_cache sincrónico). Fix: singleton global con await.
- `backend/.env` — ALLOWED_ORIGINS ampliado a `["http://localhost:5173","http://localhost:5174"]`
- `backend/seed_demo.py` — script de seed para tenant + usuarios demo (no commitear, contiene service_role_key hardcodeada)
- Nota documentada: uvicorn `--reload` no detecta cambios en `.env`, requiere reinicio manual.

**Commits realizados:** Pendiente

**Estado al cerrar:** Fase 6 completa y probada localmente. Backend corriendo en :8000, frontend en :5174. Login funcional. Próximo: Fase 7 Servicio Médico.

---

### 2026-05-12 — Sesión 6
**Duración aproximada:** 1 hora
**Objetivo de la sesión:** Fase 5 — Comunicaciones institucionales

**Completado:**
- Migración: `comunicaciones`, `comunicacion_destinatarios`, `comunicacion_adjuntos` + bucket storage `comunicaciones`
- 3 repositorios: `comunicacion_repository`, `comunicacion_destinatario_repository`, `comunicacion_adjunto_repository`
- `app/schemas/comunicaciones.py` — todos los schemas del módulo
- `app/services/comunicacion_service.py` — lógica completa: create, list, get, add_adjunto, enviar, reenviar, list_for_colaborador, confirmar + segmentación por todos/sede/departamento/puesto/lista_custom + dispatch WA best-effort
- `app/routers/comunicaciones.py` — 8 endpoints registrados
- `main.py` actualizado con comunicaciones router
- FSM WhatsApp extendido: opción 3️⃣ en menú + estados `comunicaciones_ver → comunicaciones_confirmar`, keywords `_KEYWORDS_COMUNICACIONES`, `_KEYWORDS_LEIDO`
- `app/routers/whatsapp.py` actualizado para pasar `comunicacion_repo` y `comunicacion_dest_repo` al servicio
- 26 tests nuevos (17 service + 9 router), 107 totales pasando

**Commits realizados:**
- `632899c` — feat: implement comunicaciones module (fase 5)

**Estado al cerrar:** Fase 5 completa. 107 tests pasando. Migración aplicada en Supabase remoto. Próximo: Fase 6 Portal Web.

### 2026-05-09 — Sesión 1
**Duración aproximada:** 1 hora
**Objetivo de la sesión:** Setup inicial del proyecto

**Completado:**
- Estructura de carpetas completa (backend, frontend, tests, supabase, docs)
- Archivos base: main.py, config.py, exception_handlers.py, supabase.py, apiClient.ts
- Documentación: DATA_MODEL.md completo para HRConnect (30 tablas)
- CLAUDE.md y CLAUDE_GUIDE.md actualizados con datos reales del proyecto
- Eliminada carpeta `proyecto/` (template obsoleto)
- `.claude/settings.json` commiteado

**Commits realizados:**
- `921593d` — chore: add Claude Code permissions config

**Decisiones tomadas:** Ver sección Decisiones Técnicas (4 entradas)
**Deuda generada:** DT-001 (queue), DT-002 (MFA), DT-003 (firma digital), DT-004 (reset password)
**Quedó pendiente:** API_SPEC.md para HRConnect, setup entornos, primera migración
**Estado al cerrar:** Documentación de datos completa. Falta API_SPEC y entornos para empezar a codear.

### 2026-05-09 — Sesión 2
**Duración aproximada:** 2 horas
**Objetivo de la sesión:** Módulo auth completo

**Completado:**
- API_SPEC.md completo para HRConnect (todos los endpoints)
- Setup backend: venv Python 3.12, requirements.txt, estructura de carpetas
- Setup frontend: React 18 + TypeScript + Vite + Tailwind v4
- Migración inicial aplicada en Supabase remoto (tenants, sedes, depto, puestos, convenios, users, colaborador_perfil, invite_tokens, audit_log)
- Migración refresh_tokens aplicada en Supabase remoto
- Módulo auth completo:
  - `app/schemas/auth.py` — LoginRequest, ActivateRequest (con validadores), RefreshRequest, LogoutRequest
  - `app/schemas/user.py` — UserSummary (computed full_name), UserMe, TokenPair, LoginResponse, ActivateResponse, RefreshResponse
  - `app/repositories/user_repository.py` — get_by_email, get_by_id, get_by_id_with_profile, update_last_login, activate, get_by_cuil_and_tenant
  - `app/repositories/token_repository.py` — create/get/revoke refresh_token, get/use invite_token
  - `app/services/auth_service.py` — login, refresh, logout, activate, get_me
  - `app/dependencies/auth.py` — get_current_user, require_role
  - `app/routers/auth.py` — 5 endpoints registrados
  - `main.py` actualizado con auth router
  - Tests: 19/19 pasando (repositories, services, routers)

**Commits realizados:**
- `971b55c` — feat: implement auth module with full test coverage
- `0d18ab4` — feat: implement users module with full lifecycle management

**Quedó pendiente:** (nada — todo commiteado)
**Estado al cerrar:** Auth + usuarios implementados. 29 tests pasando. Próximo: Fase 2 recibos.

### 2026-05-09 — Sesión 3
**Duración aproximada:** 1.5 horas
**Objetivo de la sesión:** Fase 2 — Recibos de sueldo

**Completado:**
- Migración: periodos_liquidacion + recibos + firmas_electronicas + storage bucket `recibos` (privado)
- DB trigger `sync_recibos_firmados` mantiene contador desnormalizado automáticamente
- Módulo recibos completo (commit `5082ae2`):
  - `GET/POST /periodos` — lista y crea períodos de liquidación
  - `POST /periodos/{id}/upload` — sube ZIP o PDF, extrae CUIL de nombre de archivo, retorna preview
  - `POST /periodos/{id}/upload/{job_id}/confirm` — sube PDFs a Supabase Storage, crea registros en DB
  - `GET /periodos/{id}/recibos` — dashboard con estado de firma por colaborador
  - `POST /periodos/{id}/renotificar` — re-notifica no firmados (WhatsApp pendiente DT-006)
  - `GET /recibos` — recibos del colaborador autenticado
  - `GET /recibos/{id}` — recibo con signed URL (24h) + marca visto_at
  - `POST /recibos/{id}/firmar` — firma electrónica probatoria (hash SHA-256 + timestamp UTC + IP + session_id)
  - `GET /recibos/export` — CSV con estado de firmas por período
- python-multipart agregado a requirements
- 12 tests nuevos, 41 totales pasando

**Deuda generada:**
- DT-005: job store de upload en memoria (dict process-scoped) — debe reemplazarse con Redis o tabla DB
- DT-006: renotificar por WhatsApp pendiente de implementación del bot

**Commits realizados:**
- `5082ae2` — feat: implement recibos module (fase 2)
- `4f466be` — docs: update CLAUDE_GUIDE — fase 2 completada, próximo WhatsApp bot

**Estado al cerrar:** Fases 1 y 2 completas. 41 tests pasando. Próximo: Fase 3 WhatsApp bot.

### 2026-05-12 — Sesión 5
**Duración aproximada:** 1.5 horas
**Objetivo de la sesión:** Fase 4 — Licencias + Aprobación RRHH + DT-007 fix

**Completado:**
- Migración: `tipos_licencia`, `politicas_licencia`, `solicitudes_licencia` (con sequence + trigger `LIC-YYYY-NNNNN`), `saldo_licencias`, `documentos_solicitud`
- Seed: 10 tipos de licencia globales (VAC, ENF, MAT, PAT, MAT-C, DUE, EST, ART, SGS, CUST)
- DT-007 resuelto: `user_service.create_user` ahora puebla `whatsapp_id_hash` (SHA-256) y `whatsapp_id_encrypted` (AES-256) al crear usuario
- `users` tabla: nueva columna `whatsapp_id_encrypted` en migración
- 4 repositorios: `tipo_licencia_repository`, `politica_licencia_repository`, `solicitud_licencia_repository`, `saldo_licencia_repository`
- `app/schemas/licencias.py` — todos los schemas del módulo
- `app/services/licencia_service.py` — lógica completa + notificaciones WA best-effort
- `app/routers/licencias.py` — 11 endpoints registrados
- WhatsApp FSM extendido: `licencias_tipo → licencias_fechas → licencias_confirmar`, `licencias_saldo`, menú actualizado con opción 2️⃣
- `main.py` actualizado con licencias router
- 22 tests nuevos (13 service + 9 router), 81 totales pasando

**Deuda resuelta:** DT-007

**Commits realizados:**
- Pendiente de commit

**Estado al cerrar:** Fase 4 completa. 81 tests pasando. Próximo: Fase 5 Comunicaciones.

---

### 2026-05-12 — Sesión 4
**Duración aproximada:** 1.5 horas
**Objetivo de la sesión:** Fase 3 — WhatsApp Bot (FSM core + flujos recibos)

**Completado:**
- Migración: `whatsapp_config`, `whatsapp_sessions`, `whatsapp_message_log`, `whatsapp_templates` + `users.whatsapp_id_hash`
- Seed de 5 templates HSM globales en migración
- `app/core/config.py` — vars `META_VERIFY_TOKEN`, `META_APP_SECRET`, `ENCRYPTION_KEY`
- `app/utils/encryption.py` — AES-256-GCM encrypt/decrypt
- `app/schemas/whatsapp.py` — WhatsappConfigOut, WhatsappConfigUpdate, InboundMessage, BotSessionOut
- `app/repositories/whatsapp_config_repository.py` — get_by_tenant, get_by_phone_number_id, upsert, set_active
- `app/repositories/whatsapp_session_repository.py` — get, upsert, increment_count, reset, is_expired
- `app/repositories/whatsapp_log_repository.py` — log inbound/outbound con manejo silencioso de errores
- `app/services/meta_api.py` — MetaApiClient: send_text, send_template, send_document
- `app/services/whatsapp_service.py` — FSM completa (idle → menu → recibos_ver → recibos_confirmar), verify_webhook, validate_hmac, process_webhook, notify_recibo, send_activation_link
- `app/routers/whatsapp.py` — 4 endpoints: GET /webhook, POST /webhook, GET /config, PUT /config
- `app/repositories/recibo_repository.py` — get_by_id_for_user, get_latest_unsigned, mark_visto
- `app/repositories/user_repository.py` — get_by_wa_id (por SHA-256 hash)
- `app/services/recibo_service.py` — DT-006 resuelto parcialmente (renotificar real, falta wa_id raw), tenant_id en firma
- `app/routers/recibos.py` — pasa WhatsappConfigRepository al service
- `main.py` — incluye whatsapp router
- 18 tests nuevos (13 service + 5 router), 59 totales pasando

**Deuda generada:**
- DT-007: `whatsapp_id_hash` no se puebla en `create_user` — falta pasar hash desde user_service (requiere capturar número E.164 completo)

**Commits realizados:**
- `5c41d1e` — feat: implement WhatsApp bot module (fase 3)

**Estado al cerrar:** Fase 3 completa. 59 tests pasando. Próximo: Fase 4 Licencias.

---

## COMANDOS ÚTILES DEL PROYECTO

```bash
# Backend
cd backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev

# Tests
cd backend && pytest
cd backend && pytest tests/routers/ -v

# Supabase
supabase start                          # levantar local
supabase migration new nombre           # nueva migración
supabase db reset                       # aplicar migraciones en local
supabase db push                        # aplicar en producción

# Deploy (manual)
git push origin main                    # Render detecta y redeploya
```

---

## CONTACTOS Y RECURSOS EXTERNOS

| Servicio | Propósito | URL / Referencia |
|----------|-----------|-----------------|
| Supabase | Base de datos + Auth | Dashboard en supabase.com |
| Meta for Developers | WhatsApp Cloud API | developers.facebook.com |
| Render | Deploy backend + frontend | dashboard.render.com |
