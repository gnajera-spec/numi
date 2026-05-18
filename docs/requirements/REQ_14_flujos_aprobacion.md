# REQ_14 — Módulo de Parametrización de Flujos de Aprobación de Licencias

**Estado:** 🔄 En curso  
**Módulo:** flujos_aprobacion  
**Prioridad:** Alta  
**Referencia AF:** Extensión de Sección 4.5 (REQ_08 — Licencias)  
**Actores:** Administrador de Empresa (único configurador), RR.HH., Servicio Médico, Colaboradores (aprobadores o receptores de notificaciones)  
**Ruta del módulo:** `http://localhost:5580/admin/configuracion/aprobaciones`  
**Acceso al configurador:** exclusivo `admin_empresa`

---

## 1. Descripción

Este módulo permite al Administrador de Empresa configurar flujos de aprobación secuenciales y parametrizables para cada tipo de licencia. Reemplaza el campo único `aprobador_rol` de `politicas_licencia` por una cadena de pasos ordenados, donde cada paso puede estar a cargo de un **rol del sistema** (`rrhh`, `servicio_medico`, `admin_empresa`) o de **colaboradores de un departamento específico** (ej: un jefe de área).

**Motivación:** En v1.0, cada tipo de licencia tiene un único aprobador hardcoded en `politicas_licencia.aprobador_rol`. La operatoria real requiere múltiples niveles —por ejemplo, una licencia médica que pasa por Servicio Médico primero y luego por RRHH para el registro administrativo— y también flujos donde el jefe directo (colaborador de un área) es parte de la cadena de aprobación.

---

## 2. Alcance del módulo

### Incluido en esta versión

- Parametrización de flujos por tipo de licencia por empresa (multi-tenant)
- Flujos secuenciales: un paso se habilita solo cuando el anterior fue aprobado
- Hasta 5 pasos por flujo
- Dos tipos de aprobador por paso:
  - **Por rol del sistema:** `rrhh`, `servicio_medico`, `admin_empresa`
  - **Por departamento:** cualquier colaborador activo del departamento configurado puede aprobar
- `admin_empresa` tiene visibilidad y puede actuar sobre cualquier paso, independientemente del tipo
- SLA configurable por paso (horas hábiles)
- Trazabilidad completa por paso: quién aprobó/rechazó, cuándo, con qué comentario
- Notificación al aprobador del paso siguiente al avanzar
- Notificación al colaborador solo en dos momentos: acuse de recibo y resultado final
- Rechazo definitivo sin posibilidad de reenvío
- Compatibilidad hacia atrás con `politicas_licencia.aprobador_rol` cuando no hay flujo configurado

### Fuera de alcance (versiones futuras)

- Flujos paralelos (múltiples aprobadores simultáneos)
- Delegación entre usuarios individuales específicos (no por departamento)
- Re-envío de solicitudes rechazadas
- Escalamiento automático al vencer el SLA (solo alerta)
- Lógica condicional en los pasos (ej: "si >10 días → paso extra")
- Colaborador específico como aprobador (hoy es por departamento completo)

---

## 3. Requerimientos funcionales

### 3.1 — Configuración de flujos (solo `admin_empresa`)

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-14-01 | El módulo de configuración de flujos es accesible únicamente por `admin_empresa` desde `/admin/configuracion/aprobaciones` | ⏳ |
| RF-14-02 | El Admin puede crear un flujo de aprobación para cualquier tipo de licencia activo en su empresa | ⏳ |
| RF-14-03 | El flujo define una secuencia ordenada de pasos (mínimo 1, máximo 5) | ⏳ |
| RF-14-04 | Cada paso tiene: nombre descriptivo, tipo de aprobador, SLA en horas (opcional) y si requiere comentario obligatorio al aprobar | ⏳ |
| RF-14-05 | El tipo de aprobador de cada paso puede ser: **rol del sistema** (`rrhh`, `servicio_medico`, `admin_empresa`) o **departamento** (selecciona uno de los departamentos activos de la empresa) | ⏳ |
| RF-14-06 | Cuando el tipo es "departamento", cualquier colaborador activo de ese departamento puede actuar sobre ese paso — el Admin también puede actuar sobre cualquier paso | ⏳ |
| RF-14-07 | Un colaborador no puede aprobar su propia solicitud, aunque pertenezca al departamento configurado como aprobador | ⏳ |
| RF-14-08 | Solo puede existir un flujo activo por tipo de licencia por empresa | ⏳ |
| RF-14-09 | El Admin puede desactivar un flujo — las solicitudes en curso completan el flujo original, las nuevas usan el fallback o el nuevo flujo que se configure | ⏳ |
| RF-14-10 | El Admin puede editar un flujo solo si no hay solicitudes en estado `pendiente` o `en_revision` que lo usen — en ese caso debe crear uno nuevo y desactivar el anterior | ⏳ |
| RF-14-11 | La vista principal del módulo muestra todos los tipos de licencia activos con su flujo configurado (o "Sin flujo — usa aprobador por defecto") | ⏳ |
| RF-14-12 | `rrhh` puede ver los flujos configurados en modo lectura (sin poder editarlos) | ⏳ |

