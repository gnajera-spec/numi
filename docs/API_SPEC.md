# API_SPEC.md — HRConnect

> **Proyecto:** HRConnect — Plataforma HR multi-empresa con canal WhatsApp
> **Versión:** 1.0 | **Fecha:** 2026-05-09
> **Base URL:** `https://api.hrconnect.softlink.com.ar`
> **Protocolo:** HTTPS obligatorio | **Formato:** JSON | **Charset:** UTF-8
> **Fechas:** ISO 8601 UTC — `2026-05-09T14:30:00Z`

---

## 1. Principios de diseño

- **Recursos en plural y sustantivos:** `/users`, `/recibos`, `/licencias`
- **Acciones de negocio como sub-recursos:** `POST /recibos/{id}/firmar` — no `PATCH` con `{"estado": "firmado"}`
- **HTTP semántico:** el método HTTP comunica la intención
- **Envelope consistente:** mismo formato `{data}` / `{data, pagination}` / `{error}` en toda la API
- **Seguridad por defecto:** todos los endpoints requieren auth salvo excepción explícita
- **Aislamiento por tenant:** el `tenant_id` siempre se extrae del JWT, nunca del body o query params

### Implementación en FastAPI
- `app/routers/` — un archivo por módulo
- `app/schemas/` — schemas Pydantic que reflejan exactamente los contratos de este documento
- `app/services/` — lógica de negocio invocada desde routers

---

## 2. Autenticación y autorización

### 2.1 Mecanismo

```http
Authorization: Bearer <access_token>
```

- Access token: JWT firmado con `SECRET_KEY` — expira en **8 horas** (portal back-office)
- Refresh token: JWT — expira en **30 días**
- Token ausente o inválido → `401 AUTH_REQUIRED` / `TOKEN_INVALID`
- Token expirado → `401 TOKEN_EXPIRED`
- Token válido sin permisos → `403 FORBIDDEN`

### 2.2 Roles y permisos

| Rol | Nivel | Alcance |
|-----|-------|---------|
| `super_admin` | 0 | Toda la plataforma — gestión de tenants |
| `admin_empresa` | 1 | Todo dentro de su tenant |
| `rrhh` | 2 | Usuarios, recibos, licencias, comunicaciones |
| `servicio_medico` | 2 | Fichas médicas, aptitudes, accidentes (aislado de datos salariales) |
| `colaborador` | 3 | Solo sus propios datos |

**Convención en la documentación:**
- 🔓 Público — sin auth
- 🔐 Autenticado — cualquier rol válido
- 👤 `colaborador+` — cualquier rol
- 👔 `rrhh+` — rrhh, admin_empresa, super_admin
- 🏥 `medico+` — servicio_medico, admin_empresa, super_admin
- 👑 `admin+` — admin_empresa, super_admin
- 🌐 `super_admin` — solo super_admin

### 2.3 Rate limiting

| Endpoint | Límite | Ventana |
|----------|--------|---------|
| Auth (login, refresh) | 5 requests | 1 min por IP |
| POST/PUT/PATCH/DELETE | 60 requests | 1 min por token |
| GET (listados) | 300 requests | 1 min por token |
| Webhook WhatsApp | Sin límite | — |

---

## 3. Formato de respuestas

### 3.1 Objeto único
```json
{ "data": { "id": "...", "campo": "valor" } }
```

### 3.2 Lista paginada
```json
{
  "data": [],
  "pagination": {
    "total": 243,
    "page": 1,
    "page_size": 20,
    "pages": 13,
    "next": "/users?page=2&page_size=20",
    "prev": null
  }
}
```

### 3.3 Error
```json
{
  "error": {
    "code": "VAL_FORMAT",
    "message": "El CUIL ingresado no es válido.",
    "details": [{ "field": "cuil", "code": "INVALID_FORMAT", "message": "Debe tener 11 dígitos sin guiones" }],
    "request_id": "req_8f3kj2h9"
  }
}
```

### 3.4 Códigos de error

| HTTP | Código | Cuándo |
|------|--------|--------|
| 400 | `REQ_INVALID` | JSON malformado, body vacío |
| 401 | `AUTH_REQUIRED` | Token ausente |
| 401 | `TOKEN_EXPIRED` | Token expirado |
| 401 | `TOKEN_INVALID` | Token inválido o manipulado |
| 401 | `AUTH_INVALID_CREDENTIALS` | Email o password incorrectos |
| 401 | `AUTH_ACCOUNT_DISABLED` | Cuenta suspendida o de baja |
| 403 | `FORBIDDEN` | Sin permisos para este recurso |
| 404 | `NOT_FOUND` | Recurso no encontrado o sin acceso |
| 409 | `CONFLICT` | Duplicado o transición de estado inválida |
| 422 | `VAL_REQUIRED` | Campo requerido ausente |
| 422 | `VAL_FORMAT` | Formato inválido |
| 422 | `VAL_RANGE` | Valor fuera de rango |
| 422 | `BIZ_INVALID_STATE` | Operación inválida para el estado actual |
| 429 | `RATE_LIMIT` | Límite de requests superado |
| 500 | `SERVER_ERROR` | Error interno |

### 3.5 Paginación

| Param | Default | Máximo |
|-------|---------|--------|
| `page` | `1` | — |
| `page_size` | `20` | `100` |
| `sort` | `created_at:desc` | — |

---

## 4. Auth

---

