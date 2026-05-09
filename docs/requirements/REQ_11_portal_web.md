# REQ_11 — Portal Web del Colaborador

**Estado:** ⏳ Pendiente  
**Módulo:** portal_web  
**Prioridad:** Alta  
**Referencia AF:** Sección 9  
**Actor principal:** Colaborador

---

## Descripción

Canal de autoservicio web que convive con WhatsApp. El colaborador accede desde cualquier navegador con email y contraseña. La información es siempre consistente entre ambos canales (mismo backend y base de datos). El portal es mobile-first, diseñado para ser usado desde el celular sin necesidad de app nativa.

---

## Requerimientos funcionales

### 9.1 — Activación y Autenticación

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-11-01 | El link de activación se envía vía WhatsApp (mismo invite_token que el onboarding) sin pasos adicionales para RR.HH. | ⏳ |
| RF-11-02 | El colaborador setea su contraseña (mínimo 8 caracteres) en `/employee/activate?token=...` | ⏳ |
| RF-11-03 | La contraseña se almacena con bcrypt | ⏳ |
| RF-11-04 | Al activar, el portal y el bot de WhatsApp quedan habilitados simultáneamente | ⏳ |
| RF-11-05 | El link de activación es de un solo uso y expira a las 48 horas | ⏳ |
| RF-11-06 | RR.HH. puede reenviar la invitación desde el back-office si el link venció | ⏳ |
| RF-11-07 | Login en `/employee/login` con email y contraseña; JWT con expiración de 8 horas | ⏳ |

### 9.2 — Estructura del Portal

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-11-08 | Ruta `/employee/login` — Ingreso con email y contraseña | ⏳ |
| RF-11-09 | Ruta `/employee/activate?token=...` — Activación y seteo de contraseña | ⏳ |
| RF-11-10 | Ruta `/employee/dashboard` — Dashboard con resumen y accesos directos | ⏳ |
| RF-11-11 | Ruta `/employee/receipts` — Historial de recibos, descarga y firma | ⏳ |
| RF-11-12 | Ruta `/employee/leaves` — Solicitar licencia, historial y saldo de días | ⏳ |
| RF-11-13 | Ruta `/employee/communications` — Comunicados recibidos y confirmación de lectura | ⏳ |
| RF-11-14 | Ruta `/employee/profile` — Datos personales y cambio de contraseña | ⏳ |

### 9.3 — Dashboard del Colaborador

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-11-15 | Tarjetas de acceso rápido a los cuatro módulos | ⏳ |
| RF-11-16 | Badge numérico en rojo para recibos pendientes de firma | ⏳ |
| RF-11-17 | Indicador de comunicaciones no leídas | ⏳ |
| RF-11-18 | Feed de notificaciones recientes (recibos, licencias, comunicados) | ⏳ |
| RF-11-19 | Datos de contexto: empresa, puesto, departamento, sede | ⏳ |

### 9.4 — Módulo de Recibos (Portal Web)

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-11-20 | Lista de recibos ordenada por período con badge de estado (Pendiente / Entregado / Firmado / Vencido) | ⏳ |
| RF-11-21 | Botón "Descargar PDF" disponible en cada recibo | ⏳ |
| RF-11-22 | Botón "Firmar" visible solo si el recibo está en estado Pendiente o Entregado | ⏳ |
| RF-11-23 | Flujo de firma: modal con preview del PDF, checkbox de conformidad y botón "Firmar electrónicamente" | ⏳ |
| RF-11-24 | La firma web registra: timestamp UTC, hash SHA-256 e identificador del usuario | ⏳ |
| RF-11-25 | Al firmar, el estado cambia inmediatamente en el portal y en el dashboard de RR.HH. | ⏳ |
| RF-11-26 | Una firma realizada por WhatsApp se refleja en el portal (y viceversa) | ⏳ |

### 9.5 — Módulo de Licencias (Portal Web)

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-11-27 | Selector desplegable de tipo de licencia (tipos activos del tenant) | ⏳ |
| RF-11-28 | Date range picker para fecha de inicio y fin; el sistema calcula los días automáticamente | ⏳ |
| RF-11-29 | Campo de comentario opcional | ⏳ |
| RF-11-30 | Si el tipo requiere certificado: zona de carga drag & drop (PDF o imagen) | ⏳ |
| RF-11-31 | Resumen de la solicitud con saldo disponible visible antes de confirmar | ⏳ |
| RF-11-32 | Tabla de historial de solicitudes: tipo, período, días, estado (badge con color) y comentario del revisor | ⏳ |
| RF-11-33 | Botón "Cancelar" disponible solo si la solicitud está en estado Pendiente | ⏳ |
| RF-11-34 | Tarjetas de saldo por tipo: Total asignado / Usados / Pendientes / Disponibles con barra de progreso visual | ⏳ |

