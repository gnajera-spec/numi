# REQ_08 — Módulo de Gestión de Licencias

**Estado:** ⏳ Pendiente  
**Módulo:** licencias  
**Prioridad:** Alta  
**Referencia AF:** Sección 4.5  
**Actores:** Colaborador (WhatsApp + Portal Web), RR.HH., Servicio Médico, Administrador

---

## Descripción

Gestión del ciclo completo de solicitud, aprobación, seguimiento y control de licencias y ausencias del personal, con integración al canal WhatsApp y al portal web del colaborador. El catálogo de tipos es configurable por empresa según convenio colectivo.

---

## Requerimientos funcionales

### 4.5.1 — Catálogo de Tipos de Licencia

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-08-01 | Catálogo base con tipos predefinidos (ver tabla de tipos) | ⏳ |
| RF-08-02 | El Administrador puede agregar tipos de licencia personalizados | ⏳ |
| RF-08-03 | El Administrador puede definir días disponibles y aprobador por tipo | ⏳ |
| RF-08-04 | El catálogo es configurable por empresa según convenio colectivo | ⏳ |

### 4.5.2 — Flujo de Solicitud (Colaborador vía WhatsApp)

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-08-05 | El colaborador inicia la solicitud desde el menú WhatsApp ("Solicitar licencia") | ⏳ |
| RF-08-06 | El bot presenta el menú de tipos de licencia con botones interactivos | ⏳ |
| RF-08-07 | El bot solicita fecha de inicio y fecha de fin (o cantidad de días) | ⏳ |
| RF-08-08 | Si el tipo requiere certificado, el bot solicita adjuntar imagen o PDF | ⏳ |
| RF-08-09 | El bot muestra resumen de la solicitud y pide confirmación explícita | ⏳ |
| RF-08-10 | Al confirmar, la solicitud queda en estado PENDIENTE y el sistema notifica al aprobador | ⏳ |
| RF-08-11 | El colaborador recibe acuse de recibo con número de solicitud | ⏳ |

### 4.5.3 — Flujo de Aprobación (Back-office)

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-08-12 | El responsable accede al dashboard de licencias pendientes | ⏳ |
| RF-08-13 | El responsable puede revisar la solicitud y los documentos adjuntos | ⏳ |
| RF-08-14 | El responsable puede aprobar o rechazar con comentario opcional | ⏳ |
| RF-08-15 | Al aprobar, el sistema descuenta los días del saldo del colaborador | ⏳ |
| RF-08-16 | El colaborador es notificado vía WhatsApp con el resultado en menos de 30 segundos | ⏳ |
| RF-08-17 | El estado se actualiza en el calendario de ausencias del equipo | ⏳ |

### 4.5.4 — Estados de una Solicitud

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-08-18 | Soporte completo para todos los estados definidos (ver tabla de estados) | ⏳ |
| RF-08-19 | El colaborador puede cancelar una solicitud en estado Pendiente (antes del inicio) | ⏳ |
| RF-08-20 | Las solicitudes vencen automáticamente si no se presenta documentación en plazo | ⏳ |

### 4.5.5 — Saldo de Días y Calendario

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-08-21 | Cada colaborador tiene saldo de días por tipo de licencia según convenio y antigüedad | ⏳ |
| RF-08-22 | El colaborador puede consultar su saldo vía WhatsApp ("Ver mis días disponibles") | ⏳ |
| RF-08-23 | RR.HH. visualiza el calendario de ausencias con vista mensual y filtros por departamento | ⏳ |
| RF-08-24 | Alertas automáticas: saldo bajo (< 3 días), vencimiento de vacaciones no tomadas, acumulación excesiva | ⏳ |

---

## Catálogo de tipos de licencia base

| Tipo | Código | Aprobador | Requiere Certificado |
|------|--------|-----------|----------------------|
| Vacaciones anuales | VAC | RR.HH. | No |
| Enfermedad inculpable | ENF | Servicio Médico | Sí (cert. médico) |
| Maternidad | MAT | RR.HH. | Sí (partida/nacimiento) |
| Paternidad | PAT | RR.HH. | Sí (partida) |
| Matrimonio | MAT-C | RR.HH. | Sí (partida matrimonio) |
| Fallecimiento familiar | DUE | RR.HH. | Sí (acta defunción) |
| Examen / Estudio | EST | RR.HH. | Sí (certificado examen) |
| Accidente de trabajo | ART | Serv. Médico / ART | Sí (denuncia ART) |
| Sin goce de sueldo | SGS | Administrador | No |
| Personalizada | CUST | Configurable | Configurable |

---

## Estados de una solicitud de licencia

| Estado | Descripción | Notificación al Colaborador |
|--------|-------------|----------------------------|
| Borrador | Iniciada pero no confirmada | No |
| Pendiente | Enviada, esperando aprobación | Sí — acuse de recibo |
| En revisión | El responsable está analizando | Sí — mensaje informativo |
| Aprobada | Aprobada por el responsable | Sí — detalle de días y período |
| Rechazada | Rechazada con motivo | Sí — motivo del rechazo |
| Cancelada | Cancelada por el colaborador | Sí — confirmación |
| Vencida | No se presentó documentación en plazo | Sí — alerta de vencimiento |

---

## Tablas involucradas

Ver `docs/DATA_MODEL.md` → Tablas `licencias_tipos`, `solicitudes_licencia`, `saldo_licencias`, `calendario_ausencias`.

---

## Endpoints involucrados

Ver `docs/API_SPEC.md` → Sección Licencias.

---

## Notas de implementación

- El cálculo de días disponibles debe considerar antigüedad, convenio colectivo y licencias ya aprobadas del período.
- Los documentos adjuntos se almacenan en S3/equivalente con URL firmada; el Servicio Médico debe poder visualizarlos desde el back-office.
- El flujo de WhatsApp no debe superar 8 intercambios de mensajes en ningún tipo de licencia.
- Las alertas de saldo bajo deben ser configurables por empresa (umbral de días).