### `POST /auth/login` 🔓
Autenticar usuario del back-office (admin, rrhh, médico). El colaborador se autentica igual pero para el portal.

**Request body:**
| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `email` | string | ✅ | Formato email |
| `password` | string | ✅ | Mín. 8 chars |

**Response 200:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `access_token` | string | JWT 8h |
| `refresh_token` | string | JWT 30d |
| `token_type` | string | `"bearer"` |
| `user` | `UserSummary` | Perfil del usuario |

**Errores:**
| Código | HTTP |
|--------|------|
| `AUTH_INVALID_CREDENTIALS` | 401 |
| `AUTH_ACCOUNT_DISABLED` | 401 |

**Notas:** Respuesta siempre genérica — no revelar si el email existe o el estado de la cuenta.

---

### `POST /auth/refresh` 🔓
Renovar access token.

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `refresh_token` | string | ✅ |

**Response 200:**
| Campo | Tipo |
|-------|------|
| `access_token` | string |
| `refresh_token` | string |

**Errores:** `TOKEN_INVALID` 401, `TOKEN_EXPIRED` 401

---

### `POST /auth/logout` 🔐
Invalidar refresh token activo.

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `refresh_token` | string | ✅ |

**Response:** `204 No Content`

---

### `GET /auth/me` 🔐
Perfil del usuario autenticado.

**Response 200:** `UserMe` (ver schema en sección 13)

---

### `POST /auth/activate` 🔓
Activar cuenta con invite token. Primer acceso del colaborador.

**Request body:**
| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `token` | string | ✅ | Token recibido por WhatsApp |
| `first_name` | string | ✅ | Debe coincidir con el registrado por RRHH |
| `cuil` | string | ✅ | 11 dígitos sin guiones. Debe coincidir |
| `password` | string | ✅ | Mín. 8 chars, mín. 1 número, mín. 1 mayúscula |
| `password_confirm` | string | ✅ | Debe coincidir con `password` |

**Response 200:**
| Campo | Tipo |
|-------|------|
| `access_token` | string |
| `refresh_token` | string |
| `user` | `UserSummary` |

**Errores:**
| Código | HTTP | Cuándo |
|--------|------|--------|
| `TOKEN_INVALID` | 401 | Token inválido o ya usado |
| `TOKEN_EXPIRED` | 401 | Token expirado (>48h) |
| `BIZ_IDENTITY_MISMATCH` | 422 | Nombre o CUIL no coinciden |

---

## 5. Tenants 🌐

---

### `GET /tenants` 🌐
Listar todas las empresas. Solo super_admin.

**Query params:** `estado`, `plan`, `search`, `page`, `page_size`

**Response 200:** Lista paginada de `TenantSummary`

---

### `POST /tenants` 🌐
Crear nueva empresa cliente.

**Request body:**
| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `nombre` | string | ✅ | Razón social |
| `nombre_corto` | string | ✅ | Máx. 50 chars |
| `cuit` | string | ✅ | 11 dígitos. Único global |
| `subdominio` | string | ✅ | `[a-z0-9-]`, 3–64 chars. Único global |
| `plan` | string | ✅ | `starter`, `professional`, `enterprise` |
| `admin_email` | string | ✅ | Email del primer admin de la empresa |
| `admin_first_name` | string | ✅ | — |
| `admin_last_name` | string | ✅ | — |
| `logo_url` | string | ❌ | URL pública |
| `color_primario` | string | ❌ | Hex `#RRGGBB` |

**Response 201:** `Tenant` completo

**Errores:**
| Código | HTTP | Cuándo |
|--------|------|--------|
| `CONFLICT` | 409 | CUIT o subdominio ya registrado |

---

### `GET /tenants/{id}` 🌐
**Response 200:** `Tenant` completo

---

### `PATCH /tenants/{id}` 🌐
Actualizar datos de la empresa. Campos permitidos: `nombre`, `nombre_corto`, `plan`, `logo_url`, `color_primario`, `estado`.

**Response 200:** `Tenant` completo

---

### `GET /tenants/me` 👑
Datos del tenant propio. Para admin_empresa y rrhh.

**Response 200:** `Tenant` completo

---

### `PATCH /tenants/me/branding` 👑
Actualizar branding del tenant propio.

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `logo_url` | string | ❌ |
| `color_primario` | string | ❌ |
| `nombre_corto` | string | ❌ |

**Response 200:** `Tenant` completo

---

## 6. Estructura organizacional 👑

---

### `GET /sedes` 👑
Listar sedes del tenant.

**Query params:** `is_active`, `page`, `page_size`

**Response 200:** Lista paginada de `Sede`

---

### `POST /sedes` 👑

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `nombre` | string | ✅ |
| `direccion` | string | ❌ |
| `ciudad` | string | ❌ |
| `provincia` | string | ❌ |

**Response 201:** `Sede`

---

### `PATCH /sedes/{id}` 👑
Actualizar sede. Campos: `nombre`, `direccion`, `ciudad`, `provincia`, `is_active`.

**Response 200:** `Sede`

---

### `GET /departamentos` 👑
Listar departamentos con jerarquía.

**Query params:** `padre_id` (filtrar por padre), `is_active`

**Response 200:** Lista de `Departamento` con campo `hijos: []`

---

### `POST /departamentos` 👑

**Request body:**
| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `nombre` | string | ✅ | — |
| `padre_id` | uuid | ❌ | Máx. 3 niveles de jerarquía |

**Response 201:** `Departamento`

---

