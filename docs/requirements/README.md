# HRConnect — Índice de Requerimientos

> **Documento base:** HRConnect_Analisis_Funcional_v1.0.docx | **Versión:** 1.0 | **Mayo 2026**

---

## Estado de módulos

| # | Archivo | Módulo | Prioridad | Estado |
|---|---------|--------|-----------|--------|
| 01 | [REQ_01_introduccion_alcance.md](REQ_01_introduccion_alcance.md) | Introducción y Alcance | Alta | ⏳ Pendiente |
| 02 | [REQ_02_multi_tenant.md](REQ_02_multi_tenant.md) | Arquitectura Multi-Tenant | Alta | ⏳ Pendiente |
| 03 | [REQ_03_roles_perfiles.md](REQ_03_roles_perfiles.md) | Roles y Perfiles de Usuario | Alta | ✅ Implementado |
| 04 | [REQ_04_gestion_empresas.md](REQ_04_gestion_empresas.md) | Gestión de Empresas | Alta | ⏳ Pendiente |
| 05 | [REQ_05_usuarios.md](REQ_05_usuarios.md) | Administración de Usuarios | Alta | 🔄 En curso |
| 06 | [REQ_06_recibos_sueldo.md](REQ_06_recibos_sueldo.md) | Recibos de Sueldo | Alta | ⏳ Pendiente |
| 07 | [REQ_07_comunicaciones.md](REQ_07_comunicaciones.md) | Comunicaciones Institucionales | Media | ⏳ Pendiente |
| 08 | [REQ_08_licencias.md](REQ_08_licencias.md) | Gestión de Licencias | Alta | 🔄 En curso |
| 09 | [REQ_09_servicio_medico.md](REQ_09_servicio_medico.md) | Servicio Médico | Media | ⏳ Pendiente |
| 10 | [REQ_10_whatsapp.md](REQ_10_whatsapp.md) | Integración WhatsApp Business API | Alta | ⏳ Pendiente |
| 11 | [REQ_11_portal_web.md](REQ_11_portal_web.md) | Portal Web del Colaborador | Alta | ⏳ Pendiente |
| 12 | [REQ_12_no_funcionales.md](REQ_12_no_funcionales.md) | Requerimientos No Funcionales | Alta | ⏳ Pendiente |
| 13 | [REQ_13_criterios_aceptacion.md](REQ_13_criterios_aceptacion.md) | Criterios de Aceptación | Alta | ⏳ Pendiente |

**Estados:** ✅ Completo · 🔄 En curso · ⏳ Pendiente · 🚫 Bloqueado

---

## Módulos fuera de alcance (v1.0)

| Funcionalidad | Planificación |
|--------------|---------------|
| Liquidación y cálculo de haberes (payroll) | Versión futura |
| Integración con asistencia biométrica | Versión futura |
| Módulo de capacitación y e-learning | Versión futura |
| Firma digital con certificado Ley 25.506 | Evaluación v1.1 |
| Reset de contraseña por email | Implementación v1.1 |
| GDPR / portabilidad de datos | Roadmap v2.0 |

---

## Dependencias entre módulos

```
REQ_02 (Multi-Tenant)
  └── REQ_03 (Roles y Perfiles)
        ├── REQ_04 (Gestión de Empresas)
        ├── REQ_05 (Usuarios) ──────────────────┐
        │     └── REQ_10 (WhatsApp Bot)         │
        ├── REQ_06 (Recibos) ◄── REQ_10         │
        ├── REQ_07 (Comunicaciones) ◄── REQ_10  │
        ├── REQ_08 (Licencias) ◄── REQ_10       │
        │     └── REQ_09 (Servicio Médico)      │
        └── REQ_11 (Portal Web) ◄───────────────┘
                                    (mismo backend)
```

---

## Convención de archivos

Un archivo por módulo funcional: `REQ_XX_[modulo].md`

Cada archivo contiene:
- Descripción del módulo
- Requerimientos funcionales con ID, descripción y estado
- Tablas de referencia (estados, catálogos, matrices)
- Tablas y endpoints involucrados
- Notas de implementación

---

*Generado a partir de: HRConnect_Analisis_Funcional_v1.0.docx*
