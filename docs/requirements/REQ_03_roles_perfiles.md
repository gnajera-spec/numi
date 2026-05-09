# REQ_03 — Modelo de Roles y Perfiles de Usuario

**Estado:** ⏳ Pendiente  
**Módulo:** roles_perfiles  
**Prioridad:** Alta  
**Referencia AF:** Sección 3

---

## Descripción

La plataforma define un modelo jerárquico de roles que determina permisos, visibilidad de datos y acciones disponibles para cada tipo de usuario dentro de un tenant. Todo usuario invitado es por defecto Colaborador; el Administrador puede elevar el perfil de forma explícita.

---

## Jerarquía de roles

| Nivel | Rol | Contexto | Descripción |
|-------|-----|----------|-------------|
| 0 | Super Admin HRConnect | Plataforma global | Gestiona tenants y planes. No accede a datos de colaboradores. |
| 1 | Administrador de Empresa | Tenant específico | Máxima autoridad dentro de su empresa. |
| 2 | RR.HH. | Tenant específico | Gestiona nómina, recibos, licencias y comunicaciones. |
| 2 | Servicio Médico | Tenant específico | Gestiona historial médico-laboral y aptitudes. |
| 3 | Colaborador | Tenant específico | Rol base. Interactúa vía WhatsApp y/o portal web. |

---

## Requerimientos funcionales

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-03-01 | El rol base asignado al crear un usuario es Colaborador | ⏳ |
| RF-03-02 | El Administrador puede elevar o revocar el perfil RR.HH. o Servicio Médico de cualquier colaborador | ⏳ |
| RF-03-03 | Un Administrador no puede ver datos de tenants distintos al propio | ⏳ |
| RF-03-04 | No puede existir un tenant sin al menos un Administrador activo | ⏳ |
| RF-03-05 | El Administrador no puede eliminarse a sí mismo del sistema | ⏳ |
| RF-03-06 | RR.HH. no accede al historial médico de los colaboradores | ⏳ |
| RF-03-07 | RR.HH. no puede modificar configuración del tenant ni gestionar integraciones | ⏳ |
| RF-03-08 | Servicio Médico no accede a información salarial | ⏳ |
| RF-03-09 | Servicio Médico no puede emitir comunicaciones institucionales generales | ⏳ |
| RF-03-10 | La información médica es visible únicamente para Servicio Médico y el propio colaborador | ⏳ |
| RF-03-11 | El Colaborador solo tiene visibilidad de su propia información | ⏳ |
| RF-03-12 | El Colaborador no puede acceder al back-office web | ⏳ |

---

## Matriz de permisos

| Funcionalidad | Admin | RR.HH. | Serv. Médico | Colaborador |
|---------------|-------|--------|--------------|-------------|
| Configurar empresa y tenant | ✅ | ❌ | ❌ | ❌ |
| Gestionar usuarios y perfiles | ✅ | ❌ | ❌ | ❌ |
| Cargar recibos de sueldo | ✅ | ✅ | ❌ | ❌ |
| Ver recibos | ❌ | ✅ (todos) | ❌ | ✅ (solo propios) |
| Firmar recibos | ❌ | ❌ | ❌ | ✅ |
| Crear comunicaciones | ✅ | ✅ | ❌ | ❌ |
| Recibir comunicaciones | ❌ | ❌ | ❌ | ✅ |
| Gestionar licencias (flujo completo) | ✅ | ✅ | Parcial (enf.) | Solo solicitar |
| Ver ficha médica | ❌ | ❌ | ✅ (todos) | ✅ (solo propia) |
| Emitir aptitud laboral | ❌ | ❌ | ✅ | ❌ |
| Reportes y métricas | ✅ | ✅ | ✅ (médicos) | ❌ |
| Interactuar vía WhatsApp | ❌ | ❌ | ❌ | ✅ |

---

## Tablas involucradas

Ver `docs/DATA_MODEL.md` → Tabla `users`, `roles`, `user_roles`.

---

## Endpoints involucrados

Ver `docs/API_SPEC.md` → Sección Roles y Permisos.

---

## Notas de implementación

- El control de acceso debe validarse en la capa de servicio (no solo en el router).
- Usar middleware de autorización que lea el rol del JWT y lo compare contra la política requerida por el endpoint.
- La separación entre datos médicos y datos de RR.HH. debe estar reforzada con RLS en Supabase además de la lógica de negocio.