### `PATCH /departamentos/{id}` 👑
Campos: `nombre`, `padre_id`, `is_active`.

---

### `GET /puestos` 👔
Listar puestos del tenant.

**Response 200:** Lista paginada de `Puesto`

---

### `POST /puestos` 👑

**Request body:**
| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `nombre` | string | ✅ | — |
| `descripcion` | string | ❌ | — |
| `meses_vigencia_aptitud` | integer | ❌ | `1`–`60`. NULL = sin vencimiento |

**Response 201:** `Puesto`

---

### `GET /convenios` 👔
**Response 200:** Lista de `Convenio`

---

### `POST /convenios` 👑

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `nombre` | string | ✅ |
| `descripcion` | string | ❌ |

**Response 201:** `Convenio`

---

## 7. Usuarios 

---

### `GET /users` 👔
Listar usuarios del tenant.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `role` | string | Filtrar por rol |
| `estado` | string | `pendiente`, `activo`, `suspendido`, `baja` |
| `sede_id` | uuid | Filtrar por sede |
| `departamento_id` | uuid | Filtrar por departamento |
| `search` | string | Por nombre, email o CUIL |
| `page`, `page_size`, `sort` | — | Paginación |

**Response 200:** Lista paginada de `UserSummary`

---

### `POST /users` 👔
Crear usuario / colaborador. Genera invite_token automáticamente y envía por WhatsApp.

**Request body:**
| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `email` | string | ✅ | Email único global |
| `first_name` | string | ✅ | Mín. 2 chars |
| `last_name` | string | ✅ | Mín. 2 chars |
| `cuil` | string | ✅ | 11 dígitos. Único por tenant |
| `role` | string | ✅ | `colaborador`, `rrhh`, `servicio_medico`. Admin no crea `admin_empresa` vía API |
| `whatsapp_numero` | string | ✅ | E.164 (ej: `+5491112345678`) |
| `sede_id` | uuid | ❌ | Solo para colaborador |
| `departamento_id` | uuid | ❌ | Solo para colaborador |
| `puesto_id` | uuid | ❌ | Solo para colaborador |
| `convenio_id` | uuid | ❌ | Solo para colaborador |
| `legajo` | string | ❌ | Único por tenant |
| `fecha_ingreso` | date | ❌ | ISO 8601 |
| `tipo_contrato` | string | ❌ | `indefinido`, `determinado`, `eventual`, `pasantia` |

**Response 201:** `User` completo

**Errores:**
| Código | HTTP | Cuándo |
|--------|------|--------|
| `CONFLICT` | 409 | Email o CUIL ya registrado en el tenant |
| `BIZ_INVALID_STATE` | 422 | Tenant sin WhatsApp configurado al crear colaborador |

---

### `POST /users/bulk` 👔
Carga masiva de colaboradores vía CSV. Procesamiento asíncrono.

**Request:** `multipart/form-data`
| Campo | Tipo | Validación |
|-------|------|------------|
| `file` | file | CSV. Máx. 5MB. Columnas requeridas: `email`, `first_name`, `last_name`, `cuil`, `whatsapp_numero` |

**Response 202:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `job_id` | string | ID del job de importación |
| `total_rows` | integer | Filas en el CSV |
| `estimated_seconds` | integer | Estimado de tiempo |

---

### `GET /users/bulk/{job_id}` 👔
Estado del job de importación masiva.

**Response 200:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `job_id` | string | — |
| `estado` | string | `procesando`, `completado`, `completado_con_errores` |
| `procesados` | integer | Filas procesadas |
| `exitosos` | integer | — |
| `errores` | array | `[{"fila": 5, "cuil": "...", "error": "CUIL duplicado"}]` |

---

### `GET /users/{id}` 👔
Colaborador puede ver su propio perfil.

**Response 200:** `User` completo incluyendo `colaborador_perfil` si aplica

---

### `PATCH /users/{id}` 👔
Actualizar datos del usuario. Colaborador solo puede editar su propio perfil (campos limitados).

**Request body (admin/rrhh):**
| Campo | Tipo |
|-------|------|
| `first_name`, `last_name` | string |
| `sede_id`, `departamento_id`, `puesto_id`, `convenio_id` | uuid |
| `legajo`, `tipo_contrato`, `fecha_ingreso` | varios |

**Request body (colaborador — solo su propio perfil):**
| Campo | Tipo | Notas |
|-------|------|-------|
| `email_personal` | string | — |
| `telefono_personal` | string | E.164 |

**Response 200:** `User` completo

---

### `POST /users/{id}/invite` 👔
Re-enviar o generar nuevo invite token. Invalida el anterior.

**Response 200:**
| Campo | Tipo |
|-------|------|
| `expires_at` | datetime | 48h desde ahora |
| `sent_via` | string | `whatsapp` |

---

### `POST /users/{id}/suspend` 👑
Suspender usuario. Invalida sesiones activas inmediatamente.

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `motivo` | string | ❌ | Máx. 500 chars |

**Response:** `204 No Content`

---

### `POST /users/{id}/reactivate` 👑
Reactivar usuario suspendido.

**Response 200:** `User` completo

---

### `POST /users/{id}/baja` 👑
Dar de baja definitiva. No elimina historial.

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `motivo` | string | ❌ |
| `fecha_baja` | date | ❌ | Default: hoy |

**Response:** `204 No Content`

---

### `POST /users/{id}/whatsapp/verify` 🔐
Iniciar verificación de nuevo número WhatsApp (colaborador en portal o RRHH).

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `whatsapp_numero` | string | ✅ | E.164 |

