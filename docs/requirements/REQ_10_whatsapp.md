# REQ_10 — Integración con WhatsApp Business API

**Estado:** ⏳ Pendiente  
**Módulo:** whatsapp  
**Prioridad:** Alta  
**Referencia AF:** Sección 5  
**Actor principal:** Colaborador (canal de interacción)

---

## Descripción

WhatsApp es el canal principal de interacción del colaborador con HRConnect, reemplazando la necesidad de una app móvil nativa. La integración usa la WhatsApp Business Platform (Cloud API) de Meta. El bot opera como una máquina de estados finitos con sesión por colaborador.

---

## Requerimientos funcionales

### 5.1 — Arquitectura de Integración

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-10-01 | Integración con WhatsApp Business Platform (Cloud API) de Meta | ⏳ |
| RF-10-02 | Session Manager interno que mantiene el estado de la conversación por colaborador | ⏳ |
| RF-10-03 | Cola de mensajes (RabbitMQ o SQS) para gestionar picos de envío masivo | ⏳ |
| RF-10-04 | Almacenamiento seguro de PDFs y documentos adjuntos (S3 o equivalente) | ⏳ |
| RF-10-05 | Una Meta Business Account verificada por empresa cliente en HRConnect | ⏳ |

### 5.2 — Tipos de Mensajes

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-10-06 | Template Messages (HSM) para notificaciones iniciadas por el sistema | ⏳ |
| RF-10-07 | Session Messages (texto libre) dentro de ventana de 24 horas | ⏳ |
| RF-10-08 | Interactive List Messages para menús de opciones | ⏳ |
| RF-10-09 | Interactive Button Messages para confirmaciones y acciones rápidas | ⏳ |
| RF-10-10 | Document Messages para envío de PDFs (recibos, comunicaciones, aptitudes) | ⏳ |
| RF-10-11 | Image Messages para recepción de certificados médicos del colaborador (JPEG, PNG) | ⏳ |

### 5.3 — Máquina de Estados del Bot

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-10-12 | Estado IDLE: sin sesión activa, cualquier mensaje del colaborador activa MENU_PRINCIPAL | ⏳ |
| RF-10-13 | Estado MENU_PRINCIPAL: menú raíz con opciones disponibles | ⏳ |
| RF-10-14 | Sub-flujo RECIBOS con estados VER_RECIBO e VER_HISTORIAL | ⏳ |
| RF-10-15 | Sub-flujo LICENCIAS con estados SOLICITAR, VER_SALDO, VER_ESTADO | ⏳ |
| RF-10-16 | Sub-flujo SOLICITUD_LICENCIA: wizard paso a paso (tipo → fechas → adjunto → confirmación) | ⏳ |
| RF-10-17 | Sub-flujo COMUNICACIONES: VER_PENDIENTES, CONFIRMAR_LECTURA | ⏳ |
| RF-10-18 | Estado AYUDA: información de contacto de RR.HH. y Servicio Médico | ⏳ |
| RF-10-19 | Estado ERROR: manejo de mensajes no reconocidos; regresa a MENU_PRINCIPAL tras 2 reintentos | ⏳ |
| RF-10-20 | La sesión expira tras 10 minutos de inactividad (regresa a IDLE) | ⏳ |
| RF-10-21 | Todos los flujos tienen opción de cancelar y regresar al menú principal en cualquier paso | ⏳ |

### 5.4 — Gestión de Plantillas (HSM)

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-10-22 | Catálogo de plantillas pre-aprobadas por Meta provisto por HRConnect | ⏳ |
| RF-10-23 | Cada empresa puede personalizar los textos dentro de los parámetros de la plantilla aprobada | ⏳ |
| RF-10-24 | Plantilla `nuevo_recibo_disponible` para notificación de recibo | ⏳ |
| RF-10-25 | Plantilla `licencia_aprobada` para notificación de aprobación | ⏳ |
| RF-10-26 | Plantilla `licencia_rechazada` para notificación de rechazo | ⏳ |
| RF-10-27 | Plantilla `nueva_comunicacion` para comunicaciones institucionales | ⏳ |
| RF-10-28 | Plantilla `solicitar_certificado` para solicitud de certificado médico | ⏳ |
| RF-10-29 | Plantilla `recordatorio_firma_recibo` para recibos sin firmar próximos al vencimiento | ⏳ |

### 5.5 — Privacidad y Seguridad

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-10-30 | Los documentos se protegen con URLs firmadas de corta duración (expiran a las 24 hs) | ⏳ |
| RF-10-31 | El bot nunca solicita contraseñas, datos bancarios ni información sensible | ⏳ |
| RF-10-32 | El mapeo WhatsApp_ID → colaborador se almacena cifrado en la base de datos | ⏳ |
| RF-10-33 | Los logs de conversación se retienen 90 días y luego se eliminan (configurable por empresa) | ⏳ |

---

## Máquina de estados del bot

| Estado | Descripción | Transiciones |
|--------|-------------|-------------|
| IDLE | Sin sesión activa | Cualquier mensaje → MENU_PRINCIPAL |
| MENU_PRINCIPAL | Menú raíz | → RECIBOS, LICENCIAS, COMUNICACIONES, AYUDA |
| RECIBOS | Sub-flujo recibos | → VER_RECIBO, VER_HISTORIAL, → MENU_PRINCIPAL |
| LICENCIAS | Sub-flujo licencias | → SOLICITAR, VER_SALDO, VER_ESTADO, → MENU_PRINCIPAL |
| SOLICITUD_LICENCIA | Wizard paso a paso | → tipo → fechas → adjunto → confirmación → MENU_PRINCIPAL |
| COMUNICACIONES | Sub-flujo comunicados | → VER_PENDIENTES, CONFIRMAR_LECTURA, → MENU_PRINCIPAL |
| AYUDA | Contacto RR.HH. / S. Médico | → MENU_PRINCIPAL |
| ERROR | Manejo de errores | → MENU_PRINCIPAL (tras 2 reintentos) |

---

## Tablas involucradas

Ver `docs/DATA_MODEL.md` → Tablas `whatsapp_sessions`, `whatsapp_config`, `hsm_templates`, `message_logs`.

---

## Endpoints involucrados

Ver `docs/API_SPEC.md` → Sección WhatsApp / Webhook.

---

## Notas de implementación

- El webhook de Meta debe responder con HTTP 200 en menos de 5 segundos o Meta reintenta el envío.
- El estado de la sesión del bot debe persistir en Redis (no en DB relacional) para acceso de baja latencia.
- El bot debe reconocer variaciones ortográficas comunes (ej: "licencia" y "licencia" con tilde).
- El flujo máximo de solicitud de licencia no debe superar 8 intercambios de mensajes.
- El bot opera 24/7; las notificaciones de aprobación/rechazo de RR.HH. usan Template Messages (fuera de ventana de sesión).