### 3.2 — Ejecución del flujo al crear una solicitud

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-14-13 | Al crear una solicitud, el sistema busca el flujo activo del tipo de licencia para esa empresa | ⏳ |
| RF-14-14 | Si existe flujo, la solicitud registra el `flujo_id`, crea los registros de seguimiento (`aprobaciones_solicitud`) para cada paso en estado `pendiente`, y setea `paso_actual = 1` | ⏳ |
| RF-14-15 | Si no existe flujo, el sistema usa `politicas_licencia.aprobador_rol` como paso único (compatibilidad v1.0) | ⏳ |
| RF-14-16 | Al crear la solicitud, se notifica solo al aprobador del Paso 1. Si el paso es por departamento, se notifica a todos los colaboradores activos de ese departamento | ⏳ |

### 3.3 — Ejecución del flujo al aprobar/rechazar

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-14-17 | Antes de procesar cualquier decisión, el sistema valida que el usuario autenticado tiene autorización sobre el paso actual (rol correcto o pertenece al departamento configurado) | ⏳ |
| RF-14-18 | `admin_empresa` puede actuar sobre cualquier paso independientemente del tipo de aprobador configurado | ⏳ |
| RF-14-19 | Al aprobar un paso intermedio: avanza `paso_actual`, notifica al aprobador del siguiente paso, actualiza el estado de la solicitud a `en_revision` | ⏳ |
| RF-14-20 | Al aprobar el último paso: la solicitud pasa a `aprobada`, se descuenta el saldo, se notifica al colaborador | ⏳ |
| RF-14-21 | Al rechazar cualquier paso: la solicitud pasa a `rechazada` (terminal), se notifica al colaborador con el motivo. El comentario es obligatorio en el rechazo | ⏳ |
| RF-14-22 | El sistema registra en `aprobaciones_solicitud`: usuario específico que decidió, timestamp y comentario | ⏳ |

### 3.4 — Visibilidad y dashboards

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-14-23 | `admin_empresa` ve todas las solicitudes en cualquier paso, incluyendo las de tipo departamento | ⏳ |
| RF-14-24 | `rrhh` ve en su dashboard solo las solicitudes donde el paso actual tiene `tipo_aprobador = 'rol'` y `rol_aprobador = 'rrhh'` | ⏳ |
| RF-14-25 | `servicio_medico` ve en su dashboard solo las solicitudes donde el paso actual tiene `tipo_aprobador = 'rol'` y `rol_aprobador = 'servicio_medico'` | ⏳ |
| RF-14-26 | Un colaborador ve en su portal las solicitudes pendientes donde el paso actual tiene `tipo_aprobador = 'departamento'` y el `departamento_id` es el departamento al que pertenece — excepto sus propias solicitudes | ⏳ |
| RF-14-27 | En el detalle de la solicitud, se muestra el historial completo del flujo (pasos, aprobadores, estados, timestamps) — visible para Admin, RRHH y Servicio Médico | ⏳ |
| RF-14-28 | El colaborador solicitante recibe notificación solo del resultado final (aprobado/rechazado), no de los pasos intermedios | ⏳ |
| RF-14-29 | Si un paso tiene SLA configurado y vence sin decisión, el sistema envía alerta al aprobador y al Admin | ⏳ |

---

## 4. Reglas de negocio

