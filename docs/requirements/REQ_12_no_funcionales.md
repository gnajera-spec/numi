# REQ_12 — Requerimientos No Funcionales y Flujos Principales

**Estado:** ⏳ Pendiente  
**Módulo:** no_funcionales  
**Prioridad:** Alta  
**Referencia AF:** Secciones 6 y 7

---

## Descripción

Restricciones y atributos de calidad del sistema que aplican transversalmente a todos los módulos: rendimiento, seguridad, escalabilidad, usabilidad del bot y cumplimiento normativo. Incluye también los flujos principales de usuario para referencia de implementación.

---

## 7.1 — Requerimientos de Rendimiento

| ID | Métrica | Objetivo | Estado |
|----|---------|----------|--------|
| RNF-12-01 | Tiempo de respuesta del bot (p95) | < 2 segundos para respuestas de texto simple | ⏳ |
| RNF-12-02 | Tiempo de envío de PDF al colaborador | < 5 segundos desde la solicitud | ⏳ |
| RNF-12-03 | Envío masivo de notificaciones | 1.000 mensajes en < 5 minutos (con cola asíncrona) | ⏳ |
| RNF-12-04 | Disponibilidad de la plataforma | 99,5% mensual (SLA con empresas cliente) | ⏳ |
| RNF-12-05 | Tiempo de carga del back-office | < 3 segundos para vistas principales | ⏳ |

---

## 7.2 — Requerimientos de Seguridad

| ID | Descripción | Estado |
|----|-------------|--------|
| RNF-12-06 | Autenticación en el back-office: usuario/contraseña + MFA (TOTP o email) | ⏳ |
| RNF-12-07 | Tokens de sesión JWT con expiración de 8 horas | ⏳ |
| RNF-12-08 | TLS 1.3 para todas las comunicaciones HTTP (cifrado en tránsito) | ⏳ |
| RNF-12-09 | AES-256 para datos sensibles en reposo (datos médicos, documentos) | ⏳ |
| RNF-12-10 | Row-level security en base de datos para aislamiento de tenant | ⏳ |
| RNF-12-11 | Log inmutable de todas las acciones de usuarios con privilegios (auditoría completa) | ⏳ |
| RNF-12-12 | Protección OWASP Top 10: SQL Injection, XSS, CSRF y similares | ⏳ |
| RNF-12-13 | Pen test anual por tercero independiente | ⏳ |

---

## 7.3 — Requerimientos de Escalabilidad

| ID | Descripción | Estado |
|----|-------------|--------|
| RNF-12-14 | Arquitectura de microservicios desplegables de forma independiente | ⏳ |
| RNF-12-15 | Auto-scaling horizontal del servicio de bot y de la API principal | ⏳ |
| RNF-12-16 | Soporte para hasta 500 empresas y 100.000 colaboradores activos en v1.0 | ⏳ |
| RNF-12-17 | Particionamiento de base de datos por tenant_id para grandes volúmenes | ⏳ |

---

## 7.4 — Usabilidad del Bot WhatsApp

| ID | Descripción | Estado |
|----|-------------|--------|
| RNF-12-18 | El bot opera de forma conversacional y natural, sin comandos técnicos crípticos | ⏳ |
| RNF-12-19 | Todos los flujos tienen opción de cancelar y regresar al menú principal en cualquier paso | ⏳ |
| RNF-12-20 | El bot reconoce variaciones ortográficas comunes | ⏳ |
| RNF-12-21 | Idioma principal: Español (Argentina). Extensible en versiones futuras. | ⏳ |
| RNF-12-22 | Tiempo máximo de cualquier flujo: no más de 8 intercambios de mensajes | ⏳ |

---

## 7.5 — Cumplimiento Normativo

