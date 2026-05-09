# REQ_04 — Módulo de Gestión de Empresas

**Estado:** ⏳ Pendiente  
**Módulo:** gestion_empresas  
**Prioridad:** Alta  
**Referencia AF:** Sección 4.1  
**Actor principal:** Super Admin HRConnect / Administrador de Empresa

---

## Descripción

Módulo administrado por el Super Admin de HRConnect para gestionar el ciclo de vida de las empresas cliente. Incluye el alta, configuración del tenant, configuración del número WhatsApp Business y la estructura organizacional interna.

---

## Requerimientos funcionales

### 4.1.1 — Alta y configuración de empresa

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-04-01 | Registrar datos de la empresa: razón social, CUIT, domicilio fiscal, contacto principal | ⏳ |
| RF-04-02 | Configurar branding: logo, colores corporativos, nombre del bot WhatsApp | ⏳ |
| RF-04-03 | Seleccionar plan de suscripción al dar de alta la empresa | ⏳ |
| RF-04-04 | Generar automáticamente el subdominio `empresa.hrconnect.app` | ⏳ |
| RF-04-05 | Asignar y notificar al primer Administrador de Empresa al crear el tenant | ⏳ |

### 4.1.2 — Configuración de Número WhatsApp Business

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-04-06 | Vincular número de WhatsApp Business API al tenant | ⏳ |
| RF-04-07 | Validar y activar el canal mediante el proceso de Meta Business Verification | ⏳ |
| RF-04-08 | Configurar mensaje de bienvenida y menú de opciones del bot por empresa | ⏳ |
| RF-04-09 | Definir horarios de atención automática del bot | ⏳ |

### 4.1.3 — Estructura Organizacional

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-04-10 | CRUD de sedes/sucursales | ⏳ |
| RF-04-11 | CRUD de departamentos con soporte de jerarquía padre-hijo | ⏳ |
| RF-04-12 | CRUD de puestos/cargos con descripción | ⏳ |
| RF-04-13 | Importación masiva de estructura organizacional vía CSV o API | ⏳ |

---

## Tablas involucradas

Ver `docs/DATA_MODEL.md` → Tablas `tenants`, `sedes`, `departamentos`, `puestos`, `whatsapp_config`.

---

## Endpoints involucrados

Ver `docs/API_SPEC.md` → Sección Empresas / Tenants.

---

## Notas de implementación

- El subdominio debe generarse de forma sanitizada (sin caracteres especiales, en minúsculas).
- La configuración de WhatsApp Business debe ser reversible (poder desvincular y reconectar un número).
- La jerarquía de departamentos debe soportar al menos 3 niveles de profundidad.
- La importación CSV debe generar un reporte de errores por fila antes de confirmar la carga.