| ID | Regla |
|----|-------|
| RN-01 | Solo `admin_empresa` puede crear, editar y desactivar flujos |
| RN-02 | `rrhh` tiene acceso de lectura al configurador (puede ver flujos, no editarlos) |
| RN-03 | Un flujo desactivado no puede recibir nuevas solicitudes, pero las activas continúan hasta resolución |
| RN-04 | El rechazo es siempre terminal — el colaborador debe crear una nueva solicitud si desea reintentar |
| RN-05 | Un aprobador no puede actuar sobre el mismo paso dos veces |
| RN-06 | Un colaborador no puede aprobar su propia solicitud, aunque sea del departamento aprobador |
| RN-07 | Cuando el tipo de aprobador es `departamento`, el primero del departamento en aprobar "gana" — los demás ya no pueden actuar sobre ese paso |
| RN-08 | La cancelación por el colaborador es posible mientras la solicitud esté en paso 1 sin decisión. En pasos avanzados (`en_revision`), solo el Admin puede cancelar |
| RN-09 | Si se desactiva un departamento que es aprobador en un flujo activo, el sistema alerta al Admin y suspende el flujo hasta que se reconfigure |
| RN-10 | La modificación de un flujo no afecta solicitudes en curso — quedan congeladas con el snapshot al momento de su creación |
| RN-11 | Los pasos deben tener `orden` contiguo sin gaps (1, 2, 3...) — el backend valida antes de guardar |
| RN-12 | Un paso no puede tener `tipo_aprobador = 'departamento'` sin `departamento_id`, ni `tipo_aprobador = 'rol'` sin `rol_aprobador` |

---

## 5. Modelo de datos

### 5.1 — Nuevas tablas

---

#### `flujos_aprobacion`

**Propósito:** Define la plantilla de flujo de aprobación para un tipo de licencia en una empresa. Solo puede haber uno activo por empresa/tipo.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id` |
| `tipo_licencia_id` | `uuid` | NO | — | FK → `tipos_licencia.id` |
| `nombre` | `text` | NO | — | Ej: "Flujo ENF — Médico + RRHH". Máx. 100 chars |
| `descripcion` | `text` | SÍ | `NULL` | Descripción opcional |
| `is_active` | `boolean` | NO | `true` | Solo un flujo activo por (tenant, tipo_licencia) |
| `created_by` | `uuid` | NO | — | FK → `users.id`. Admin que lo configuró |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Constraints:**
```sql
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (tipo_licencia_id) REFERENCES tipos_licencia(id) ON DELETE RESTRICT
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
-- Solo un flujo activo por empresa + tipo de licencia
CREATE UNIQUE INDEX flujos_aprobacion_activo_unique
  ON flujos_aprobacion(tenant_id, tipo_licencia_id)
  WHERE is_active = true;
```

---

#### `pasos_flujo`

**Propósito:** Define cada paso dentro de un flujo. Soporta dos tipos de aprobador: por rol del sistema o por departamento. El orden es explícito y sin gaps.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `flujo_id` | `uuid` | NO | — | FK → `flujos_aprobacion.id` |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id`. Desnorm. para RLS |
| `orden` | `integer` | NO | — | Posición en la secuencia (1–5). Sin gaps |
| `nombre` | `text` | NO | — | Ej: "Aprobación Jefe de Área". Máx. 100 chars |
| `tipo_aprobador` | `text` | NO | — | `rol` \| `departamento` |
| `rol_aprobador` | `text` | SÍ | `NULL` | `rrhh` \| `servicio_medico` \| `admin_empresa`. Solo cuando `tipo_aprobador = 'rol'` |
| `departamento_id` | `uuid` | SÍ | `NULL` | FK → `departamentos.id`. Solo cuando `tipo_aprobador = 'departamento'` |
| `sla_horas` | `integer` | SÍ | `NULL` | Horas hábiles para responder. NULL = sin SLA |
| `requiere_comentario` | `boolean` | NO | `false` | Comentario obligatorio al **aprobar** (el rechazo siempre lo requiere) |
| `created_at` | `timestamptz` | NO | `now()` | — |

**Constraints:**
```sql
FOREIGN KEY (flujo_id) REFERENCES flujos_aprobacion(id) ON DELETE CASCADE
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE RESTRICT
UNIQUE (flujo_id, orden)
CHECK (orden >= 1 AND orden <= 5)
CHECK (tipo_aprobador IN ('rol', 'departamento'))
CHECK (rol_aprobador IN ('rrhh', 'servicio_medico', 'admin_empresa') OR rol_aprobador IS NULL)
CHECK (sla_horas IS NULL OR sla_horas > 0)
-- Exclusividad por tipo: exactamente uno de los dos campos debe estar seteado
CHECK (
  (tipo_aprobador = 'rol' AND rol_aprobador IS NOT NULL AND departamento_id IS NULL)
  OR
  (tipo_aprobador = 'departamento' AND departamento_id IS NOT NULL AND rol_aprobador IS NULL)
)
```

**Índices:**
```sql
CREATE INDEX pasos_flujo_flujo_idx ON pasos_flujo(flujo_id, orden);
CREATE INDEX pasos_flujo_departamento_idx ON pasos_flujo(departamento_id) WHERE departamento_id IS NOT NULL;
```

