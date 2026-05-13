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
Módulo Tenants — completado
Última actualización: 2026-05-13
Tests: 180 pasando
Commits pendientes: sesiones 8, 9, 10 sin commitear (fases 7, 8, módulo tenants)
```

### En este momento estoy trabajando en
```
Nada.
```

### Próximo paso concreto
```
Sin tarea definida. Posibles trabajos:
- Mejoras UX: paginación en listas, búsqueda de colaboradores
- Deploy y validación en producción (push a Render + variables de entorno META)
- MFA antes de producción (DT-002)
```

### Bloqueantes activos
```
- Para activar WA en prod: configurar META_VERIFY_TOKEN + META_APP_SECRET en Render
- Para notificaciones reales: cada tenant debe hacer PUT /whatsapp/config con su access_token de Meta
- supabase db push pendiente con migración 20260512200000_add_licencias_schema.sql
- ALLOWED_ORIGINS en .env local: ["http://localhost:5173","http://localhost:5174"]
- uvicorn --reload NO detecta cambios en .env — reiniciar manualmente si se cambia
- Deploy en Render nunca realizado — push a main pendiente
```

### Notas de desarrollo local
```
- seed_demo.py en backend/ para seed de datos de prueba (no commitear — tiene service_role_key)
  Credenciales demo: colab@demo.com / Colab1234 | admin@demo.com / Admin1234
- Backend corre en :8000, frontend en :5173 o :5174 según disponibilidad
```

### Pendiente para próxima sesión
```
Opciones (en orden de impacto para producción):
1. Front-office RRHH — UI para aprobar licencias, crear comunicaciones, subir recibos, gestionar usuarios
2. MFA (TOTP) — DT-002 — obligatorio antes de prod para admin/rrhh/médico
3. Deploy a Render — push main + variables de entorno en Render
4. DT-005 — Job store de upload en Redis o tabla DB (en lugar de dict en memoria)
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
| DT-002 | MFA (TOTP) pendiente hasta antes de producción | Seguridad para roles admin/rrhh/médico | Alta | 2026-05-09 |
| DT-003 | Firma digital Ley 25.506 fuera de scope v1.0 | Legal — implementar en v1.1 | Media | 2026-05-09 |
| DT-004 | Reset de contraseña por email fuera de scope v1.0 | UX — flujo de recuperación manual | Baja | 2026-05-09 |
| DT-005 | Job store de upload de recibos en `dict` en memoria — no sobrevive restart ni multi-proceso | Confiabilidad en deploy multi-worker | Alta | 2026-05-09 |
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
    authService.ts                ✅ login, activate, refresh, logout, me
    recibosService.ts             ✅ list, get (signed URL), firmar
    licenciasService.ts           ✅ tipos, mis-solicitudes, saldo, crear, cancelar, subirDocumento
    comunicacionesService.ts      ✅ list, confirmar
    reportesService.ts            ✅ getDashboard, getHeadcount, getTendenciaLicencias, downloadCsv

  Portal colaborador (/employee/*):
    pages/LoginPage.tsx           ✅ /employee/login
    pages/ActivatePage.tsx        ✅ /employee/activate?token=...
    pages/DashboardPage.tsx       ✅ /employee/dashboard — accesos directos + badge pendientes
    pages/ReceiptsPage.tsx        ✅ /employee/receipts — lista + descarga + modal firma
    pages/LeavesPage.tsx          ✅ /employee/leaves — saldo + historial + modal nueva solicitud
    pages/CommunicationsPage.tsx  ✅ /employee/communications — lista + filtros + modal detalle/confirmación
    pages/ProfilePage.tsx         ✅ /employee/profile — datos + cambio de contraseña

  Portal RRHH (/admin/*):
    pages/admin/AdminLoginPage.tsx      ✅ /admin/login — valida que el rol sea rrhh/admin_empresa
    pages/admin/AdminDashboardPage.tsx  ✅ /admin/dashboard — 6 KPIs + gráfico tendencia licencias
    pages/admin/AdminReportsPage.tsx    ✅ /admin/reports — exports CSV licencias y comunicaciones

  ⏳ Portal RRHH SIN IMPLEMENTAR (solo back-end existe):
    - Gestión de licencias (aprobar/rechazar)
    - Crear/enviar comunicaciones
    - Subir recibos de sueldo (upload ZIP/PDF)
    - CRUD usuarios (crear, suspender, dar de baja)
    - Gestión de estructura org (sedes, departamentos, puestos)
    - Servicio médico (fichas, exámenes, aptitudes)
```

### Módulos del backend — estado de implementación
```
app/routers/
  auth.py          ✅ POST /auth/login, /refresh, /logout, /activate, GET /auth/me
  users.py         ✅ CRUD + invitaciones + ciclo de vida (suspend/reactivate/baja)
  recibos.py       ✅ Períodos, upload ZIP/PDF, distribución, firma, CSV export
  whatsapp.py      ✅ GET|POST /webhook, GET|PUT /config
  licencias.py     ✅ tipos, políticas, solicitudes (CRUD + aprobar/rechazar/cancelar), saldo
  comunicaciones.py ✅ POST /comunicaciones, GET /comunicaciones, GET /{id}, POST /{id}/adjuntos, POST /{id}/enviar, POST /{id}/reenviar, GET /colaborador, POST /{id}/confirmar
  medico.py        ✅ GET /medico/fichas, GET|PUT /medico/fichas/{user_id}, GET|POST /medico/examenes/{user_id}, GET|POST /medico/vacunaciones/{user_id}, GET|POST /medico/aptitudes/{user_id}, GET|POST /medico/accidentes, PATCH /medico/accidentes/{id}, GET /medico/reportes/absentismo, GET /medico/reportes/aptitudes-por-vencer
  reportes.py      ✅ GET /reportes/dashboard, GET /reportes/headcount, GET /reportes/licencias, GET /reportes/export/licencias, GET /reportes/export/comunicaciones
  tenants.py       ✅ GET|POST /tenants, GET|PATCH /tenants/{id}, GET /tenants/me, PATCH /tenants/me/branding, GET|POST /sedes, PATCH /sedes/{id}, GET|POST /departamentos, PATCH /departamentos/{id}, GET|POST /puestos, PATCH /puestos/{id}, GET|POST /convenios
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