**Response 200:**
| Campo | Tipo |
|-------|------|
| `expires_at` | datetime | El bot envía código de verificación por WA |

---

## 8. WhatsApp Config 👑

---

### `GET /whatsapp/config` 👑
Configuración WA del tenant.

**Response 200:** `WhatsappConfig` (sin `access_token`)

---

### `PUT /whatsapp/config` 👑
Crear o actualizar configuración WA del tenant.

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `phone_number_id` | string | ✅ |
| `business_account_id` | string | ✅ |
| `access_token` | string | ✅ | Se encripta antes de persistir |
| `mensaje_bienvenida` | string | ❌ | Máx. 1000 chars |
| `horario_atencion` | object | ❌ | `{"lun": {"desde": "09:00", "hasta": "18:00"}}` |

**Response 200:** `WhatsappConfig`

---

### `POST /whatsapp/webhook` 🔓
Webhook de Meta Cloud API. Validación HMAC-SHA256 obligatoria antes de procesar.

**Headers requeridos por Meta:**
```http
X-Hub-Signature-256: sha256=<hmac_hex>
```

**Response:** `200 OK` con body `"EVENT_RECEIVED"` inmediatamente. Procesar en background.

**Nota de seguridad:** Rechazar si el timestamp del payload tiene más de 5 minutos de antigüedad.

---

### `GET /whatsapp/webhook` 🔓
Verificación del webhook por Meta (challenge).

**Query params:** `hub.mode`, `hub.verify_token`, `hub.challenge`

**Response:** Retornar `hub.challenge` si `hub.verify_token` coincide con el configurado.

---

## 9. Recibos de sueldo

---

### `GET /periodos` 👔
Listar períodos de liquidación del tenant.

**Query params:** `estado`, `page`, `page_size`

**Response 200:** Lista paginada de `PeriodoLiquidacion`

---

### `POST /periodos` 👔
Crear nuevo período.

**Request body:**
| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `periodo` | string | ✅ | Formato `YYYY-MM` |
| `descripcion` | string | ❌ | Ej: "Aguinaldo junio 2026" |
| `fecha_inicio` | date | ✅ | — |
| `fecha_fin` | date | ✅ | Mayor o igual a `fecha_inicio` |
| `fecha_limite_firma` | date | ❌ | — |

**Response 201:** `PeriodoLiquidacion`

---

### `POST /periodos/{id}/upload` 👔
Subir PDF individual o ZIP con múltiples recibos. Procesamiento asíncrono.

**Request:** `multipart/form-data`
| Campo | Tipo | Validación |
|-------|------|------------|
| `file` | file | PDF (1 recibo) o ZIP (múltiples). Máx. 50MB |
| `mapeo` | string | ❌ | JSON con mapeo CUIL→archivo si no se puede inferir del nombre |

**Response 202:**
| Campo | Tipo |
|-------|------|
| `job_id` | string | — |
| `total_archivos` | integer | — |
| `preview` | array | `[{"cuil": "...", "nombre": "...", "archivo": "recibo.pdf", "user_id": "..."}]` |

---

### `POST /periodos/{id}/upload/{job_id}/confirm` 👔
Confirmar el mapeo previo y ejecutar la distribución.

**Response 202:**
| Campo | Tipo |
|-------|------|
| `distribuidos` | integer | — |
| `errores` | array | CUILs sin usuario mapeado |

---

### `GET /periodos/{id}/recibos` 👔
Dashboard de recibos de un período con estado de firma.

**Query params:** `estado`, `sede_id`, `departamento_id`, `search`, `page`, `page_size`

**Response 200:** Lista paginada de `ReciboDashboard`

---

### `POST /periodos/{id}/renotificar` 👔
Reenviar notificación a colaboradores que no firmaron.

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `user_ids` | uuid[] | ❌ | Si vacío: todos los no firmados del período |

**Response 202:** `{ "notificados": 45 }`

---

### `GET /recibos` 👤
Recibos del colaborador autenticado. Paginados.

**Query params:** `estado`, `periodo`, `page`, `page_size`

**Response 200:** Lista paginada de `Recibo`

---

### `GET /recibos/{id}` 🔐
Obtener recibo. Colaborador solo accede al propio.

**Response 200:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | — |
| `periodo` | string | — |
| `descripcion` | string | — |
| `estado` | string | — |
| `file_url` | string | Signed URL (24h). Genera acceso y setea `visto_at` |
| `archivo_hash` | string | SHA-256 del PDF |
| `firma` | `FirmaElectronica`\|null | Si está firmado |
| `fecha_limite_firma` | date\|null | — |

---

### `POST /recibos/{id}/firmar` 🔐
Registrar firma del recibo. Colaborador solo firma el propio.

**Request body:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `canal` | string | ✅ | `portal` (desde la API REST). WhatsApp registra firma internamente vía bot |
| `conformidad` | boolean | ✅ | Debe ser `true` para proceder |

**Response 200:** `Recibo` actualizado con `estado: "firmado"` y `firma` completa

**Errores:**
| Código | HTTP | Cuándo |
|--------|------|--------|
| `BIZ_INVALID_STATE` | 422 | Recibo ya firmado o vencido |

---

### `GET /recibos/export` 👔
Exportar reporte de firmas en CSV.

**Query params:** `periodo_id` (requerido), `estado`

