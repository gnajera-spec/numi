# REQ_06 — Módulo de Recibos de Sueldo

**Estado:** ⏳ Pendiente  
**Módulo:** recibos_sueldo  
**Prioridad:** Alta  
**Referencia AF:** Sección 4.3  
**Actores:** RR.HH., Colaborador (WhatsApp + Portal Web)

---

## Descripción

Gestión del ciclo de vida completo del recibo de sueldo: desde la carga por RR.HH. hasta la firma electrónica del colaborador, con cumplimiento de los requisitos legales de notificación fehaciente (Ley de Contrato de Trabajo, Argentina).

---

## Requerimientos funcionales

### 4.3.1 — Carga de Recibos

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-06-01 | RR.HH. selecciona período (mes/año) y empresa/sede de destino | ⏳ |
| RF-06-02 | Carga de recibos como PDFs individuales o como ZIP con múltiples archivos | ⏳ |
| RF-06-03 | El sistema parsea el nombre del archivo o metadatos para asociar cada PDF al colaborador por CUIL | ⏳ |
| RF-06-04 | Revisión previa: RR.HH. visualiza el mapeo CUIL → colaborador antes de confirmar la distribución | ⏳ |
| RF-06-05 | Al confirmar, el sistema distribuye los recibos y dispara las notificaciones WhatsApp | ⏳ |

### 4.3.2 — Notificación y Acceso del Colaborador (vía WhatsApp)

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-06-06 | El bot envía notificación push al colaborador cuando hay un nuevo recibo disponible | ⏳ |
| RF-06-07 | El colaborador responde VER y el bot envía el PDF del recibo como documento adjunto | ⏳ |
| RF-06-08 | El sistema registra timestamp de entrega del mensaje | ⏳ |
| RF-06-09 | El bot solicita firma: el colaborador responde CONFIRMO para firmar electrónicamente | ⏳ |
| RF-06-10 | La firma registra: timestamp UTC, WhatsApp_ID verificado y hash SHA-256 del documento | ⏳ |

### 4.3.3 — Gestión de Recibos por RR.HH.

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-06-11 | Dashboard de estado: Pendientes de firma / Firmados / No entregados | ⏳ |
| RF-06-12 | Reenvío manual de notificación a colaboradores que no abrieron el recibo | ⏳ |
| RF-06-13 | Descarga de reporte de firmas (PDF/Excel) con evidencia legal | ⏳ |
| RF-06-14 | Historial completo de recibos por colaborador | ⏳ |
| RF-06-15 | Fecha límite de firma configurable por empresa (plazo de gracia) | ⏳ |
| RF-06-16 | Alerta automática a RR.HH. cuando un colaborador no firma en el plazo establecido | ⏳ |

### 4.3.4 — Acceso Histórico del Colaborador

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-06-17 | El colaborador puede solicitar recibos de períodos anteriores vía WhatsApp | ⏳ |
| RF-06-18 | El bot presenta los últimos 12 meses disponibles para seleccionar | ⏳ |

---

## Flujo de firma electrónica (WhatsApp)

| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Sistema | Envía notificación: "Tu recibo de [mes/año] está disponible. Responde VER." |
| 2 | Colaborador | Responde VER |
| 3 | Sistema | Envía PDF como documento adjunto |
| 4 | Sistema | Registra timestamp de entrega |
| 5 | Sistema | Solicita: "Para firmar, responde CONFIRMO." |
| 6 | Colaborador | Responde CONFIRMO |
| 7 | Sistema | Registra firma: timestamp + WhatsApp_ID + hash SHA-256 |

---

## Validez legal

La firma electrónica implementada tiene plena validez probatoria como medio de constatación de conformidad (ampliamente utilizado en la práctica laboral argentina). Registra: IP del servidor, timestamp UTC, hash SHA-256 del documento y sesión verificada. **No** equivale a firma digital con certificado de autoridad certificante (Ley 25.506), que queda fuera del alcance de v1.0.

---

## Estados de un recibo

| Estado | Descripción |
|--------|-------------|
| Pendiente | Recibo cargado, notificación aún no enviada |
| Entregado | Notificación enviada, colaborador aún no firmó |
| Firmado | Colaborador confirmó con CONFIRMO o desde el portal web |
| Vencido | Superó el plazo de gracia sin firma |

---

## Tablas involucradas

Ver `docs/DATA_MODEL.md` → Tablas `recibos`, `firmas_electronicas`, `recibo_distribuciones`.

---

## Endpoints involucrados

Ver `docs/API_SPEC.md` → Sección Recibos.

---

## Notas de implementación

- El PDF del recibo debe almacenarse con URL firmada de corta duración (expira a las 24 hs) en S3/equivalente.
- El hash SHA-256 se calcula sobre el binario del PDF antes de distribución — nunca recalcular sobre el archivo modificado.
- La carga masiva (ZIP) debe ser asíncrona; el proceso de parseo y mapeo corre en background con notificación de resultado a RR.HH.
- Usar cola de mensajes para el envío masivo de notificaciones (evitar rate limit de WhatsApp API).