---

#### `aprobaciones_solicitud`

**Propósito:** Trazabilidad de cada decisión de aprobación. Un registro por paso del flujo, creado al momento de la solicitud como snapshot inmutable del flujo.

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `solicitud_id` | `uuid` | NO | — | FK → `solicitudes_licencia.id` |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id`. Desnorm. para RLS |
| `paso_id` | `uuid` | NO | — | FK → `pasos_flujo.id` |
| `orden` | `integer` | NO | — | Snapshot de `pasos_flujo.orden` |
| `nombre_paso` | `text` | NO | — | Snapshot de `pasos_flujo.nombre` |
| `tipo_aprobador` | `text` | NO | — | Snapshot: `rol` \| `departamento` |
| `rol_aprobador` | `text` | SÍ | `NULL` | Snapshot de `pasos_flujo.rol_aprobador` |
| `departamento_id` | `uuid` | SÍ | `NULL` | Snapshot del departamento aprobador (si aplica) |
| `departamento_nombre` | `text` | SÍ | `NULL` | Snapshot del nombre del departamento (evita JOIN para historial) |
| `estado` | `text` | NO | `'pendiente'` | `pendiente` \| `aprobado` \| `rechazado` \| `omitido` |
| `aprobado_por` | `uuid` | SÍ | `NULL` | FK → `users.id`. Usuario específico que tomó la decisión |
| `comentario` | `text` | SÍ | `NULL` | Obligatorio si `requiere_comentario = true` o estado = `rechazado` |
| `notificado_at` | `timestamptz` | SÍ | `NULL` | Cuándo se notificó al aprobador del paso |
| `fecha_decision` | `timestamptz` | SÍ | `NULL` | Cuándo se resolvió |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

**Estado `omitido`:** cuando la solicitud se cancela o rechaza en un paso anterior — los pasos siguientes quedan como `omitido` (sin decisión real).

**Constraints:**
```sql
FOREIGN KEY (solicitud_id) REFERENCES solicitudes_licencia(id) ON DELETE CASCADE
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
FOREIGN KEY (paso_id) REFERENCES pasos_flujo(id) ON DELETE RESTRICT
FOREIGN KEY (aprobado_por) REFERENCES users(id) ON DELETE SET NULL
UNIQUE (solicitud_id, orden)
CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'omitido'))
CHECK (tipo_aprobador IN ('rol', 'departamento'))
```

**Índices:**
```sql
CREATE INDEX aprobaciones_solicitud_solicitud_idx
  ON aprobaciones_solicitud(solicitud_id, orden);

-- Para el dashboard: "¿qué pasos de tipo ROL tiene pendientes este rol?"
CREATE INDEX aprobaciones_por_rol_pendiente_idx
  ON aprobaciones_solicitud(tenant_id, rol_aprobador, estado)
  WHERE estado = 'pendiente' AND tipo_aprobador = 'rol';

-- Para el dashboard: "¿qué pasos de tipo DEPARTAMENTO están pendientes en mi departamento?"
CREATE INDEX aprobaciones_por_departamento_pendiente_idx
  ON aprobaciones_solicitud(tenant_id, departamento_id, estado)
  WHERE estado = 'pendiente' AND tipo_aprobador = 'departamento';
```

---

### 5.2 — Modificaciones a tablas existentes

#### `solicitudes_licencia` — campos nuevos

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `flujo_id` | `uuid` | SÍ | FK → `flujos_aprobacion.id`. NULL = fallback v1.0 |
| `paso_actual` | `integer` | SÍ | Paso activo en este momento (1-based). NULL si no usa flujo |

```sql
ALTER TABLE solicitudes_licencia
  ADD COLUMN flujo_id uuid REFERENCES flujos_aprobacion(id) ON DELETE RESTRICT,
  ADD COLUMN paso_actual integer;

CREATE INDEX solicitudes_flujo_paso_idx
  ON solicitudes_licencia(flujo_id, paso_actual)
  WHERE flujo_id IS NOT NULL;