| Marco Legal | Aplicación | Estado |
|-------------|------------|--------|
| Ley 25.326 — Protección de Datos Personales | Tratamiento de datos de colaboradores. Consentimiento explícito al onboarding. | ⏳ |
| Ley 20.744 — Ley de Contrato de Trabajo | Recibos de sueldo, licencias, condiciones laborales. | ⏳ |
| Resolución SRT — Seguridad e Higiene | Módulo de Servicio Médico, aptitudes y accidentes. | ⏳ |
| Meta Business Messaging Policy | Cumplimiento de políticas de uso de WhatsApp Business API. | ⏳ |
| GDPR (operación en UE) | Derecho al olvido, portabilidad de datos — roadmap v2.0. | ❌ Fuera de alcance v1.0 |

---

## Flujos principales de referencia

### Flujo 1: Onboarding de un Nuevo Colaborador

| Paso | Actor | Acción | Canal |
|------|-------|--------|-------|
| 1 | RR.HH. | Crea perfil del colaborador en el back-office | Web |
| 2 | Sistema | Envía mensaje de bienvenida e invitación | WhatsApp |
| 3 | Colaborador | Sigue el enlace de activación | WhatsApp |
| 4 | Sistema (Bot) | Solicita confirmación de identidad (nombre + CUIL) | WhatsApp |
| 5 | Colaborador | Ingresa nombre y CUIL | WhatsApp |
| 6 | Sistema | Valida identidad, activa la cuenta y envía menú principal | WhatsApp |
| 7 | RR.HH. | Dashboard muestra colaborador como "Activo" | Web |

### Flujo 2: Distribución y Firma de Recibo de Sueldo

| Paso | Actor | Acción | Canal |
|------|-------|--------|-------|
| 1 | RR.HH. | Carga recibos del período (PDF/ZIP) | Web |
| 2 | Sistema | Valida y mapea cada recibo al colaborador | Interno |
| 3 | Sistema | Envía notificación WhatsApp a todos los colaboradores | WhatsApp |
| 4 | Colaborador | Responde al bot para ver su recibo | WhatsApp |
| 5 | Sistema (Bot) | Envía el PDF del recibo | WhatsApp |
| 6 | Sistema (Bot) | Solicita firma: "responde CONFIRMO" | WhatsApp |
| 7 | Colaborador | Responde CONFIRMO | WhatsApp |
| 8 | Sistema | Registra firma con timestamp y hash SHA-256 | Interno |
| 9 | RR.HH. | Ve estado actualizado en el dashboard | Web |

### Flujo 3: Solicitud de Licencia por Vacaciones

| Paso | Actor | Acción | Canal |
|------|-------|--------|-------|
| 1 | Colaborador | Selecciona "Solicitar licencia" del menú | WhatsApp |
| 2 | Bot | Muestra tipos de licencia disponibles | WhatsApp |
| 3 | Colaborador | Selecciona "Vacaciones anuales" | WhatsApp |
| 4 | Bot | Solicita fecha de inicio y muestra saldo disponible | WhatsApp |
| 5 | Colaborador | Ingresa fecha de inicio | WhatsApp |
| 6 | Bot | Solicita fecha de fin o cantidad de días | WhatsApp |
| 7 | Colaborador | Ingresa fecha de fin | WhatsApp |
| 8 | Bot | Muestra resumen y pide confirmación | WhatsApp |
| 9 | Colaborador | Confirma la solicitud | WhatsApp |
| 10 | Sistema | Crea solicitud PENDIENTE y notifica a RR.HH. | Interno / Email |
| 11 | RR.HH. | Revisa y aprueba en el back-office | Web |
| 12 | Sistema | Notifica al colaborador la aprobación | WhatsApp |

---

## Notas de implementación

- El MFA del back-office debe implementarse antes del deploy a producción — es bloqueante.
- Los logs de auditoría deben ser inmutables (append-only): nunca permitir UPDATE/DELETE sobre la tabla de auditoría.
- Verificar el cumplimiento de Ley 25.326 en el flow de onboarding: el colaborador debe aceptar términos de tratamiento de datos al activar su cuenta.
- El pen test anual debe estar programado en el roadmap de cada año antes del deploy de versión mayor.
