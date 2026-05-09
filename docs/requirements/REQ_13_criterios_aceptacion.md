# REQ_13 — Criterios de Aceptación por Módulo

**Estado:** ⏳ Pendiente  
**Módulo:** criterios_aceptacion  
**Prioridad:** Alta  
**Referencia AF:** Sección 10

---

## Descripción

Criterios de aceptación de alto nivel por módulo funcional. Expresados en formato Dado / Cuando / Entonces (BDD). Deben ser detallados y convertidos en historias de usuario durante el refinamiento de backlog.

---

## 10.1 — Onboarding de Colaborador

| ID | Criterio | Estado |
|----|---------|--------|
| CA-01-01 | **Dado** que RR.HH. crea un colaborador y guarda el perfil, **cuando** el sistema procesa la acción, **entonces** el colaborador debe recibir el mensaje de invitación por WhatsApp en **menos de 60 segundos** | ⏳ |
| CA-01-02 | **Dado** que el colaborador sigue el flujo de activación y confirma su identidad correctamente, **cuando** el sistema valida los datos, **entonces** su estado en el sistema debe ser "Activo" | ⏳ |
| CA-01-03 | **Dado** que el colaborador intenta activarse con CUIL incorrecto, **cuando** el sistema detecta la discrepancia, **entonces** debe rechazar la activación y notificar a RR.HH. | ⏳ |

---

## 10.2 — Recibos de Sueldo

| ID | Criterio | Estado |
|----|---------|--------|
| CA-02-01 | **Dado** que RR.HH. carga un ZIP de recibos, **cuando** el proceso finaliza, **entonces** todos los recibos válidos deben estar asociados a su colaborador correspondiente con **0% de errores de mapeo** para datos correctos | ⏳ |
| CA-02-02 | **Dado** que el colaborador solicita su recibo, **cuando** el bot lo envía, **entonces** el PDF debe corresponder exactamente al período y colaborador solicitante | ⏳ |
| CA-02-03 | **Dado** que el colaborador firma su recibo respondiendo CONFIRMO, **cuando** el sistema registra la firma, **entonces** debe guardar: timestamp UTC, hash SHA-256 del documento y WhatsApp_ID | ⏳ |

---

## 10.3 — Licencias

| ID | Criterio | Estado |
|----|---------|--------|
| CA-03-01 | **Dado** que el colaborador completa el flujo de solicitud de licencia y confirma, **cuando** el sistema procesa la solicitud, **entonces** debe recibir un acuse de recibo con número de solicitud y estado PENDIENTE | ⏳ |
| CA-03-02 | **Dado** que RR.HH. aprueba una licencia y guarda la decisión, **cuando** el sistema procesa la aprobación, **entonces** el colaborador debe ser notificado por WhatsApp en **menos de 30 segundos** | ⏳ |
| CA-03-03 | **Dado** que el colaborador consulta su saldo de días vía bot, **cuando** el sistema responde, **entonces** debe mostrar el saldo actualizado considerando licencias aprobadas y pendientes | ⏳ |

---

## 10.4 — Comunicaciones

| ID | Criterio | Estado |
|----|---------|--------|
| CA-04-01 | **Dado** que RR.HH. publica una comunicación segmentada, **cuando** el sistema procesa el envío, **entonces** todos los colaboradores del segmento deben recibir el mensaje por WhatsApp dentro de los **5 minutos** | ⏳ |
| CA-04-02 | **Dado** que el colaborador confirma lectura (vía WhatsApp o portal web), **cuando** el sistema registra la confirmación, **entonces** el dashboard de RR.HH. debe actualizarse en **tiempo real** | ⏳ |

---

## 10.5 — Portal Web del Colaborador

| ID | Criterio | Estado |
|----|---------|--------|
| CA-05-01 | **Dado** que el colaborador accede al link de activación y setea su contraseña, **cuando** confirma, **entonces** el portal debe redirigirlo al dashboard y el bot de WhatsApp debe quedar habilitado simultáneamente | ⏳ |
| CA-05-02 | **Dado** que el colaborador firma un recibo desde el portal web, **cuando** el sistema registra la firma, **entonces** debe contener: timestamp UTC, hash SHA-256 del documento y user_id — equivalente a la firma por WhatsApp | ⏳ |
| CA-05-03 | **Dado** que el colaborador firma un recibo por WhatsApp, **cuando** accede al portal web, **entonces** el estado del recibo debe mostrarse como "Firmado" en el portal (y viceversa) | ⏳ |
| CA-05-04 | **Dado** que el colaborador solicita una licencia desde el portal web y confirma, **cuando** el sistema procesa la solicitud, **entonces** debe aparecer en el dashboard de RR.HH. en estado Pendiente en **menos de 5 segundos** | ⏳ |
| CA-05-05 | **Dado** que el colaborador accede al portal desde un dispositivo móvil (375px), **cuando** navega por cualquier sección, **entonces** todos los elementos deben ser legibles y operables sin scroll horizontal | ⏳ |

---

## Próximos pasos

Estos criterios de alto nivel deben ser refinados en historias de usuario con los siguientes formatos durante el sprint planning:

- **Criterios de aceptación detallados**: incluir casos de borde y escenarios de error.
- **Definition of Done**: tests unitarios, tests de integración y revisión de código aprobada.
- **Estimación de esfuerzo**: story points asignados por el equipo de desarrollo.

---

*Referencia: HRConnect_Analisis_Funcional_v1.0.docx — Sección 10 | Versión 1.0 | Mayo 2026*