```

**Nota:** `revisado_por` y `comentario_rrhh` se mantienen para compatibilidad v1.0 y se populan al completar el último paso del flujo (el último `aprobado_por` queda también en `revisado_por`).

#### `politicas_licencia` — cambio semántico (sin modificación de schema)

`aprobador_rol` es el fallback cuando no existe `flujo_aprobacion` activo para ese tipo de licencia. La lógica de negocio siempre prioriza el flujo sobre la política.

---

### 5.3 — Diagrama de relaciones (extensión del ER)

```
[tipos_licencia] 1 ──── N [flujos_aprobacion]   (uno activo por tenant)
[flujos_aprobacion] 1 ── N [pasos_flujo]
                               │
                    ┌──────────┴────────────┐
              (tipo = 'rol')         (tipo = 'departamento')
              rol_aprobador            departamento_id
                    │                       │
               [users.role]          [departamentos]
                                            │
                                     [colaborador_perfil]

[flujos_aprobacion] 1 ── N [solicitudes_licencia]   (via flujo_id)
[solicitudes_licencia] 1 ─ N [aprobaciones_solicitud]
[pasos_flujo] 1 ──────── N [aprobaciones_solicitud]  (via paso_id)
[users] 1 ────────────── N [aprobaciones_solicitud]  (via aprobado_por)
[departamentos] ◄──────── [aprobaciones_solicitud]   (via departamento_id — snapshot)
```

---

## 6. Máquina de estados — solicitudes con flujo

```
BORRADOR ──────────────────────────────────────────► PENDIENTE
                                                          │
                                         (Paso 1 notificado)
                                                          │
                              paso 1 aprueba ────────────┘
                                    │
                                    ▼
                              EN_REVISION  ◄──── paso N aprueba (N < último)
                                    │
               paso N rechaza       │          paso último aprueba
                   ┌────────────────┤──────────────────────────┐
                   ▼                │                          ▼
              RECHAZADA          (loop)                    APROBADA
              (terminal)

PENDIENTE ──► CANCELADA    (colaborador cancela — paso 1 sin decisión)
EN_REVISION ──► CANCELADA  (solo admin_empresa puede cancelar en pasos avanzados)
```

---

## 7. Lógica de autorización por paso

Al recibir un `POST /aprobar-paso` o `POST /rechazar-paso`, el backend ejecuta esta validación:

```
usuario = token JWT
paso_actual = solicitud.paso_actual
tipo = pasos_flujo[paso_actual].tipo_aprobador

SI tipo = 'rol':
    autorizado = (usuario.role == pasos_flujo[paso_actual].rol_aprobador)
                 OR (usuario.role == 'admin_empresa')

SI tipo = 'departamento':
    autorizado = (usuario.role == 'colaborador'
                  AND colaborador_perfil[usuario].departamento_id == pasos_flujo[paso_actual].departamento_id
                  AND usuario.id != solicitud.user_id)   ← no puede aprobar su propia solicitud
                 OR (usuario.role == 'admin_empresa')

SI NOT autorizado → 403 Forbidden
SI solicitud.paso_actual != paso que se intenta resolver → 409 Conflict
SI aprobaciones_solicitud[paso_actual].estado != 'pendiente' → 409 Conflict
```

---

## 8. Endpoints requeridos

### Configuración de flujos (solo `admin_empresa`)

| Método | Path | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/admin/flujos-aprobacion` | Listar todos los tipos de licencia con su flujo (o sin flujo) |
| `GET` | `/api/v1/admin/flujos-aprobacion/{flujo_id}` | Detalle de un flujo con sus pasos |
| `POST` | `/api/v1/admin/flujos-aprobacion` | Crear flujo + pasos (transacción atómica) |
| `PUT` | `/api/v1/admin/flujos-aprobacion/{flujo_id}` | Editar flujo (solo si sin solicitudes activas) |
| `PATCH` | `/api/v1/admin/flujos-aprobacion/{flujo_id}/deactivate` | Desactivar flujo |
| `GET` | `/api/v1/admin/flujos-aprobacion/departamentos` | Listar departamentos activos para el selector del configurador |

### Ejecución del flujo (aprobadores según rol/departamento)

| Método | Path | Descripción | Quién |
|--------|------|-------------|-------|
| `GET` | `/api/v1/solicitudes-licencia/pendientes-mi-aprobacion` | Solicitudes en el paso actual que le corresponden al usuario autenticado | admin, rrhh, servicio_medico, colaborador-departamento |
| `POST` | `/api/v1/solicitudes-licencia/{id}/aprobar-paso` | Aprobar el paso actual | según autorización |
| `POST` | `/api/v1/solicitudes-licencia/{id}/rechazar-paso` | Rechazar (comentario obligatorio) | según autorización |
| `GET` | `/api/v1/solicitudes-licencia/{id}/historial-aprobacion` | Historial completo de pasos y decisiones | admin, rrhh, servicio_medico |

### Request bodies