**Response:** `text/csv` con columnas: `legajo`, `nombre`, `cuil`, `periodo`, `estado`, `firmado_at`, `canal`

---

## 10. Comunicaciones

---

### `GET /comunicaciones` 👔
Listar comunicaciones del tenant.

**Query params:** `estado`, `page`, `page_size`

**Response 200:** Lista paginada de `ComunicacionSummary`

---

### `POST /comunicaciones` 👔
Crear comunicación (en estado borrador).

**Request body:**
| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `asunto` | string | ✅ | Máx. 200 chars |
| `cuerpo` | string | ✅ | Máx. 5000 chars |
| `tipo_segmento` | string | ✅ | `todos`, `sede`, `departamento`, `puesto`, `lista_custom` |
| `segmento_config` | object | ❌ | Requerido si no es `todos`. Ver notas |
| `requiere_confirmacion` | boolean | ❌ | Default: `false` |
| `programado_at` | datetime | ❌ | Futuro. NULL = envío inmediato al confirmar |

**`segmento_config` según `tipo_segmento`:**
```json
// sede
{ "sede_ids": ["uuid1", "uuid2"] }
// departamento
{ "departamento_ids": ["uuid1"] }
// puesto
{ "puesto_ids": ["uuid1"] }
// lista_custom
{ "user_ids": ["uuid1", "uuid2"] }
```

**Response 201:** `Comunicacion` completa

---

### `POST /comunicaciones/{id}/adjuntos` 👔
Adjuntar archivo a comunicación en estado `borrador`.

**Request:** `multipart/form-data`
| Campo | Validación |
|-------|------------|
| `file` | Máx. 10MB. `pdf`, `jpg`, `png`, `docx`, `xlsx` |

**Response 201:** `ComunicacionAdjunto`

---

### `POST /comunicaciones/{id}/enviar` 👔
Confirmar y ejecutar envío. Si tiene `programado_at`, encola para esa fecha.

**Response 202:** `{ "estado": "enviando", "total_destinatarios": 234 }`

**Errores:**
| Código | HTTP | Cuándo |
|--------|------|--------|
| `BIZ_INVALID_STATE` | 422 | No está en estado `borrador` |
| `VAL_REQUIRED` | 422 | Sin destinatarios en el segmento |

---

### `GET /comunicaciones/{id}` 👔
Detalle con métricas de entrega.

**Response 200:** `Comunicacion` con campos adicionales:
| Campo | Tipo |
|-------|------|
| `metricas` | `{ "enviados": 234, "entregados": 210, "leidos": 180, "confirmados": 120 }` |

---

### `POST /comunicaciones/{id}/reenviar` 👔
Reenviar a destinatarios sin confirmación.

**Response 202:** `{ "reenviados": 54 }`

---

### `GET /comunicaciones/colaborador` 🔐
Comunicaciones recibidas por el colaborador autenticado.

**Query params:** `estado` (`todas`, `no_leidas`, `confirmadas`), `page`, `page_size`

**Response 200:** Lista paginada de `ComunicacionColaborador`

---

### `POST /comunicaciones/{id}/confirmar` 🔐
Confirmar lectura de una comunicación (colaborador).

**Response 200:** `{ "confirmado_at": "2026-05-09T14:30:00Z" }`

**Errores:**
| Código | HTTP | Cuándo |
|--------|------|--------|
| `BIZ_INVALID_STATE` | 422 | Comunicación no requiere confirmación o ya confirmada |

---

## 11. Licencias

---

### `GET /licencias/tipos` 🔐
Tipos de licencia disponibles (globales + custom del tenant).

**Response 200:** Lista de `TipoLicencia`

---

### `POST /licencias/tipos` 👑
Crear tipo de licencia custom para el tenant.

**Request body:**
| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `codigo` | string | ✅ | Único por tenant. Máx. 10 chars `[A-Z0-9-]` |
| `nombre` | string | ✅ | — |
| `descripcion` | string | ❌ | — |
| `requiere_certificado` | boolean | ❌ | Default: `false` |
| `dias_maximos` | integer | ❌ | `1`–`365`. NULL = sin límite |

**Response 201:** `TipoLicencia`

---

### `GET /licencias/politicas` 👔
Políticas de días por tipo y convenio del tenant.

**Response 200:** Lista de `PoliticaLicencia`

---

### `POST /licencias/politicas` 👑
Crear política de licencia.

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `tipo_licencia_id` | uuid | ✅ |
| `convenio_id` | uuid | ❌ | NULL = aplica a todos |
| `dias_base` | integer | ✅ |
| `reglas_antiguedad` | array | ❌ | `[{"anios_desde": 1, "anios_hasta": 5, "dias": 14}]` |
| `requiere_aprobacion` | boolean | ❌ | Default: `true` |
| `dias_aviso_previo` | integer | ❌ | Default: `0` |

**Response 201:** `PoliticaLicencia`

---

### `GET /licencias/solicitudes` 👔
Listar solicitudes del tenant (RRHH ve todas; colaborador ve las suyas → usar `/licencias/mis-solicitudes`).

**Query params:** `estado`, `tipo_licencia_id`, `sede_id`, `departamento_id`, `user_id`, `desde`, `hasta`, `page`, `page_size`

**Response 200:** Lista paginada de `SolicitudLicencia`

---

### `POST /licencias/solicitudes` 🔐
Crear solicitud de licencia (colaborador o RRHH en nombre de colaborador).

