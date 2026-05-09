# DATA_MODEL.md — HRConnect

> **Proyecto:** HRConnect — Plataforma HR multi-empresa con canal WhatsApp
> **Versión:** 1.0 | **Fecha:** 2026-05-09
> **Motor:** PostgreSQL 15+ (Supabase)
> **Naming:** snake_case | **PKs:** UUID v4 | **Timestamps:** `timestamptz` UTC
> **Multi-tenant:** shared database / shared schema — aislamiento por `tenant_id` + RLS
> **Migraciones:** Supabase CLI — nunca modificar schema desde el dashboard en producción

---

## 1. Resumen de tablas

| Tabla | Módulo | Descripción | Volumen estimado |
|-------|--------|-------------|-----------------|
| `tenants` | Core | Empresas cliente de HRConnect | Cientos |
| `sedes` | Core | Sucursales/sedes por empresa | Miles |
| `departamentos` | Core | Estructura organizacional | Miles |
| `puestos` | Core | Cargos/roles laborales | Miles |
| `convenios` | Core | Convenios colectivos por empresa | Decenas por tenant |
| `users` | Auth | Todos los usuarios del sistema | 100K+ (colaboradores mayoritariamente) |
| `colaborador_perfil` | Users | Datos laborales del colaborador | ~= users con rol colaborador |
| `colaborador_documentos` | Users | Documentos adjuntos al legajo | Miles |
| `invite_tokens` | Auth | Tokens de invitación (uso único, 48h) | Proporcional a onboardings |
| `whatsapp_config` | WhatsApp | Configuración WhatsApp por tenant | 1 por tenant |
| `whatsapp_sessions` | WhatsApp | Estado de la FSM del bot por usuario | Alta rotación |
| `whatsapp_message_log` | WhatsApp | Log de mensajes (retención 90 días) | Muy alto |
| `whatsapp_templates` | WhatsApp | Catálogo de HSM templates por tenant | Decenas por tenant |
| `periodos_liquidacion` | Recibos | Períodos de sueldo por empresa | ~12 por tenant/año |
| `recibos` | Recibos | Recibos individuales por empleado | Alto — crece mensual |
| `firmas_electronicas` | Recibos | Firmas de recibos con prueba legal | ~= recibos firmados |
| `comunicaciones` | Comunicaciones | Mensajes institucionales | Miles por tenant |
| `comunicacion_destinatarios` | Comunicaciones | Estado de entrega por destinatario | Muy alto |
| `comunicacion_adjuntos` | Comunicaciones | Archivos adjuntos a comunicaciones | Proporcional |
| `tipos_licencia` | Licencias | Catálogo de tipos de licencia | Decenas (predefinidos + custom) |
| `politicas_licencia` | Licencias | Reglas de días por convenio/antigüedad | Decenas por tenant |
| `solicitudes_licencia` | Licencias | Solicitudes de licencia | Alto |
| `saldo_licencias` | Licencias | Balance por empleado/tipo/año | ~= colaboradores × tipos |
| `documentos_solicitud` | Licencias | Certificados adjuntos a solicitudes | Proporcional |
| `fichas_medicas` | Médico | Historia clínica laboral (1:1 con user) | ~= colaboradores |
| `examenes_medicos` | Médico | Historial de exámenes médicos | Varios por colaborador |
| `vacunaciones` | Médico | Registro de vacunas | Varios por colaborador |
| `aptitudes_laborales` | Médico | Emisiones de aptitud por puesto | Varios por colaborador |
| `accidentes_trabajo` | Médico | Registro de accidentes | Bajo — append-only |
| `documentos_medicos` | Médico | Documentos médicos (acceso restringido) | Proporcional |
| `audit_log` | Seguridad | Registro inmutable de acciones | Muy alto — append-only |

---

## 2. Diagrama de relaciones (ER)

```
[tenants] 1 ──── N [sedes]
[tenants] 1 ──── N [departamentos]
[tenants] 1 ──── N [puestos]
[tenants] 1 ──── N [convenios]
[tenants] 1 ──── N [users]
[tenants] 1 ──── 1 [whatsapp_config]
[tenants] 1 ──── N [periodos_liquidacion]
[tenants] 1 ──── N [comunicaciones]
[tenants] 1 ──── N [tipos_licencia]        (los predefinidos tienen tenant_id = NULL)

[users] 1 ────── 1 [colaborador_perfil]    (solo colaboradores)
[users] 1 ────── N [colaborador_documentos]
[users] 1 ────── 1 [fichas_medicas]        (solo colaboradores)
[users] 1 ────── N [invite_tokens]
[users] 1 ────── N [recibos]               (como destinatario)
[users] 1 ────── N [solicitudes_licencia]
[users] 1 ────── N [saldo_licencias]

[colaborador_perfil] N ── 1 [sedes]
[colaborador_perfil] N ── 1 [departamentos]
[colaborador_perfil] N ── 1 [puestos]
[colaborador_perfil] N ── 1 [convenios]

[periodos_liquidacion] 1 ── N [recibos]
[recibos] 1 ─────────────── 1 [firmas_electronicas]

[comunicaciones] 1 ── N [comunicacion_destinatarios]
[comunicaciones] 1 ── N [comunicacion_adjuntos]

[solicitudes_licencia] N ── 1 [tipos_licencia]
[solicitudes_licencia] 1 ── N [documentos_solicitud]
[solicitudes_licencia] 1 ── 1 [documentos_medicos]  (cuando tipo = ENF/médico)

[fichas_medicas] 1 ── N [examenes_medicos]
[fichas_medicas] 1 ── N [vacunaciones]
[users] 1 ─────────── N [aptitudes_laborales]
[users] 1 ─────────── N [accidentes_trabajo]
[users] 1 ─────────── N [documentos_medicos]
```

---

## 3. Tablas

---

### `tenants`