**POST `/admin/flujos-aprobacion`**
```json
{
  "tipo_licencia_id": "uuid",
  "nombre": "Flujo ENF — Jefe de Área + Médico + RRHH",
  "descripcion": "Licencias médicas con triple validación",
  "pasos": [
    {
      "orden": 1,
      "nombre": "Aprobación Jefe de Área",
      "tipo_aprobador": "departamento",
      "departamento_id": "uuid-departamento-gerencia",
      "sla_horas": 16,
      "requiere_comentario": false
    },
    {
      "orden": 2,
      "nombre": "Validación Servicio Médico",
      "tipo_aprobador": "rol",
      "rol_aprobador": "servicio_medico",
      "sla_horas": 24,
      "requiere_comentario": false
    },
    {
      "orden": 3,
      "nombre": "Registro Administrativo RRHH",
      "tipo_aprobador": "rol",
      "rol_aprobador": "rrhh",
      "sla_horas": 8,
      "requiere_comentario": false
    }
  ]
}
```

**POST `/solicitudes-licencia/{id}/aprobar-paso`**
```json
{
  "comentario": "Certificado verificado. Licencia válida."
}
```

**POST `/solicitudes-licencia/{id}/rechazar-paso`**
```json
{
  "comentario": "El certificado no está firmado por un médico matriculado."
}
```

---

## 9. Frontend — Routing y estructura de páginas

### Ruta del módulo

```
http://localhost:5580/admin/configuracion/aprobaciones
```

### Árbol de rutas React

```
/admin/configuracion/aprobaciones              → AprobacionesListPage
/admin/configuracion/aprobaciones/nuevo        → FlujoDiseñadorPage (nuevo)
/admin/configuracion/aprobaciones/:flujoId     → FlujoDiseñadorPage (editar)
```

### Guard de ruta

El módulo completo debe estar protegido por un guard de rol:
```tsx
// Solo admin_empresa puede acceder
<ProtectedRoute roles={['admin_empresa']}>
  <AprobacionesRoutes />
</ProtectedRoute>
```

`rrhh` puede ver los flujos desde la vista de configuración de licencias (lectura), pero NO accede a `/admin/configuracion/aprobaciones`.

---

## 10. UX — Pantallas

### 10.1 Vista principal: `AprobacionesListPage`

```
┌─────────────────────────────────────────────────────────────────────┐
│ Configuración → Flujos de Aprobación                                │
│                                                                     │
│ Define cómo se aprueban las solicitudes de licencia en tu empresa.  │
├───────────────────┬────────────────────────────┬────────────────────┤
│ Tipo de licencia  │ Flujo configurado           │ Pasos  │  Estado  │
├───────────────────┼────────────────────────────┼────────────────────┤
│ Vacaciones (VAC)  │ Aprobación RRHH simple     │ 1      │ ✅ Activo│
│ Enfermedad (ENF)  │ Jefe + Médico + RRHH       │ 3      │ ✅ Activo│
│ Maternidad (MAT)  │ —                           │ —      │ Default  │
│ Accidente (ART)   │ Médico + Gerencia           │ 2      │ ✅ Activo│
│ Sin Goce (SGS)    │ —                           │ —      │ Default  │
├───────────────────┴────────────────────────────┴────────────────────┤
│ "Default" = usa el aprobador configurado en políticas de licencia   │
└─────────────────────────────────────────────────────────────────────┘
```

Acciones por fila: `[Configurar flujo]` si no tiene flujo, `[Editar]` / `[Desactivar]` si lo tiene.

---

