# REQ_01 — Introducción y Alcance

**Estado:** ⏳ Pendiente  
**Módulo:** introduccion_alcance  
**Prioridad:** Alta  
**Referencia AF:** Sección 1

---

## Descripción

HRConnect es una plataforma multiempresa de gestión de Recursos Humanos que reemplaza el canal de app móvil nativa por WhatsApp como canal principal de interacción con los colaboradores, aprovechando la alta penetración y familiaridad de esta herramienta de mensajería.

---

## 1.1 — Propósito del documento

- Definir el alcance funcional de la plataforma HRConnect en su versión 1.0.
- Especificar los módulos, roles, perfiles y flujos de interacción entre actores.
- Servir de contrato funcional entre los equipos de negocio, producto y desarrollo.
- Establecer la base para la estimación de esfuerzo y planificación de sprints.

---

## 1.2 — Capacidades principales de la plataforma (v1.0)

| Capacidad | Módulo de referencia |
|-----------|----------------------|
| Arquitectura multiempresa (multi-tenant) con aislamiento de datos | REQ_02 |
| Gestión de roles: Administrador, RR.HH., Servicio Médico y Colaborador | REQ_03 |
| Distribución y firma electrónica de recibos de sueldos | REQ_06 |
| Sistema de comunicaciones institucionales dirigidas | REQ_07 |
| Gestión integral del ciclo de vida de licencias y ausencias | REQ_08 |
| Panel de Servicio Médico: aptitudes, certificados y accidentes | REQ_09 |
| Canal WhatsApp Business API como canal de interacción del colaborador | REQ_10 |
| Portal web del colaborador (self-service) como canal complementario | REQ_11 |

---

## 1.3 — Fuera de alcance (v1.0)

> ⚠️ Las siguientes funcionalidades están **excluidas** de la versión 1.0.

| Funcionalidad | Planificación |
|--------------|---------------|
| Liquidación y cálculo de haberes (payroll processing) | Versión futura |
| Integración con sistemas de control de asistencia biométrica | Versión futura |
| Módulo de capacitación y e-learning | Versión futura |
| Firma digital con certificado de autoridad certificante (Ley 25.506) | Evaluación para v1.1 |
| Reset de contraseña por email (portal colaborador) | Implementación en v1.1 |
| GDPR / portabilidad de datos | Roadmap v2.0 |

---

## Notas de implementación

- Este archivo es el punto de entrada al sistema de requerimientos. Siempre leer junto a `README.md`.
- El documento base de referencia es: `HRConnect_Analisis_Funcional_v1.0.docx` (Mayo 2026).
- Cualquier cambio de alcance debe reflejarse en este archivo y en el README de requirements.
