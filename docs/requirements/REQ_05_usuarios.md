# REQ_05 — Módulo de Administración de Usuarios

**Estado:** ⏳ Pendiente  
**Módulo:** usuarios  
**Prioridad:** Alta  
**Referencia AF:** Sección 4.2  
**Actores:** Administrador de Empresa, RR.HH., Colaborador

---

## Descripción

Gestión del ciclo de vida completo de los usuarios dentro de un tenant: alta individual o masiva, proceso de onboarding/invitación vía WhatsApp, administración del perfil del colaborador y transiciones de estado (activo, suspendido, baja).

---

## Requerimientos funcionales

### 4.2.1 — Alta de Usuarios

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-05-01 | Alta individual: ingreso manual de nombre, apellido, CUIL, puesto, departamento y número de WhatsApp | ⏳ |
| RF-05-02 | Carga masiva vía CSV con validación de errores por fila y reporte de resultado | ⏳ |
| RF-05-03 | Integración API (endpoint REST) para sincronización desde sistemas externos (ERP, HCM) | ⏳ |

### 4.2.2 — Proceso de Invitación y Onboarding

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-05-04 | Al crear el perfil, el sistema envía un mensaje de WhatsApp con enlace de activación (token de un solo uso, válido 48 horas) | ⏳ |
| RF-05-05 | El colaborador sigue el enlace desde WhatsApp y el bot solicita confirmar nombre y CUIL | ⏳ |
| RF-05-06 | Al confirmar identidad, el colaborador queda en estado Activo y el sistema envía el menú de bienvenida | ⏳ |
| RF-05-07 | Si el colaborador intenta activarse con CUIL incorrecto, el sistema rechaza la activación y notifica a RR.HH. | ⏳ |
| RF-05-08 | El número de WhatsApp es el identificador único del colaborador en el canal bot; el mapeo `WhatsApp_ID → colaborador_id` se almacena cifrado | ⏳ |

### 4.2.3 — Gestión del Ciclo de Vida del Usuario

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-05-09 | Activar colaborador: envío de invitación por WhatsApp | ⏳ |
| RF-05-10 | Suspender colaborador: el bot rechaza interacciones y notifica al colaborador | ⏳ |
| RF-05-11 | Reactivar colaborador: habilita el bot nuevamente | ⏳ |
| RF-05-12 | Baja definitiva: desvinculación del número; datos retenidos según política de retención | ⏳ |
| RF-05-13 | Cambio de número de WhatsApp: requiere proceso de re-validación de identidad | ⏳ |

### 4.2.4 — Perfil del Colaborador

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-05-14 | Datos personales: nombre, apellido, CUIL, fecha de nacimiento, género, estado civil | ⏳ |
| RF-05-15 | Datos laborales: empresa, sede, departamento, puesto, fecha de ingreso, convenio colectivo, categoría | ⏳ |
| RF-05-16 | Datos de contacto: número WhatsApp, email (opcional) | ⏳ |
| RF-05-17 | Documentos adjuntos: DNI escaneado, foto, contrato (uso interno RR.HH.) | ⏳ |
| RF-05-18 | Historial de cambios auditado: quién modificó, qué campo, valor anterior y nuevo | ⏳ |

---

## Estados del colaborador

| Estado | Descripción |
|--------|-------------|
| Pendiente | Perfil creado, invitación enviada, aún no activado |
| Activo | Identidad verificada, habilitado para operar |
| Suspendido | Acceso bloqueado temporalmente |
| Baja | Desvinculado definitivamente del tenant |

---

## Tablas involucradas

Ver `docs/DATA_MODEL.md` → Tablas `users`, `colaboradores`, `colaborador_auditoria`, `invite_tokens`.

---

## Endpoints involucrados

Ver `docs/API_SPEC.md` → Sección Usuarios / Colaboradores.

---

## Notas de implementación

- El invite_token debe ser de un solo uso, almacenado hasheado, con expiración de 48 horas.
- La baja definitiva no elimina los registros históricos (recibos firmados, licencias, etc.) — solo desvincula el número.
- El cambio de número WhatsApp debe invalidar el mapeo anterior antes de iniciar la re-verificación.
- Nunca exponer el WhatsApp_ID en responses de la API dirigidas al front-end del colaborador.