### 10.2 Vista de diseño de flujo: `FlujoDiseñadorPage`

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Flujos de Aprobación                                               │
│                                                                      │
│ Tipo de licencia: Enfermedad Inculpable (ENF)                        │
│ Nombre del flujo: [Jefe de Área + Médico + RRHH          ]          │
│                                                                      │
│  ┌─── PASO 1 ──────────────────────────────────────── [✕ Eliminar] ─┐│
│  │ Nombre: [Aprobación Jefe de Área                 ]              ││
│  │                                                                  ││
│  │ Aprobador:  ● Por departamento  ○ Por rol del sistema            ││
│  │             Departamento: [Gerencia General ▼]                   ││
│  │                                                                  ││
│  │ SLA: [16] hs hábiles   ☐ Comentario obligatorio al aprobar       ││
│  └──────────────────────────────────────────────────────────────────┘│
│                          ↓                                           │
│  ┌─── PASO 2 ──────────────────────────────────────── [✕ Eliminar] ─┐│
│  │ Nombre: [Validación Servicio Médico              ]              ││
│  │                                                                  ││
│  │ Aprobador:  ○ Por departamento  ● Por rol del sistema            ││
│  │             Rol: [Servicio Médico ▼]                             ││
│  │                                                                  ││
│  │ SLA: [24] hs hábiles   ☐ Comentario obligatorio al aprobar       ││
│  └──────────────────────────────────────────────────────────────────┘│
│                          ↓                                           │
│  ┌─── PASO 3 ──────────────────────────────────────── [✕ Eliminar] ─┐│
│  │ Nombre: [Registro Administrativo RRHH            ]              ││
│  │                                                                  ││
│  │ Aprobador:  ○ Por departamento  ● Por rol del sistema            ││
│  │             Rol: [RR.HH. ▼]                                      ││
│  │                                                                  ││
│  │ SLA: [ 8] hs hábiles   ☐ Comentario obligatorio al aprobar       ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  [+ Agregar paso]  (deshabilitado si ya hay 5 pasos)                │
│                                                                      │
│  ⚠️  Los cambios no afectarán solicitudes en curso.                 │
│                                                                      │
│  [Cancelar]                                  [Guardar flujo]        │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 10.3 Historial en detalle de solicitud

```
Historial de aprobación — LIC-2026-00123

  ✅ Paso 1 — Aprobación Jefe de Área (Gerencia General)
     Aprobado por: Carlos Méndez (Colaborador — Gerencia)
     Fecha: 14/05/2026 09:15 hs
     Comentario: "El colaborador tiene saldo disponible. Procede."

  ✅ Paso 2 — Validación Servicio Médico
     Aprobado por: Dra. Ana García (Servicio Médico)
     Fecha: 14/05/2026 10:32 hs
     Comentario: "Certificado válido, reposo indicado 5 días hábiles."

  ⏳ Paso 3 — Registro Administrativo RRHH
     Pendiente de resolución
     Notificado: 14/05/2026 10:32 hs
     SLA: vence 15/05/2026 18:00 hs
```

---

## 11. Seguridad y control de acceso — resumen

| Acción | `admin_empresa` | `rrhh` | `servicio_medico` | `colaborador` |
|--------|:-:|:-:|:-:|:-:|
| Acceder a `/admin/configuracion/aprobaciones` | ✅ | ❌ | ❌ | ❌ |
| Ver lista de flujos configurados | ✅ | Solo lectura (otro path) | ❌ | ❌ |
| Crear / editar / desactivar flujos | ✅ | ❌ | ❌ | ❌ |
| Aprobar paso tipo `rol = rrhh` | ✅ | ✅ | ❌ | ❌ |
| Aprobar paso tipo `rol = servicio_medico` | ✅ | ❌ | ✅ | ❌ |
| Aprobar paso tipo `departamento` | ✅ | ❌ | ❌ | ✅ (si es del departamento y no es la solicitud propia) |
| Ver historial de aprobaciones | ✅ | ✅ | ✅ | ❌ |
| Cancelar solicitud en `en_revision` | ✅ | ❌ | ❌ | ❌ |

---

## 12. Audit trail

| Evento (`action`) | `entity_type` | Descripción |
|-------------------|---------------|-------------|
| `created` | `flujos_aprobacion` | Creación de flujo |
| `updated` | `flujos_aprobacion` | Edición de flujo |
| `deactivated` | `flujos_aprobacion` | Desactivación de flujo |
| `approved` | `aprobaciones_solicitud` | Aprobación de un paso |
| `rejected` | `aprobaciones_solicitud` | Rechazo de un paso |

---

## 13. Dependencias

| Módulo | Dependencia | Tipo |
|--------|-------------|------|
| REQ_08 (Licencias) | `solicitudes_licencia`, `tipos_licencia`, `politicas_licencia` | Fuerte — extensión directa |
| REQ_03 (Roles) | Validación de `role` del aprobador por rol | Fuerte |
| REQ_04 (Empresas / Departamentos) | `departamentos` como aprobadores | Fuerte |
| REQ_10 (WhatsApp) | Notificación al colaborador (resultado final) | Débil — best-effort |
| REQ_11 (Portal Web) | UI del parametrizador (`/admin/configuracion/aprobaciones`) y del historial | Fuerte |
| REQ_09 (Servicio Médico) | `servicio_medico` como rol aprobador | Débil |

---

## 14. Notas de implementación