**Propósito:** Empresa cliente de HRConnect. Raíz de todo el árbol de datos.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `nombre` | `text` | NO | — | Razón social |
| `nombre_corto` | `text` | NO | — | Nombre de fantasía o abreviatura |
| `cuit` | `text` | NO | — | CUIT de la empresa (Argentina). Único global |
| `subdominio` | `text` | NO | — | Subdominio del portal (ej: `acme`). Único global. Solo `[a-z0-9-]` |
| `plan` | `text` | NO | `'starter'` | Ver enum `tenant_plan` |
| `estado` | `text` | NO | `'activo'` | Ver enum `tenant_estado` |
| `logo_url` | `text` | SÍ | `NULL` | URL del logo en storage |
| `color_primario` | `text` | SÍ | `NULL` | Color hex para branding (ej: `#1A73E8`) |
| `whatsapp_numero` | `text` | SÍ | `NULL` | Número WhatsApp Business en formato E.164 |
| `max_colaboradores` | `integer` | NO | `100` | Límite según plan |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
UNIQUE (cuit)
UNIQUE (subdominio)
CHECK (plan IN ('starter', 'professional', 'enterprise'))
CHECK (estado IN ('activo', 'suspendido', 'baja'))
CHECK (subdominio ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')
CHECK (color_primario ~ '^#[0-9A-Fa-f]{6}$' OR color_primario IS NULL)
```

---

### `sedes`

**Propósito:** Unidad geográfica o funcional dentro de una empresa.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `nombre` | `text` | NO | — | Nombre de la sede |
| `direccion` | `text` | SÍ | `NULL` | Dirección completa |
| `ciudad` | `text` | SÍ | `NULL` | Ciudad |
| `provincia` | `text` | SÍ | `NULL` | Provincia |
| `is_active` | `boolean` | NO | `true` | — |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
UNIQUE (tenant_id, nombre)
```

---

### `departamentos`

**Propósito:** Área funcional. Soporta hasta 3 niveles de jerarquía.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `nombre` | `text` | NO | — | Nombre del departamento |
| `padre_id` | `uuid` | SÍ | `NULL` | FK → `departamentos.id`. Jerarquía (máx. 3 niveles) |
| `is_active` | `boolean` | NO | `true` | — |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (padre_id) REFERENCES departamentos(id) ON DELETE RESTRICT
UNIQUE (tenant_id, nombre, padre_id)
```

---

### `puestos`

**Propósito:** Cargo u ocupación. Define qué aptitud laboral requiere el empleado.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `nombre` | `text` | NO | — | Nombre del puesto |
| `descripcion` | `text` | SÍ | `NULL` | Descripción de responsabilidades |
| `meses_vigencia_aptitud` | `integer` | SÍ | `NULL` | Meses de validez del examen de aptitud. NULL = sin vencimiento |
| `is_active` | `boolean` | NO | `true` | — |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
UNIQUE (tenant_id, nombre)
```

---

### `convenios`

**Propósito:** Convenio colectivo de trabajo. Define reglas de licencias por antigüedad.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `nombre` | `text` | NO | — | Nombre del convenio |
| `descripcion` | `text` | SÍ | `NULL` | Descripción o número de resolución |
| `is_active` | `boolean` | NO | `true` | — |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
UNIQUE (tenant_id, nombre)
```

---

### `users`

**Propósito:** Todas las personas con acceso al sistema: Super Admin, Admin Empresa, RRHH, Servicio Médico y Colaboradores.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | SÍ | `NULL` | FK → `tenants.id`. NULL solo para super_admin |
| `email` | `text` | NO | — | Email de acceso al portal. Único global |
| `password_hash` | `text` | SÍ | `NULL` | Bcrypt hash. NULL hasta completar activación |
| `first_name` | `text` | NO | — | Nombre |
| `last_name` | `text` | NO | — | Apellido |
| `cuil` | `text` | SÍ | `NULL` | CUIL sin guiones (20304050607). Único por tenant |
| `role` | `text` | NO | — | Ver enum `user_role` |
| `estado` | `text` | NO | `'pendiente'` | Ver enum `user_estado` |
| `whatsapp_id_encrypted` | `text` | SÍ | `NULL` | wa_id encriptado AES-256. **Nunca exponer en API** |
| `whatsapp_numero_masked` | `text` | SÍ | `NULL` | Últimos 4 dígitos del número WA para mostrar en UI |
| `mfa_enabled` | `boolean` | NO | `false` | MFA activo (obligatorio para admin/rrhh) |
| `mfa_secret_encrypted` | `text` | SÍ | `NULL` | Secret TOTP encriptado |
| `avatar_url` | `text` | SÍ | `NULL` | URL pública |
| `last_login_at` | `timestamptz` | SÍ | `NULL` | Último login exitoso |
| `activated_at` | `timestamptz` | SÍ | `NULL` | Cuándo completó la activación |
| `suspended_at` | `timestamptz` | SÍ | `NULL` | Cuándo fue suspendido |
| `baja_at` | `timestamptz` | SÍ | `NULL` | Cuándo se dio de baja (no elimina historial) |
| `created_by` | `uuid` | SÍ | `NULL` | FK → `users.id`. Quién lo creó |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
UNIQUE (email)
UNIQUE (tenant_id, cuil) WHERE cuil IS NOT NULL
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
CHECK (role IN ('super_admin', 'admin_empresa', 'rrhh', 'servicio_medico', 'colaborador'))
CHECK (estado IN ('pendiente', 'activo', 'suspendido', 'baja'))
-- super_admin no tiene tenant_id
CHECK (role = 'super_admin' AND tenant_id IS NULL OR role != 'super_admin' AND tenant_id IS NOT NULL)
```

**Índices:**
```sql
CREATE UNIQUE INDEX users_email_idx ON users(email);
CREATE UNIQUE INDEX users_cuil_tenant_idx ON users(tenant_id, cuil) WHERE cuil IS NOT NULL;
CREATE INDEX users_tenant_role_estado_idx ON users(tenant_id, role, estado);
CREATE INDEX users_tenant_estado_idx ON users(tenant_id, estado) WHERE estado = 'activo';
```

**Notas:**
- `password_hash`, `whatsapp_id_encrypted`, `mfa_secret_encrypted` **nunca** aparecen en responses de API.
- La baja no elimina el registro — solo setea `estado = 'baja'` y `baja_at`.
- MFA obligatorio para `admin_empresa`, `rrhh`, `servicio_medico` (validar en app al login).

---

### `colaborador_perfil`

**Propósito:** Datos laborales del colaborador. 1:1 con `users` donde `role = 'colaborador'`.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `user_id` | `uuid` | NO | — | PK + FK → `users.id` |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id`. Desnormalizado para RLS |
| `legajo` | `text` | SÍ | `NULL` | Número de legajo interno. Único por tenant |
| `sede_id` | `uuid` | SÍ | `NULL` | FK → `sedes.id` |
| `departamento_id` | `uuid` | SÍ | `NULL` | FK → `departamentos.id` |
| `puesto_id` | `uuid` | SÍ | `NULL` | FK → `puestos.id` |
| `convenio_id` | `uuid` | SÍ | `NULL` | FK → `convenios.id` |
| `fecha_ingreso` | `date` | SÍ | `NULL` | Fecha de ingreso a la empresa |
| `tipo_contrato` | `text` | SÍ | `NULL` | Ver enum `tipo_contrato` |
| `fecha_nacimiento` | `date` | SÍ | `NULL` | — |
| `genero` | `text` | SÍ | `NULL` | Ver enum `genero` |
| `nacionalidad` | `text` | SÍ | `'AR'` | Código ISO 3166-1 alpha-2 |
| `email_personal` | `text` | SÍ | `NULL` | Email personal (distinto del de acceso) |
| `telefono_personal` | `text` | SÍ | `NULL` | Teléfono personal en E.164 |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
PRIMARY KEY (user_id)
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (sede_id) REFERENCES sedes(id) ON DELETE SET NULL
FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE SET NULL
FOREIGN KEY (puesto_id) REFERENCES puestos(id) ON DELETE SET NULL
FOREIGN KEY (convenio_id) REFERENCES convenios(id) ON DELETE SET NULL
UNIQUE (tenant_id, legajo) WHERE legajo IS NOT NULL
CHECK (tipo_contrato IN ('indefinido', 'determinado', 'eventual', 'pasantia'))
CHECK (genero IN ('masculino', 'femenino', 'no_binario', 'no_especificado'))
```

---

### `colaborador_documentos`

**Propósito:** Documentos adjuntos al legajo del colaborador (no médicos).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `user_id` | `uuid` | NO | — | FK → `users.id` |
| `tipo` | `text` | NO | — | `cv`, `titulo`, `certificado`, `contrato`, `otro` |
| `filename` | `text` | NO | — | Nombre original del archivo |
| `storage_path` | `text` | NO | — | Ruta interna en storage. **Nunca exponer** |
| `file_url` | `text` | NO | — | Signed URL (24h de validez) |
| `file_size_bytes` | `integer` | NO | — | Tamaño en bytes |
| `mime_type` | `text` | NO | — | Tipo MIME validado en servidor |
| `descripcion` | `text` | SÍ | `NULL` | Descripción opcional |
| `uploaded_by` | `uuid` | NO | — | FK → `users.id` |
| `created_at` | `timestamptz` | NO | `now()` | — |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
CHECK (tipo IN ('cv', 'titulo', 'certificado', 'contrato', 'otro'))
```

---

### `invite_tokens`

**Propósito:** Token de activación de cuenta (uso único, válido 48h). Enviado por WhatsApp o email.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NO | — | FK → `users.id` |
| `token_hash` | `text` | NO | — | SHA-256 del token. El token plano se envía al usuario y no se almacena |
| `expires_at` | `timestamptz` | NO | — | 48h desde creación |
| `used_at` | `timestamptz` | SÍ | `NULL` | NULL = no usado. Setear al activar |
| `invalidated_at` | `timestamptz` | SÍ | `NULL` | Invalidado manualmente por RRHH (re-envío) |
| `created_by` | `uuid` | NO | — | FK → `users.id`. RRHH que generó el token |
| `created_at` | `timestamptz` | NO | `now()` | — |

**Constraints:**
```sql
UNIQUE (token_hash)
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
```

**Notas:**
- Solo un token activo por usuario. Al generar uno nuevo, invalidar el anterior.
- El token plano se genera con `secrets.token_urlsafe(32)` y se envía al usuario. Solo se almacena el hash.

---

### `whatsapp_config`

**Propósito:** Configuración de la cuenta WhatsApp Business por tenant. 1:1 con `tenants`.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id`. Único |
| `phone_number_id` | `text` | NO | — | ID del número en Meta Cloud API |
| `business_account_id` | `text` | NO | — | Meta Business Account ID |
| `access_token_encrypted` | `text` | NO | — | Token de acceso permanente. AES-256 |
| `verify_token` | `text` | NO | — | Token para verificar webhook de Meta |
| `mensaje_bienvenida` | `text` | SÍ | `NULL` | Mensaje de bienvenida al activar cuenta |
| `horario_atencion` | `jsonb` | SÍ | `NULL` | `{"lun": {"desde": "09:00", "hasta": "18:00"}, ...}` |
| `is_active` | `boolean` | NO | `false` | Activado tras verificación Meta |
| `verificado_at` | `timestamptz` | SÍ | `NULL` | Cuándo se verificó con Meta |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
UNIQUE (tenant_id)
UNIQUE (phone_number_id)
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
```

---

### `whatsapp_sessions`

**Propósito:** Estado de la máquina de estados del bot por usuario. TTL de 10 minutos de inactividad (gestionado en Redis; se persiste en DB para auditoría y recuperación).

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `user_id` | `uuid` | NO | — | FK → `users.id` |
| `estado_bot` | `text` | NO | `'idle'` | Ver enum `bot_estado` |
| `contexto` | `jsonb` | SÍ | `'{}'` | Datos del flujo en curso (ej: tipo_licencia seleccionado) |
| `ultimo_mensaje_at` | `timestamptz` | NO | `now()` | Timestamp del último mensaje |
| `expira_at` | `timestamptz` | NO | — | 10 minutos desde `ultimo_mensaje_at` |
| `mensajes_count` | `integer` | NO | `0` | Contador de mensajes en el flujo actual (máx. 8) |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
UNIQUE (tenant_id, user_id)
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
```

---

### `whatsapp_message_log`

**Propósito:** Log de todos los mensajes enviados/recibidos. Retención de 90 días.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `bigserial` | NO | auto | PK secuencial |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `user_id` | `uuid` | SÍ | `NULL` | FK → `users.id`. NULL si el wa_id no está mapeado aún |
| `wa_message_id` | `text` | SÍ | `NULL` | ID del mensaje en Meta. Único |
| `direction` | `text` | NO | — | `inbound`, `outbound` |
| `tipo` | `text` | NO | — | `text`, `template`, `interactive`, `document`, `image` |
| `contenido` | `text` | SÍ | `NULL` | Texto del mensaje |
| `template_name` | `text` | SÍ | `NULL` | Nombre del HSM si aplica |
| `metadata` | `jsonb` | SÍ | `NULL` | Payload completo de Meta para debugging |
| `created_at` | `timestamptz` | NO | `now()` | — |

**Constraints:**
```sql
UNIQUE (wa_message_id) WHERE wa_message_id IS NOT NULL
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
```

**Notas:**
- Retención de 90 días — implementar job de limpieza periódico o partición por `created_at`.
- `bigserial` por volumen alto de inserts secuenciales.

---

### `whatsapp_templates`

**Propósito:** Catálogo de HSM Templates aprobadas por Meta, personalizables por tenant.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | SÍ | `NULL` | NULL = template global de HRConnect |
| `nombre` | `text` | NO | — | Nombre del template en Meta |
| `categoria` | `text` | NO | — | `UTILITY`, `MARKETING`, `AUTHENTICATION` |
| `idioma` | `text` | NO | `'es_AR'` | Código de idioma Meta |
| `body_template` | `text` | NO | — | Texto con variables `{{1}}`, `{{2}}` |
| `variables` | `jsonb` | NO | `'[]'` | Descripción de variables: `[{"pos": 1, "desc": "nombre"}]` |
| `aprobado` | `boolean` | NO | `false` | Aprobado por Meta |
| `is_active` | `boolean` | NO | `true` | — |
| `created_at` | `timestamptz` | NO | `now()` | — |

---

### `periodos_liquidacion`

**Propósito:** Período de pago al que pertenece un lote de recibos.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `periodo` | `text` | NO | — | Formato `YYYY-MM` (ej: `2026-04`) |
| `descripcion` | `text` | SÍ | `NULL` | Ej: "Sueldo Abril 2026", "Aguinaldo 2026" |
| `fecha_inicio` | `date` | NO | — | Inicio del período liquidado |
| `fecha_fin` | `date` | NO | — | Fin del período liquidado |
| `fecha_limite_firma` | `date` | SÍ | `NULL` | Fecha límite para firma. Configurable |
| `estado` | `text` | NO | `'borrador'` | `borrador`, `distribuido`, `cerrado` |
| `total_recibos` | `integer` | NO | `0` | Desnormalizado — count de recibos asociados |
| `recibos_firmados` | `integer` | NO | `0` | Desnormalizado — actualizado por trigger |
| `created_by` | `uuid` | NO | — | FK → `users.id` |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
UNIQUE (tenant_id, periodo, descripcion)
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
CHECK (estado IN ('borrador', 'distribuido', 'cerrado'))
CHECK (fecha_fin >= fecha_inicio)
```

---

### `recibos`

**Propósito:** Recibo de sueldo individual asignado a un colaborador.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `periodo_id` | `uuid` | NO | — | FK → `periodos_liquidacion.id` |
| `user_id` | `uuid` | NO | — | FK → `users.id`. Colaborador destinatario |
| `storage_path` | `text` | NO | — | Ruta interna del PDF. **Nunca exponer** |
| `archivo_hash` | `text` | NO | — | SHA-256 del archivo PDF. Prueba de integridad |
| `archivo_size_bytes` | `integer` | NO | — | Tamaño en bytes |
| `estado` | `text` | NO | `'pendiente'` | Ver enum `recibo_estado` |
| `notificado_at` | `timestamptz` | SÍ | `NULL` | Cuándo se notificó al empleado |
| `visto_at` | `timestamptz` | SÍ | `NULL` | Cuándo el empleado accedió al PDF |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
UNIQUE (tenant_id, periodo_id, user_id)
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (periodo_id) REFERENCES periodos_liquidacion(id) ON DELETE RESTRICT
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
CHECK (estado IN ('pendiente', 'entregado', 'firmado', 'vencido'))
```

---

### `firmas_electronicas`

**Propósito:** Registro de la firma de un recibo. Prueba legal (probatoria, no Ley 25.506). 1:1 con `recibos` firmados.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `recibo_id` | `uuid` | NO | — | FK → `recibos.id`. Único |
| `user_id` | `uuid` | NO | — | FK → `users.id`. Firmante |
| `canal` | `text` | NO | — | `whatsapp`, `portal` |
| `timestamp_firma` | `timestamptz` | NO | — | Momento exacto de la firma (UTC) |
| `ip_address` | `inet` | SÍ | `NULL` | IP del firmante. NULL si canal = whatsapp |
| `session_id` | `text` | SÍ | `NULL` | ID de sesión JWT al momento de firma (portal) |
| `wa_session_hash` | `text` | SÍ | `NULL` | Hash de la sesión WA al momento de firma |
| `archivo_hash` | `text` | NO | — | SHA-256 del PDF firmado — copia de `recibos.archivo_hash` |
| `created_at` | `timestamptz` | NO | `now()` | — |

**Constraints:**
```sql
UNIQUE (recibo_id)
FOREIGN KEY (recibo_id) REFERENCES recibos(id) ON DELETE RESTRICT
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
CHECK (canal IN ('whatsapp', 'portal'))
```

---

### `comunicaciones`

**Propósito:** Mensaje institucional enviado a un segmento de colaboradores.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `asunto` | `text` | NO | — | Asunto del mensaje. Máx. 200 chars |
| `cuerpo` | `text` | NO | — | Cuerpo del mensaje (rich text). Máx. 5000 chars |
| `tipo_segmento` | `text` | NO | — | `todos`, `sede`, `departamento`, `puesto`, `lista_custom` |
| `segmento_config` | `jsonb` | NO | `'{}'` | `{"sede_ids": [...]}`, `{"user_ids": [...]}`, etc. |
| `requiere_confirmacion` | `boolean` | NO | `false` | Si el colaborador debe responder LEÍDO |
| `programado_at` | `timestamptz` | SÍ | `NULL` | NULL = envío inmediato |
| `enviado_at` | `timestamptz` | SÍ | `NULL` | Cuándo se inició el envío real |
| `estado` | `text` | NO | `'borrador'` | `borrador`, `programado`, `enviando`, `enviado`, `cancelado` |
| `total_destinatarios` | `integer` | NO | `0` | Desnormalizado al distribuir |
| `created_by` | `uuid` | NO | — | FK → `users.id` |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
CHECK (tipo_segmento IN ('todos', 'sede', 'departamento', 'puesto', 'lista_custom'))
CHECK (estado IN ('borrador', 'programado', 'enviando', 'enviado', 'cancelado'))
```

---

### `comunicacion_destinatarios`

**Propósito:** Estado de entrega de una comunicación para cada destinatario.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `comunicacion_id` | `uuid` | NO | — | FK → `comunicaciones.id` |
| `user_id` | `uuid` | NO | — | FK → `users.id` |
| `estado` | `text` | NO | `'pendiente'` | `pendiente`, `enviado`, `entregado`, `leido`, `confirmado`, `sin_respuesta` |
| `enviado_at` | `timestamptz` | SÍ | `NULL` | — |
| `entregado_at` | `timestamptz` | SÍ | `NULL` | Confirmación de entrega de WhatsApp |
| `leido_at` | `timestamptz` | SÍ | `NULL` | Read receipt de WhatsApp o apertura en portal |
| `confirmado_at` | `timestamptz` | SÍ | `NULL` | Cuando el usuario respondió LEÍDO |
| `created_at` | `timestamptz` | NO | `now()` | — |

**Constraints:**
```sql
UNIQUE (comunicacion_id, user_id)
FOREIGN KEY (comunicacion_id) REFERENCES comunicaciones(id) ON DELETE CASCADE
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
CHECK (estado IN ('pendiente', 'enviado', 'entregado', 'leido', 'confirmado', 'sin_respuesta'))
```

---

### `comunicacion_adjuntos`

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `comunicacion_id` | `uuid` | NO | — | FK → `comunicaciones.id` |
| `filename` | `text` | NO | — | Nombre original del archivo |
| `storage_path` | `text` | NO | — | Ruta interna. **Nunca exponer** |
| `file_url` | `text` | NO | — | URL pública o signed URL |
| `file_size_bytes` | `integer` | NO | — | — |
| `mime_type` | `text` | NO | — | — |
| `created_at` | `timestamptz` | NO | `now()` | — |

**Constraints:**
```sql
FOREIGN KEY (comunicacion_id) REFERENCES comunicaciones(id) ON DELETE CASCADE
```

---

### `tipos_licencia`

**Propósito:** Catálogo de tipos de licencia. Los predefinidos (`tenant_id IS NULL`) son globales; los custom son por empresa.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | SÍ | `NULL` | NULL = predefinido global. FK → `tenants.id` |
| `codigo` | `text` | NO | — | `VAC`, `ENF`, `MAT`, `PAT`, `MAT-C`, `DUE`, `EST`, `ART`, `SGS`, `CUST` |
| `nombre` | `text` | NO | — | Nombre descriptivo |
| `descripcion` | `text` | SÍ | `NULL` | Descripción detallada |
| `requiere_certificado` | `boolean` | NO | `false` | Si la licencia requiere documento adjunto |
| `es_medica` | `boolean` | NO | `false` | True para ENF/ART — activa flujo de servicio médico |
| `dias_maximos` | `integer` | SÍ | `NULL` | Máximo de días por solicitud. NULL = sin límite |
| `is_active` | `boolean` | NO | `true` | — |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
UNIQUE (tenant_id, codigo)
```

---

### `politicas_licencia`

**Propósito:** Reglas de días disponibles por tipo de licencia, convenio y antigüedad.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `tipo_licencia_id` | `uuid` | NO | — | FK → `tipos_licencia.id` |
| `convenio_id` | `uuid` | SÍ | `NULL` | FK → `convenios.id`. NULL = aplica a todos |
| `dias_base` | `integer` | NO | — | Días base (sin considerar antigüedad) |
| `reglas_antiguedad` | `jsonb` | SÍ | `NULL` | `[{"anios_desde": 1, "anios_hasta": 5, "dias": 14}, ...]` |
| `requiere_aprobacion` | `boolean` | NO | `true` | Si requiere aprobación de RRHH |
| `dias_aviso_previo` | `integer` | NO | `0` | Días de anticipación mínimos para solicitar |
| `aprobador_rol` | `text` | NO | `'rrhh'` | `rrhh`, `admin_empresa` |
| `is_active` | `boolean` | NO | `true` | — |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (tipo_licencia_id) REFERENCES tipos_licencia(id) ON DELETE RESTRICT
FOREIGN KEY (convenio_id) REFERENCES convenios(id) ON DELETE RESTRICT
UNIQUE (tenant_id, tipo_licencia_id, convenio_id)
```

---

### `solicitudes_licencia`

**Propósito:** Solicitud de licencia presentada por un colaborador.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `numero_solicitud` | `text` | NO | — | Número legible (ej: `LIC-2026-00123`). Único por tenant |
| `user_id` | `uuid` | NO | — | FK → `users.id`. Solicitante |
| `tipo_licencia_id` | `uuid` | NO | — | FK → `tipos_licencia.id` |
| `fecha_inicio` | `date` | NO | — | — |
| `fecha_fin` | `date` | NO | — | — |
| `dias_habiles` | `integer` | NO | — | Calculado al crear |
| `estado` | `text` | NO | `'pendiente'` | Ver enum `solicitud_estado` |
| `comentario_empleado` | `text` | SÍ | `NULL` | Máx. 500 chars |
| `comentario_rrhh` | `text` | SÍ | `NULL` | Motivo de aprobación/rechazo |
| `revisado_por` | `uuid` | SÍ | `NULL` | FK → `users.id`. RRHH que revisó |
| `revisado_at` | `timestamptz` | SÍ | `NULL` | — |
| `canal` | `text` | NO | — | `whatsapp`, `portal` |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
UNIQUE (tenant_id, numero_solicitud)
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
FOREIGN KEY (tipo_licencia_id) REFERENCES tipos_licencia(id) ON DELETE RESTRICT
FOREIGN KEY (revisado_por) REFERENCES users(id) ON DELETE SET NULL
CHECK (estado IN ('borrador', 'pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada', 'vencida'))
CHECK (canal IN ('whatsapp', 'portal'))
CHECK (fecha_fin >= fecha_inicio)
```

---

### `saldo_licencias`

**Propósito:** Balance de días de licencia por colaborador, tipo y año. Actualizado al aprobar solicitudes.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `user_id` | `uuid` | NO | — | FK → `users.id` |
| `tipo_licencia_id` | `uuid` | NO | — | FK → `tipos_licencia.id` |
| `anio` | `integer` | NO | — | Año del saldo |
| `dias_disponibles` | `integer` | NO | `0` | Calculado según política y antigüedad |
| `dias_tomados` | `integer` | NO | `0` | Solicitudes aprobadas y completadas |
| `dias_pendientes` | `integer` | NO | `0` | Solicitudes pendientes de aprobación |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
UNIQUE (tenant_id, user_id, tipo_licencia_id, anio)
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
FOREIGN KEY (tipo_licencia_id) REFERENCES tipos_licencia(id) ON DELETE RESTRICT
```

---

### `documentos_solicitud`

**Propósito:** Certificados adjuntos a solicitudes de licencia.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `solicitud_id` | `uuid` | NO | — | FK → `solicitudes_licencia.id` |
| `filename` | `text` | NO | — | — |
| `storage_path` | `text` | NO | — | **Nunca exponer** |
| `file_url` | `text` | NO | — | Signed URL (6h para documentos médicos, 24h para otros) |
| `file_size_bytes` | `integer` | NO | — | — |
| `mime_type` | `text` | NO | — | — |
| `uploaded_by` | `uuid` | NO | — | FK → `users.id` |
| `created_at` | `timestamptz` | NO | `now()` | — |

**Constraints:**
```sql
FOREIGN KEY (solicitud_id) REFERENCES solicitudes_licencia(id) ON DELETE CASCADE
FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
```

---

### `fichas_medicas`

**Propósito:** Historia clínica laboral del colaborador. 1:1 con `users`. Datos sensibles encriptados AES-256 a nivel de campo.

**Acceso exclusivo:** `servicio_medico` y `super_admin`. RRHH **no** tiene acceso a esta tabla.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `user_id` | `uuid` | NO | — | FK → `users.id`. Único |
| `grupo_sanguineo` | `text` | SÍ | `NULL` | `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` |
| `factor_rh` | `text` | SÍ | `NULL` | `positivo`, `negativo` |
| `alergias_encrypted` | `text` | SÍ | `NULL` | JSON encriptado AES-256. Lista de alergias |
| `condiciones_encrypted` | `text` | SÍ | `NULL` | JSON encriptado AES-256. Condiciones preexistentes |
| `observaciones` | `text` | SÍ | `NULL` | Notas del médico responsable |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
UNIQUE (user_id)
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
```

---

### `examenes_medicos`

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `user_id` | `uuid` | NO | — | FK → `users.id` |
| `tipo` | `text` | NO | — | `ingreso`, `periodico`, `post_ausencia`, `egreso` |
| `fecha` | `date` | NO | — | — |
| `resultado` | `text` | SÍ | `NULL` | Texto libre. Encriptado AES-256 |
| `medico_responsable` | `text` | SÍ | `NULL` | Nombre del médico |
| `storage_path` | `text` | SÍ | `NULL` | Ruta del informe adjunto |
| `created_by` | `uuid` | NO | — | FK → `users.id`. Médico del sistema |
| `created_at` | `timestamptz` | NO | `now()` | — |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
CHECK (tipo IN ('ingreso', 'periodico', 'post_ausencia', 'egreso'))
```

---

### `vacunaciones`

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `user_id` | `uuid` | NO | — | FK → `users.id` |
| `vacuna` | `text` | NO | — | Nombre de la vacuna |
| `fecha` | `date` | NO | — | — |
| `lote` | `text` | SÍ | `NULL` | Número de lote |
| `proxima_dosis` | `date` | SÍ | `NULL` | — |
| `created_by` | `uuid` | NO | — | FK → `users.id` |
| `created_at` | `timestamptz` | NO | `now()` | — |

---

### `aptitudes_laborales`

**Propósito:** Emisión de aptitud laboral por puesto. Tiene vencimiento configurable en `puestos.meses_vigencia_aptitud`.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `user_id` | `uuid` | NO | — | FK → `users.id` |
| `puesto_id` | `uuid` | NO | — | FK → `puestos.id` |
| `estado` | `text` | NO | — | `apto`, `apto_con_restricciones`, `no_apto` |
| `restricciones` | `text` | SÍ | `NULL` | Solo para `apto_con_restricciones` |
| `fecha_emision` | `date` | NO | — | — |
| `fecha_vencimiento` | `date` | SÍ | `NULL` | NULL = sin vencimiento |
| `emitido_por` | `uuid` | NO | — | FK → `users.id`. Médico del sistema |
| `created_at` | `timestamptz` | NO | `now()` | — |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
FOREIGN KEY (puesto_id) REFERENCES puestos(id) ON DELETE RESTRICT
FOREIGN KEY (emitido_por) REFERENCES users(id) ON DELETE RESTRICT
CHECK (estado IN ('apto', 'apto_con_restricciones', 'no_apto'))
```

---

### `accidentes_trabajo`

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `user_id` | `uuid` | NO | — | FK → `users.id`. Accidentado |
| `fecha_hora` | `timestamptz` | NO | — | Momento del accidente (UTC) |
| `lugar` | `text` | NO | — | Descripción del lugar |
| `descripcion` | `text` | NO | — | Descripción del accidente |
| `testigos` | `jsonb` | SÍ | `NULL` | `[{"nombre": "...", "legajo": "..."}]` |
| `numero_art` | `text` | SÍ | `NULL` | Número de siniestro ART |
| `estado` | `text` | NO | `'abierto'` | `abierto`, `tratamiento`, `alta`, `cerrado` |
| `created_by` | `uuid` | NO | — | FK → `users.id` |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
CHECK (estado IN ('abierto', 'tratamiento', 'alta', 'cerrado'))
```

---

### `documentos_medicos`

**Propósito:** Documentos del módulo médico (certificados de baja, informes). Acceso restringido.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `user_id` | `uuid` | NO | — | FK → `users.id` |
| `tipo` | `text` | NO | — | `certificado_baja`, `informe_medico`, `resultado_examen`, `otro` |
| `solicitud_id` | `uuid` | SÍ | `NULL` | FK → `solicitudes_licencia.id`. Vincula con la licencia |
| `filename` | `text` | NO | — | — |
| `storage_path` | `text` | NO | — | **Nunca exponer** |
| `file_url` | `text` | NO | — | Signed URL (6h de validez) |
| `file_size_bytes` | `integer` | NO | — | — |
| `mime_type` | `text` | NO | — | — |
| `uploaded_by` | `uuid` | NO | — | FK → `users.id` |
| `created_at` | `timestamptz` | NO | `now()` | — |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
FOREIGN KEY (solicitud_id) REFERENCES solicitudes_licencia(id) ON DELETE SET NULL
FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
CHECK (tipo IN ('certificado_baja', 'informe_medico', 'resultado_examen', 'otro'))
```

---

### `audit_log`

**Propósito:** Registro inmutable de acciones críticas. Append-only — nunca UPDATE ni DELETE.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `bigserial` | NO | auto | PK secuencial |
| `tenant_id` | `uuid` | SÍ | `NULL` | NULL para acciones de super_admin |
| `entity_type` | `text` | NO | — | Tabla afectada |
| `entity_id` | `uuid` | NO | — | ID del registro afectado |
| `action` | `text` | NO | — | `created`, `updated`, `deleted`, `activated`, `suspended`, `signed`, `approved`, `rejected` |
| `changed_fields` | `jsonb` | SÍ | `NULL` | `{"campo": {"from": X, "to": Y}}`. Sin datos sensibles |
| `performed_by` | `uuid` | SÍ | `NULL` | NULL si es acción automática del sistema |
| `performed_at` | `timestamptz` | NO | `now()` | — |
| `ip_address` | `inet` | SÍ | `NULL` | — |
| `request_id` | `text` | SÍ | `NULL` | ID del request HTTP |

---

## 4. Enumeraciones

### `user_role`
| Valor | Nivel | Alcance |
|-------|-------|---------|
| `super_admin` | 0 | Toda la plataforma — sin tenant_id |
| `admin_empresa` | 1 | Autoridad máxima dentro de su tenant |
| `rrhh` | 2 | Recibos, licencias, comunicaciones, usuarios |
| `servicio_medico` | 2 | Fichas médicas, aptitudes, accidentes |
| `colaborador` | 3 | Acceso propio: recibos, licencias, comunicaciones |

### `user_estado`
| Valor | Descripción | Transiciones válidas |
|-------|-------------|---------------------|
| `pendiente` | Creado, sin activar | → `activo` |
| `activo` | Cuenta operativa | → `suspendido`, → `baja` |
| `suspendido` | Acceso bloqueado temporalmente | → `activo` |
| `baja` | Alta definitiva — sin acceso, historial preservado | (estado terminal) |

### `recibo_estado`
| Valor | Descripción |
|-------|-------------|
| `pendiente` | Generado, no notificado |
| `entregado` | Notificación enviada y PDF accedido |
| `firmado` | Conformidad registrada con hash+timestamp |
| `vencido` | Fecha límite de firma superada sin firmar |

### `solicitud_estado`
```
pendiente → en_revision → aprobada
                       → rechazada
pendiente → cancelada   (por el colaborador)
pendiente → vencida     (auto si no adjunta certificado en tiempo)
borrador  → pendiente   (al confirmar en portal)
```

### `bot_estado` (FSM WhatsApp)
| Valor | Descripción |
|-------|-------------|
| `idle` | Sin flujo activo |
| `menu_principal` | Mostrando menú principal |
| `recibos_ver` | Seleccionando recibo para ver |
| `recibos_historial` | Consultando historial |
| `recibos_confirmar` | Esperando CONFIRMO |
| `licencias_tipo` | Seleccionando tipo de licencia |
| `licencias_fechas` | Ingresando fechas |
| `licencias_certificado` | Esperando certificado adjunto |
| `licencias_confirmar` | Confirmando resumen |
| `licencias_saldo` | Consultando saldo |
| `comunicaciones_ver` | Viendo comunicación |
| `comunicaciones_confirmar` | Esperando confirmación de lectura |
| `ayuda` | Flujo de ayuda |

### `tenant_plan`
| Valor | Descripción |
|-------|-------------|
| `starter` | Hasta 50 colaboradores |
| `professional` | Hasta 500 colaboradores |
| `enterprise` | Sin límite |

---

## 5. Índices

```sql
-- tenants
CREATE UNIQUE INDEX tenants_cuit_idx ON tenants(cuit);
CREATE UNIQUE INDEX tenants_subdominio_idx ON tenants(subdominio);

-- users
CREATE UNIQUE INDEX users_email_idx ON users(email);
CREATE UNIQUE INDEX users_cuil_tenant_idx ON users(tenant_id, cuil) WHERE cuil IS NOT NULL;
CREATE INDEX users_tenant_role_estado_idx ON users(tenant_id, role, estado);

-- colaborador_perfil
CREATE INDEX col_perfil_sede_idx ON colaborador_perfil(sede_id);
CREATE INDEX col_perfil_dept_idx ON colaborador_perfil(departamento_id);
CREATE INDEX col_perfil_puesto_idx ON colaborador_perfil(puesto_id);

-- recibos
CREATE INDEX recibos_tenant_periodo_idx ON recibos(tenant_id, periodo_id);
CREATE INDEX recibos_user_estado_idx ON recibos(user_id, estado);
CREATE UNIQUE INDEX recibos_periodo_user_idx ON recibos(periodo_id, user_id);

-- solicitudes_licencia
CREATE INDEX solicitudes_tenant_estado_idx ON solicitudes_licencia(tenant_id, estado);
CREATE INDEX solicitudes_user_idx ON solicitudes_licencia(user_id);
CREATE INDEX solicitudes_revisado_por_idx ON solicitudes_licencia(revisado_por) WHERE revisado_por IS NOT NULL;

-- comunicacion_destinatarios
CREATE INDEX com_dest_comunicacion_estado_idx ON comunicacion_destinatarios(comunicacion_id, estado);
CREATE INDEX com_dest_user_idx ON comunicacion_destinatarios(user_id);

-- aptitudes_laborales
CREATE INDEX aptitudes_user_vencimiento_idx ON aptitudes_laborales(user_id, fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;
CREATE INDEX aptitudes_tenant_vencimiento_idx ON aptitudes_laborales(tenant_id, fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;

-- whatsapp_message_log
CREATE INDEX wa_log_tenant_created_idx ON whatsapp_message_log(tenant_id, created_at DESC);
CREATE INDEX wa_log_user_idx ON whatsapp_message_log(user_id) WHERE user_id IS NOT NULL;

-- audit_log
CREATE INDEX audit_entity_idx ON audit_log(entity_type, entity_id);
CREATE INDEX audit_tenant_idx ON audit_log(tenant_id, performed_at DESC);
CREATE INDEX audit_performed_by_idx ON audit_log(performed_by);
```

---

## 6. Triggers

### `update_updated_at`
Aplicado a todas las tablas con `updated_at`:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
Aplicar a: `tenants`, `sedes`, `departamentos`, `puestos`, `convenios`, `users`, `colaborador_perfil`, `whatsapp_config`, `whatsapp_sessions`, `periodos_liquidacion`, `recibos`, `comunicaciones`, `tipos_licencia`, `politicas_licencia`, `solicitudes_licencia`, `fichas_medicas`, `accidentes_trabajo`.

### `sync_recibos_firmados`
Actualiza `periodos_liquidacion.recibos_firmados` al firmar un recibo:
```sql
CREATE OR REPLACE FUNCTION sync_recibos_firmados()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE periodos_liquidacion
  SET recibos_firmados = (
    SELECT COUNT(*) FROM recibos
    WHERE periodo_id = (SELECT periodo_id FROM recibos WHERE id = NEW.recibo_id)
      AND estado = 'firmado'
  )
  WHERE id = (SELECT periodo_id FROM recibos WHERE id = NEW.recibo_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_firmados
  AFTER INSERT ON firmas_electronicas
  FOR EACH ROW EXECUTE FUNCTION sync_recibos_firmados();
```

### `generate_numero_solicitud`
Genera número legible de solicitud al insertar:
```sql
CREATE OR REPLACE FUNCTION generate_numero_solicitud()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero_solicitud = 'LIC-' || TO_CHAR(now(), 'YYYY') || '-' ||
    LPAD(nextval('solicitudes_seq_' || replace(NEW.tenant_id::text, '-', ''))::text, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 7. Row Level Security

```sql
-- Habilitar en todas las tablas con datos de tenant
ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE puestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE convenios ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaborador_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_licencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichas_medicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE aptitudes_laborales ENABLE ROW LEVEL SECURITY;
ALTER TABLE accidentes_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Política base: aislamiento por tenant_id
-- El backend usa SUPABASE_SERVICE_ROLE_KEY que bypasea RLS
-- Estas políticas aplican para accesos directos y como segunda capa de seguridad

CREATE POLICY tenant_isolation ON users
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid
                 OR role = 'super_admin');