**Request body:**
| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `tipo_licencia_id` | uuid | ✅ | — |
| `fecha_inicio` | date | ✅ | No pasada |
| `fecha_fin` | date | ✅ | Mayor o igual a `fecha_inicio` |
| `comentario` | string | ❌ | Máx. 500 chars |
| `user_id` | uuid | ❌ | Solo RRHH+ puede especificar otro usuario |

**Response 201:** `SolicitudLicencia` con `estado: "pendiente"` y `numero_solicitud`

**Errores:**
| Código | HTTP | Cuándo |
|--------|------|--------|
| `BIZ_INVALID_STATE` | 422 | Saldo insuficiente o fechas solapadas con otra solicitud |
| `VAL_RANGE` | 422 | Días solicitados superan el máximo permitido |

---

### `GET /licencias/solicitudes/{id}` 🔐
Colaborador solo accede a sus propias solicitudes.

**Response 200:** `SolicitudLicencia` completa con documentos adjuntos

---

### `POST /licencias/solicitudes/{id}/documento` 🔐
Adjuntar certificado médico o documentación de respaldo.

**Request:** `multipart/form-data`
| Campo | Validación |
|-------|------------|
| `file` | Máx. 10MB. `pdf`, `jpg`, `jpeg`, `png` |

**Response 201:** `DocumentoSolicitud`

---

### `POST /licencias/solicitudes/{id}/aprobar` 👔
Aprobar solicitud. Solo RRHH+ o el rol configurado como aprobador.

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `comentario` | string | ❌ |

**Response 200:** `SolicitudLicencia` con `estado: "aprobada"`

**Notas:** Dispara notificación WhatsApp al colaborador en <30s. Actualiza `saldo_licencias`.

---

### `POST /licencias/solicitudes/{id}/rechazar` 👔

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `comentario` | string | ✅ | Obligatorio al rechazar. Máx. 500 chars |

**Response 200:** `SolicitudLicencia` con `estado: "rechazada"`

---

### `POST /licencias/solicitudes/{id}/cancelar` 🔐
Colaborador cancela su solicitud (solo desde estado `pendiente`).

**Response 200:** `SolicitudLicencia` con `estado: "cancelada"`

**Errores:** `BIZ_INVALID_STATE` 422 si no está en estado `pendiente`

---

### `GET /licencias/mis-solicitudes` 🔐
Solicitudes del colaborador autenticado.

**Query params:** `estado`, `page`, `page_size`

**Response 200:** Lista paginada de `SolicitudLicencia`

---

### `GET /licencias/saldo` 🔐
Balance de licencias del colaborador autenticado.

**Query params:** `anio` (default: año actual)

**Response 200:** Lista de `SaldoLicencia` por tipo

---

### `GET /licencias/saldo/{user_id}` 👔
Balance de licencias de un colaborador específico. Solo RRHH+.

**Response 200:** Lista de `SaldoLicencia` por tipo

---

## 12. Servicio Médico 🏥

*Acceso exclusivo: `servicio_medico`, `admin_empresa`, `super_admin`. RRHH no tiene acceso a este módulo.*

---

### `GET /medico/fichas` 🏥
Listar colaboradores con ficha médica (o sin ella).

**Query params:** `sede_id`, `departamento_id`, `search`, `page`, `page_size`

**Response 200:** Lista paginada de `FichaMedicaSummary`

---

### `GET /medico/fichas/{user_id}` 🏥
Historia clínica laboral de un colaborador.

**Response 200:** `FichaMedica` completa

---

### `PUT /medico/fichas/{user_id}` 🏥
Crear o actualizar ficha médica.

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `grupo_sanguineo` | string | ❌ | `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` |
| `factor_rh` | string | ❌ | `positivo`, `negativo` |
| `alergias` | array | ❌ | `[{"nombre": "Penicilina", "severidad": "alta"}]` |
| `condiciones` | array | ❌ | `[{"nombre": "Hipertensión", "desde": "2020"}]` |
| `observaciones` | string | ❌ | — |

**Response 200:** `FichaMedica`

---

### `GET /medico/examenes/{user_id}` 🏥
Historial de exámenes de un colaborador.

**Response 200:** Lista de `ExamenMedico`

---

### `POST /medico/examenes/{user_id}` 🏥

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `tipo` | string | ✅ | `ingreso`, `periodico`, `post_ausencia`, `egreso` |
| `fecha` | date | ✅ | — |
| `resultado` | string | ❌ | — |
| `medico_responsable` | string | ❌ | — |
| `archivo` | file | ❌ | Adjunto del informe |

**Response 201:** `ExamenMedico`

---

### `GET /medico/aptitudes/{user_id}` 🏥
Historial de aptitudes laborales de un colaborador.

**Response 200:** Lista de `AptitudLaboral`

---

### `POST /medico/aptitudes/{user_id}` 🏥
Emitir aptitud laboral.

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `puesto_id` | uuid | ✅ | — |
| `estado` | string | ✅ | `apto`, `apto_con_restricciones`, `no_apto` |
| `restricciones` | string | ❌ | Requerido si `apto_con_restricciones` |
| `fecha_emision` | date | ✅ | — |
| `fecha_vencimiento` | date | ❌ | NULL = sin vencimiento |

**Response 201:** `AptitudLaboral`

---

### `GET /medico/accidentes` 🏥
Listar accidentes de trabajo del tenant.

**Query params:** `estado`, `user_id`, `desde`, `hasta`, `page`, `page_size`