- La creación del flujo y sus pasos debe ser **transacción atómica** — si falla algún paso, rollback completo.
- Al crear una solicitud, la creación de los registros `aprobaciones_solicitud` también va en la misma transacción.
- El índice unique parcial `WHERE is_active = true` en `flujos_aprobacion` garantiza a nivel DB un solo flujo activo por (tenant, tipo_licencia).
- El endpoint `pendientes-mi-aprobacion` debe construir la query según el rol del usuario:
  - Si `role in ('rrhh', 'servicio_medico', 'admin_empresa')` → filtra por `tipo_aprobador = 'rol'` y `rol_aprobador = role`
  - Si `role = 'colaborador'` → filtra por `tipo_aprobador = 'departamento'` y `departamento_id = colaborador_perfil.departamento_id` excluyendo solicitudes propias
  - Si `role = 'admin_empresa'` → ve todo
- Para notificación departamental (Paso tipo `departamento`): al avanzar al paso N, el sistema consulta todos los `users` activos con `role = 'colaborador'` cuyo `colaborador_perfil.departamento_id = pasos_flujo.departamento_id` y los notifica a todos.
- `departamento_nombre` en `aprobaciones_solicitud` es un snapshot textual para el historial — evita el JOIN con `departamentos` y protege el historial si el departamento cambia de nombre.
- La validación de auto-aprobación (`RN-06`) debe hacerse en el servicio, no solo en el frontend.

---

## 15. Casos de uso completos

### CU-01: Admin configura flujo con aprobador de departamento para Enfermedad

**Actor:** `admin_empresa`  
**Ruta:** `http://localhost:5580/admin/configuracion/aprobaciones`  
**Flujo:**
1. Admin accede al módulo desde `/admin/configuracion/aprobaciones`
2. Ve que "Enfermedad (ENF)" aparece como "Default"
3. Hace clic en "Configurar flujo" en esa fila
4. Define nombre: "Jefe + Médico + RRHH"
5. Paso 1: "Aprobación Jefe de Área" → tipo = Departamento → selecciona "Gerencia General" → SLA 16hs
6. Paso 2: "Validación Médica" → tipo = Rol → Servicio Médico → SLA 24hs
7. Paso 3: "Registro RRHH" → tipo = Rol → RR.HH. → SLA 8hs
8. Guarda → sistema valida (3 pasos contiguos, sin gaps, cada paso con tipo/aprobador consistente)
9. Sistema crea `flujos_aprobacion` + 3 registros `pasos_flujo` en transacción
10. Confirma: "Flujo guardado. Se aplicará a nuevas solicitudes de Enfermedad Inculpable."

---

### CU-02: Colaborador de Gerencia aprueba solicitud de su departamento

**Actor:** Carlos Méndez (colaborador, departamento = Gerencia General)  
**Precondición:** Solicitud ENF en Paso 1 (tipo = departamento = Gerencia General)  
**Flujo:**
1. Carlos recibe notificación: "Hay una solicitud de licencia pendiente de revisión de tu área"
2. Carlos accede a su portal y ve el panel "Aprobaciones pendientes"
3. Ve la solicitud de su compañero María López (ENF, 5 días)
4. Revisa los datos y adjuntos
5. No puede ver su propia solicitud en este listado (RN-06)
6. Aprueba con comentario: "El colaborador tiene saldo disponible. Procede."
7. Sistema valida: Carlos es colaborador de Gerencia General ✅, no es el solicitante ✅
8. Sistema marca `aprobaciones_solicitud[orden=1].estado = 'aprobado'`, `aprobado_por = Carlos`
9. Sistema avanza `solicitudes_licencia.paso_actual = 2`, estado = `en_revision`
10. Sistema notifica a Servicio Médico (Paso 2)
11. María (solicitante) NO recibe notificación en este paso — solo al final

---

### CU-03: Admin desactiva flujo con solicitudes activas

**Actor:** `admin_empresa`  
**Flujo:**
1. Admin intenta desactivar el flujo "Jefe + Médico + RRHH" para ENF
2. Sistema detecta 3 solicitudes en estado `en_revision` usando ese flujo
3. Sistema muestra alerta: "Hay 3 solicitudes en curso usando este flujo. Se desactivará para nuevas solicitudes — las existentes continuarán con el flujo actual."
4. Admin confirma
5. Sistema setea `flujos_aprobacion.is_active = false`
6. Las 3 solicitudes activas conservan su `flujo_id` y continúan su proceso normal
7. Las nuevas solicitudes ENF pasarán a usar el fallback de `politicas_licencia`

---

*Documento generado en sesión de análisis funcional — Mayo 2026*  
*Autor funcional: Sesión NUMI — Analista Funcional SR*
