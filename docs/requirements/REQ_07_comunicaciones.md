# REQ_07 — Módulo de Comunicaciones Institucionales

**Estado:** ⏳ Pendiente  
**Módulo:** comunicaciones  
**Prioridad:** Media  
**Referencia AF:** Sección 4.4  
**Actores:** RR.HH., Administrador, Colaborador (WhatsApp + Portal Web)

---

## Descripción

Sistema de mensajería unidireccional que permite a RR.HH. enviar comunicaciones institucionales a segmentos específicos de colaboradores, con confirmación de lectura y métricas de alcance.

---

## Requerimientos funcionales

### 4.4.1 — Creación de una Comunicación

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-07-01 | Definir asunto/título y cuerpo del mensaje (texto enriquecido) | ⏳ |
| RF-07-02 | Adjuntar archivos opcionales (PDF, imágenes) | ⏳ |
| RF-07-03 | Seleccionar segmento de destinatarios (ver tabla de segmentación) | ⏳ |
| RF-07-04 | Configurar envío inmediato o programado (fecha/hora) | ⏳ |
| RF-07-05 | Previsualización del mensaje tal como lo recibirá el colaborador en WhatsApp | ⏳ |
| RF-07-06 | Confirmación explícita antes del envío masivo | ⏳ |

### 4.4.2 — Segmentación de Destinatarios

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-07-07 | Segmento "Todos los colaboradores": comunicación masiva a toda la empresa | ⏳ |
| RF-07-08 | Segmento "Por Sede": colaboradores de una o varias sedes | ⏳ |
| RF-07-09 | Segmento "Por Departamento": colaboradores de uno o varios departamentos | ⏳ |
| RF-07-10 | Segmento "Por Puesto/Cargo": colaboradores con un cargo específico | ⏳ |
| RF-07-11 | Segmento "Lista personalizada": selección manual de colaboradores | ⏳ |
| RF-07-12 | Combinación de filtros AND/OR entre segmentos | ⏳ |

### 4.4.3 — Recepción por el Colaborador (vía WhatsApp)

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-07-13 | El colaborador recibe el mensaje en su chat de WhatsApp con el bot | ⏳ |
| RF-07-14 | Los archivos adjuntos se envían como documentos separados | ⏳ |
| RF-07-15 | El sistema puede solicitar confirmación de lectura: el colaborador responde LEÍDO | ⏳ |
| RF-07-16 | La confirmación de lectura es configurable por RR.HH. (opcional u obligatoria) | ⏳ |
| RF-07-17 | El sistema registra el read receipt de WhatsApp Business API | ⏳ |

### 4.4.4 — Seguimiento y Reportes

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-07-18 | Dashboard con métricas: total enviados, entregados, leídos, confirmados | ⏳ |
| RF-07-19 | Vista detallada por comunicación: lista de colaboradores por estado (Enviado / Entregado / Leído / Sin respuesta) | ⏳ |
| RF-07-20 | Exportación del reporte de confirmaciones en PDF o Excel | ⏳ |
| RF-07-21 | Reenvío de la comunicación solo a colaboradores que no confirmaron lectura | ⏳ |

---

## Tipos de segmentos disponibles

| Tipo de Segmento | Descripción |
|-----------------|-------------|
| Todos los colaboradores | Comunicación masiva a toda la empresa |
| Por Sede | Solo colaboradores de sede(s) seleccionada(s) |
| Por Departamento | Colaboradores de departamento(s) seleccionado(s) |
| Por Puesto/Cargo | Colaboradores con cargo específico |
| Lista personalizada | Selección manual individual |
| Combinación (AND/OR) | Ej: Depto. Ventas en Sede Norte |

---

## Estados de una comunicación (por destinatario)

| Estado | Descripción |
|--------|-------------|
| Enviado | Mensaje entregado a la API de WhatsApp |
| Entregado | WhatsApp confirmó la entrega al dispositivo |
| Leído | Read receipt de WhatsApp API recibido |
| Confirmado | Colaborador respondió LEÍDO explícitamente |
| Sin respuesta | Sin confirmación dentro del plazo configurado |

---

## Tablas involucradas

Ver `docs/DATA_MODEL.md` → Tablas `comunicaciones`, `comunicacion_destinatarios`, `comunicacion_estado`.

---

## Endpoints involucrados

Ver `docs/API_SPEC.md` → Sección Comunicaciones.

---

## Notas de implementación

- El envío masivo debe usar la cola de mensajes (RabbitMQ/SQS) para respetar el rate limit de WhatsApp Business API.
- Los mensajes programados requieren un job scheduler (cron) que ejecute el envío en el timestamp configurado.
- El reenvío a "no confirmados" debe filtrar los estados Enviado/Entregado (no incluir a los que ya leyeron).
- La respuesta LEÍDO del colaborador puede llegar fuera de la ventana de sesión activa — usar Template Message para la solicitud inicial.
