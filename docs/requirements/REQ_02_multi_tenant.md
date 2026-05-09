# REQ_02 — Arquitectura Multiempresa (Multi-Tenant)

**Estado:** ⏳ Pendiente  
**Módulo:** multi_tenant  
**Prioridad:** Alta  
**Referencia AF:** Sección 2

---

## Descripción

HRConnect opera bajo un modelo multi-tenant donde cada empresa cliente es un tenant aislado dentro de la misma infraestructura. Se usa el patrón *shared database / shared schema* con columna `tenant_id` y row-level security en base de datos.

---

## Requerimientos funcionales

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-02-01 | Cada registro de la base de datos incluye `tenant_id` como discriminador | ⏳ |
| RF-02-02 | Row-level security (RLS) habilitado en todas las tablas para garantizar aislamiento entre tenants | ⏳ |
| RF-02-03 | Cada empresa tiene un subdominio propio: `empresa.hrconnect.app` | ⏳ |
| RF-02-04 | Cada empresa puede configurar logo, colores corporativos y plantillas WhatsApp de forma independiente | ⏳ |
| RF-02-05 | El ciclo de vida del tenant incluye: Alta → Configuración inicial → Operación → Baja | ⏳ |
| RF-02-06 | La baja de un tenant incluye exportación de datos y eliminación tras el período contractual | ⏳ |
| RF-02-07 | Las entidades maestras del tenant son: Empresa, Sede, Departamento, Puesto, Convenio Colectivo, Política de Licencias | ⏳ |
| RF-02-08 | El plan de facturación se determina por cantidad de colaboradores activos por empresa | ⏳ |

---

## Entidades maestras del tenant

| Entidad | Descripción |
|---------|-------------|
| Empresa (Tenant) | Organización cliente. Unidad raíz de todo el modelo de datos. |
| Sucursal / Sede | Unidad geográfica o funcional dentro de una empresa. Opcional. |
| Departamento | Área funcional (Ventas, TI, Operaciones, etc.). |
| Puesto / Cargo | Rol ocupacional del colaborador dentro de la empresa. |
| Convenio Colectivo | Marco normativo que rige las condiciones de trabajo del colaborador. |
| Política de Licencias | Reglas que determinan tipos, cantidades y aprobación de licencias. |

---

## Tablas involucradas

Ver `docs/DATA_MODEL.md` → Tablas `tenants`, `sedes`, `departamentos`, `puestos`, `convenios`, `politicas_licencias`.

---

## Notas de implementación

- Toda consulta a Supabase debe filtrar por `tenant_id` en el repositorio — nunca asumir que RLS es suficiente sin validar en capa de servicio.
- El `tenant_id` debe propagarse desde el JWT del usuario autenticado, no desde parámetros de la request.
- Al crear un tenant nuevo, el sistema debe aprovisionar automáticamente las políticas de licencias por defecto según convenio seleccionado.