**Response 200:** Lista paginada de `AccidenteTrabajo`

---

### `POST /medico/accidentes` 🏥
Registrar accidente de trabajo.

**Request body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| `user_id` | uuid | ✅ | Colaborador accidentado |
| `fecha_hora` | datetime | ✅ | UTC |
| `lugar` | string | ✅ | — |
| `descripcion` | string | ✅ | — |
| `testigos` | array | ❌ | `[{"nombre": "...", "legajo": "..."}]` |

**Response 201:** `AccidenteTrabajo`

---

### `PATCH /medico/accidentes/{id}` 🏥
Actualizar estado o número de ART.

**Request body:**
| Campo | Tipo |
|-------|------|
| `estado` | string | `abierto`, `tratamiento`, `alta`, `cerrado` |
| `numero_art` | string |

**Response 200:** `AccidenteTrabajo`

---

### `GET /medico/reportes/absentismo` 🏥
Reporte de absentismo por departamento y período.

**Query params:** `desde` (date), `hasta` (date), `departamento_id`

**Response 200:**
```json
{
  "data": {
    "periodo": { "desde": "2026-01-01", "hasta": "2026-04-30" },
    "por_departamento": [
      { "departamento": "Operaciones", "dias_ausentes": 45, "colaboradores": 20, "tasa_pct": 5.2 }
    ],
    "total_dias_ausentes": 120,
    "tasa_global_pct": 4.1
  }
}
```

---

### `GET /medico/reportes/aptitudes-por-vencer` 🏥
Colaboradores con aptitudes próximas a vencer.

**Query params:** `dias` (default: `30`), `sede_id`, `departamento_id`

**Response 200:** Lista de colaboradores con `fecha_vencimiento` y días restantes

---

## 13. Schemas compartidos

### `UserSummary`
| Campo | Tipo | Nullable |
|-------|------|----------|
| `id` | uuid | NO |
| `email` | string | NO |
| `first_name` | string | NO |
| `last_name` | string | NO |
| `full_name` | string | NO |
| `role` | string | NO |
| `estado` | string | NO |
| `avatar_url` | string | SÍ |

### `UserMe`
Extiende `UserSummary` con:
| Campo | Tipo | Nullable |
|-------|------|----------|
| `tenant_id` | uuid | SÍ |
| `last_login_at` | datetime | SÍ |
| `mfa_enabled` | boolean | NO |

### `User` (completo)
Extiende `UserSummary` con:
| Campo | Tipo | Nullable |
|-------|------|----------|
| `cuil` | string | SÍ |
| `whatsapp_numero_masked` | string | SÍ | Últimos 4 dígitos |
| `activated_at` | datetime | SÍ |
| `created_at` | datetime | NO |
| `updated_at` | datetime | NO |
| `perfil` | `ColaboradorPerfil`\|null | SÍ |

### `ColaboradorPerfil`
| Campo | Tipo | Nullable |
|-------|------|----------|
| `legajo` | string | SÍ |
| `sede` | `{ id, nombre }` | SÍ |
| `departamento` | `{ id, nombre }` | SÍ |
| `puesto` | `{ id, nombre }` | SÍ |
| `convenio` | `{ id, nombre }` | SÍ |
| `fecha_ingreso` | date | SÍ |
| `tipo_contrato` | string | SÍ |

### `TenantSummary`
| Campo | Tipo | Nullable |
|-------|------|----------|
| `id` | uuid | NO |
| `nombre` | string | NO |
| `nombre_corto` | string | NO |
| `subdominio` | string | NO |
| `plan` | string | NO |
| `estado` | string | NO |
| `logo_url` | string | SÍ |
| `color_primario` | string | SÍ |

### `PeriodoLiquidacion`
| Campo | Tipo | Nullable |
|-------|------|----------|
| `id` | uuid | NO |
| `periodo` | string | NO |
| `descripcion` | string | SÍ |
| `fecha_inicio` | date | NO |
| `fecha_fin` | date | NO |
| `fecha_limite_firma` | date | SÍ |
| `estado` | string | NO |
| `total_recibos` | integer | NO |
| `recibos_firmados` | integer | NO |
| `pct_firmados` | number | NO | Calculado |

### `Recibo`
| Campo | Tipo | Nullable |
|-------|------|----------|
| `id` | uuid | NO |
| `periodo` | string | NO |
| `descripcion` | string | SÍ |
| `estado` | string | NO |
| `file_url` | string | SÍ | Signed URL 24h — se genera al acceder |
| `archivo_hash` | string | NO |
| `fecha_limite_firma` | date | SÍ |
| `notificado_at` | datetime | SÍ |
| `firma` | `FirmaElectronica`\|null | SÍ |

### `FirmaElectronica`
| Campo | Tipo | Nullable |
|-------|------|----------|
| `canal` | string | NO |
| `timestamp_firma` | datetime | NO |
| `archivo_hash` | string | NO |

### `SolicitudLicencia`
| Campo | Tipo | Nullable |
|-------|------|----------|
| `id` | uuid | NO |
| `numero_solicitud` | string | NO |
| `tipo_licencia` | `{ id, codigo, nombre }` | NO |
| `fecha_inicio` | date | NO |
| `fecha_fin` | date | NO |
| `dias_habiles` | integer | NO |
| `estado` | string | NO |
| `comentario_empleado` | string | SÍ |
| `comentario_rrhh` | string | SÍ |
| `revisado_por` | `UserSummary`\|null | SÍ |
| `revisado_at` | datetime | SÍ |
| `canal` | string | NO |
| `documentos` | array | NO |
| `created_at` | datetime | NO |