### 9.6 — Módulo de Comunicaciones (Portal Web)

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-11-35 | Lista de comunicaciones recibidas con badge "NUEVA" en las no leídas | ⏳ |
| RF-11-36 | Vista detalle con título, cuerpo completo y archivos adjuntos descargables | ⏳ |
| RF-11-37 | Botón "Confirmar lectura" si la comunicación requiere confirmación | ⏳ |
| RF-11-38 | Filtros: Todas / No leídas / Confirmadas | ⏳ |

### 9.7 — Mi Perfil (Portal Web)

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-11-39 | El colaborador puede editar su teléfono WhatsApp (requiere re-verificación del nuevo número) | ⏳ |
| RF-11-40 | El colaborador puede editar su email de contacto secundario | ⏳ |
| RF-11-41 | El colaborador puede cambiar su contraseña (requiere ingresar la contraseña actual) | ⏳ |
| RF-11-42 | Nombre, CUIL, empresa, puesto y departamento son de solo lectura para el colaborador | ⏳ |

### 9.8 — Diseño y Experiencia Mobile

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-11-43 | Portal mobile-first: funcional desde el celular sin app | ⏳ |
| RF-11-44 | Navegación desktop: tabs horizontales en la parte superior | ⏳ |
| RF-11-45 | Navegación mobile: barra inferior fija con 4 íconos | ⏳ |
| RF-11-46 | Tap targets mínimos de 44×44px en todos los elementos interactivos | ⏳ |
| RF-11-47 | Texto base de 16px para evitar zoom automático en iOS | ⏳ |
| RF-11-48 | Estados vacíos con mensaje amigable y contextual en cada sección | ⏳ |
| RF-11-49 | Todos los elementos son legibles y operables en viewport de 375px sin scroll horizontal | ⏳ |

---

## Campos editables del perfil

| Campo | Editable | Descripción |
|-------|----------|-------------|
| Nombre y apellido | No | Solo RR.HH. puede modificarlo |
| CUIL | No | Dato de identidad |
| Empresa / Puesto / Depto. | No | Gestión de RR.HH. |
| Teléfono WhatsApp | Sí | Requiere re-verificación |
| Email de contacto secundario | Sí | Para futuras comunicaciones por email |
| Contraseña | Sí | Requiere contraseña actual |

---

## Coexistencia WhatsApp + Portal Web

| Acción | WhatsApp | Portal Web |
|--------|----------|------------|
| Notificación de nuevo recibo | ✅ Push automático | ✅ Badge en dashboard |
| Descargar recibo | ✅ PDF por el bot | ✅ Descarga directa |
| Firmar recibo | ✅ Responder CONFIRMO | ✅ Modal con preview |
| Solicitar licencia | ✅ Flujo conversacional | ✅ Formulario con date picker |
| Adjuntar certificado | ✅ Imagen/PDF al bot | ✅ Drag & drop |
| Ver saldo de días | ✅ Consulta al bot | ✅ Tarjetas con gráfico |
| Leer comunicación | ✅ Mensaje en el chat | ✅ Vista detalle |
| Confirmar lectura | ✅ Responder LEÍDO | ✅ Botón en la comunicación |
| Ver y editar perfil | ❌ No disponible | ✅ Sección Mi Perfil |
| Cambiar contraseña | ❌ No aplica | ✅ Sección Seguridad |

---

## Tablas involucradas

Ver `docs/DATA_MODEL.md` → Tablas `users`, `colaboradores`, `invite_tokens` (compartidas con el canal WhatsApp).

---

## Endpoints involucrados

Ver `docs/API_SPEC.md` → Sección Portal Colaborador (`/employee/*`).

---

## Notas de implementación

- El portal y el bot comparten el mismo backend — los cambios de estado son inmediatamente consistentes en ambos canales.
- Leer `docs/DESIGN_SYSTEM.md` antes de implementar cualquier componente del portal.
- El preview del PDF en el modal de firma debe renderizarse en el navegador (usar PDF.js o equivalente), sin descargar el archivo.
- El estado de firma entre WhatsApp y portal debe sincronizarse en tiempo real (polling o WebSocket/SSE).