-- Datos médicos: acceso exclusivo de servicio_medico
CREATE POLICY medical_access ON fichas_medicas
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('servicio_medico', 'super_admin')
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Recibos: colaborador solo ve los suyos
CREATE POLICY recibos_colaborador ON recibos
  FOR SELECT USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('rrhh', 'admin_empresa', 'super_admin')
  );

-- Solicitudes: colaborador solo ve las suyas
CREATE POLICY solicitudes_colaborador ON solicitudes_licencia
  FOR SELECT USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('rrhh', 'admin_empresa', 'super_admin')
  );
```

**Nota:** El backend usa `SUPABASE_SERVICE_ROLE_KEY` que bypasea RLS. Las validaciones de acceso se implementan en la capa de servicios (`app/services/`). RLS es segunda línea de defensa.

---

## 8. Datos sensibles

| Tabla | Columna | Clasificación | Tratamiento |
|-------|---------|---------------|-------------|
| `users` | `password_hash` | 🔴 CRÍTICO | Nunca en API/logs. Solo bcrypt write |
| `users` | `whatsapp_id_encrypted` | 🔴 CRÍTICO | AES-256. Nunca en API |
| `users` | `mfa_secret_encrypted` | 🔴 CRÍTICO | AES-256. Nunca en API |
| `whatsapp_config` | `access_token_encrypted` | 🔴 CRÍTICO | AES-256. Nunca en API |
| `fichas_medicas` | `alergias_encrypted` | 🔴 CRÍTICO | AES-256. Solo `servicio_medico` |
| `fichas_medicas` | `condiciones_encrypted` | 🔴 CRÍTICO | AES-256. Solo `servicio_medico` |
| `invite_tokens` | `token_hash` | 🔴 CRÍTICO | Solo el hash en DB. Token plano → usuario |
| `users` | `cuil` | 🟠 ALTO | PII. No loguear. Único por tenant |
| `colaborador_perfil` | `fecha_nacimiento` | 🟠 ALTO | PII. Política de retención |
| `firmas_electronicas` | `ip_address` | 🟡 MEDIO | PII. Retención 12 meses |
| `recibos` | `storage_path` | 🟡 MEDIO | Nunca exponer. Solo `file_url` (signed) |
| `examenes_medicos` | `resultado` | 🔴 CRÍTICO | AES-256. Solo `servicio_medico` |

---

## 9. Decisiones de diseño

| Decisión | Alternativa descartada | Razón |
|----------|------------------------|-------|
| Shared database + shared schema | Schema por tenant / DB por tenant | Simplicidad operativa para v1.0. Facilita queries cross-tenant para super_admin. Escalable con particionado por tenant_id |
| `TEXT + CHECK` para enums | `ENUM` nativo PostgreSQL | `ALTER TYPE` en PG requiere lock. `TEXT + CHECK` permite migrar sin downtime |
| `colaborador_perfil` separado de `users` | Todo en `users` | Separación de concerns: `users` es auth pura; el perfil laboral puede cambiar independientemente |
| `whatsapp_id_encrypted` en `users` | Tabla separada | 1:1 garantizado. Evita JOIN innecesario. La columna solo la deserializa el backend |
| Hash del token en `invite_tokens` | Token plano en DB | Si la DB se compromete, los tokens no son usables. Patrón estándar para tokens de activación |
| `bigserial` en `audit_log` y `whatsapp_message_log` | UUID | Tablas append-only de alto volumen. `bigserial` tiene menor overhead de índice y mejor performance secuencial |
| `fichas_medicas` encriptadas a nivel campo | Encriptación de disco | Garantiza que ni el DBA puede leer datos médicos sin la clave de aplicación. Exigido por Ley 25.326 |
| `numero_solicitud` legible | Solo UUID | Los colaboradores necesitan referenciar solicitudes por número en conversaciones de WhatsApp/teléfono |
| Soft delete solo en `users` (`estado = baja`) | Eliminar físicamente | Auditoría, historial de recibos y firmas deben mantenerse indefinidamente por obligación legal |