### `SaldoLicencia`
| Campo | Tipo | Nullable |
|-------|------|----------|
| `tipo_licencia` | `{ id, codigo, nombre }` | NO |
| `anio` | integer | NO |
| `dias_disponibles` | integer | NO |
| `dias_tomados` | integer | NO |
| `dias_pendientes` | integer | NO |
| `dias_restantes` | integer | NO | Calculado: `disponibles - tomados - pendientes` |

### `FichaMedica`
| Campo | Tipo | Nullable | Notas |
|-------|------|----------|-------|
| `user_id` | uuid | NO | — |
| `grupo_sanguineo` | string | SÍ | — |
| `factor_rh` | string | SÍ | — |
| `alergias` | array | NO | Desencriptado para servicio_medico |
| `condiciones` | array | NO | Desencriptado para servicio_medico |
| `observaciones` | string | SÍ | — |
| `updated_at` | datetime | NO | — |

---

## 13b. Reportes + Dashboard RRHH

### Autenticación
Todos los endpoints requieren rol `rrhh`, `admin_empresa` o `super_admin`.  
Leyenda: 👔 = rrhh/admin_empresa/super_admin

---

### `GET /reportes/dashboard` 👔

KPIs del tenant para el dashboard de RRHH.

**Response 200:**
```json
{
  "headcount": 42,
  "licencias_activas_hoy": 3,
  "licencias_pendientes_aprobacion": 2,
  "vencimientos_proximos_30d": 5,
  "recibos_sin_firmar": 8,
  "comunicados_sin_confirmar": 14
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `headcount` | integer | Colaboradores con estado `activo` |
| `licencias_activas_hoy` | integer | Solicitudes aprobadas que cubren la fecha de hoy |
| `licencias_pendientes_aprobacion` | integer | Solicitudes en estado `pendiente` |
| `vencimientos_proximos_30d` | integer | Aptitudes laborales con `valida_hasta` en los próximos 30 días |
| `recibos_sin_firmar` | integer | Recibos sin firma del período más reciente activo |
| `comunicados_sin_confirmar` | integer | Destinatarios que no confirmaron comunicados activos |

---

### `GET /reportes/headcount` 👔

Distribución de headcount por sede y departamento.

**Response 200:**
```json
{
  "total": 42,
  "por_sede": [
    { "sede": "Casa Central", "count": 30 },
    { "sede": "Sucursal Norte", "count": 12 }
  ],
  "por_departamento": [
    { "departamento": "Tecnología", "count": 15 },
    { "departamento": "Administración", "count": 10 }
  ]
}
```

---

### `GET /reportes/licencias` 👔

Tendencia mensual de licencias de los últimos 6 meses.

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `meses` | integer | 6 | Cantidad de meses hacia atrás |

**Response 200:**
```json
{
  "tendencia": [
    { "mes": "2025-12", "total": 8, "aprobadas": 6, "rechazadas": 1, "pendientes": 1 },
    { "mes": "2026-01", "total": 10, "aprobadas": 8, "rechazadas": 2, "pendientes": 0 }
  ]
}
```

---

### `GET /reportes/export/licencias` 👔

Exportar solicitudes de licencias como CSV.

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `desde` | date | — | Filtro fecha inicio (inclusive) |
| `hasta` | date | — | Filtro fecha fin (inclusive) |
| `estado` | string | — | Filtro por estado: `pendiente`, `aprobada`, `rechazada`, `cancelada` |

**Response:** `text/csv`  
Columnas: `numero_solicitud`, `colaborador`, `cuil`, `tipo_licencia`, `fecha_inicio`, `fecha_fin`, `dias_habiles`, `estado`, `canal`, `creado_at`, `revisado_por`, `revisado_at`

---

### `GET /reportes/export/comunicaciones` 👔

Exportar comunicaciones con métricas de recepción como CSV.

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `desde` | date | — | Filtro por fecha de envío |
| `hasta` | date | — | Filtro por fecha de envío |

**Response:** `text/csv`  
Columnas: `titulo`, `tipo`, `estado`, `enviado_at`, `total_destinatarios`, `leidos`, `confirmados`, `tasa_lectura`, `tasa_confirmacion`

---

## 14. Seguridad — checklist de implementación

- [ ] HTTPS obligatorio en todos los endpoints
- [ ] Headers de seguridad en todas las respuestas:
  ```http
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  ```
- [ ] `request_id` único (UUID) generado por el servidor en cada request — incluir en response y logs
- [ ] `tenant_id` siempre extraído del JWT — nunca del body ni query params
- [ ] Webhook Meta: validar firma HMAC-SHA256 antes de procesar cualquier payload
- [ ] Webhook Meta: rechazar si `timestamp` del payload tiene más de 5 minutos
- [ ] MFA obligatorio antes de activar en producción para roles admin/rrhh/servicio_medico
- [ ] Signed URLs para todos los documentos — nunca exponer `storage_path`
- [ ] Datos médicos desencriptados únicamente para rol `servicio_medico` y `super_admin`
- [ ] Nunca loguear: passwords, tokens, whatsapp_id, datos médicos, CUIL en texto plano
- [ ] Stack traces nunca en responses — solo en logs internos
- [ ] Paginación con límite máximo `100` — nunca retornar todos los registros sin límite
- [ ] Rate limiting en endpoints de auth
