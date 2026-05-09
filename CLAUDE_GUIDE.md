# CLAUDE_GUIDE.md — HRConnect

> **Propósito:** Memoria persistente del proyecto para Claude Code.
> Este archivo sobrevive la compactación de contexto. Es la fuente de verdad del estado actual.
> **Actualizar al inicio y al final de cada sesión de trabajo.**

---

## INSTRUCCIONES PARA CLAUDE (leer siempre primero)

Al iniciar cualquier sesión o detectar compactación de contexto:

1. Leer este archivo completo
2. Leer `git log --oneline -20` para entender los últimos cambios
3. Leer `git status` para ver qué hay en progreso
4. Si hay una tarea en curso en la sección **Estado actual**, continuarla desde ahí
5. Si hay dudas sobre arquitectura o contratos, leer `docs/API_SPEC.md` y `docs/DATA_MODEL.md`

**Regla de oro:** el sistema de archivos siempre tiene razón. Si tu memoria del chat contradice lo que ves en los archivos, confiá en los archivos.

**Prohibido:**
- Asumir que algo está implementado si no hay un commit que lo respalde
- Tomar decisiones de arquitectura sin actualizar este archivo
- Cambiar librerías core, schema de DB o mecanismo de auth sin registrarlo en **Decisiones técnicas**

---

## ESTADO ACTUAL

### Fase actual
```
[FASE 1] — Auth + Multi-tenant + Roles + Usuarios
Estado: EN CURSO
Última actualización: 2026-05-09
```

### En este momento estoy trabajando en
```
Nada — fases 1 y 2 completadas.
```

### Próximo paso concreto
```
Fase 3: WhatsApp Bot (FSM core + flujos recibos)
- Webhook handler: POST /whatsapp/webhook (verificación + mensajes entrantes)
- Session manager (estado de conversación por usuario en DB)
- Flujo de recibos: notificación HSM + VER + CONFIRMO
- Flujo de activación: link al portal
Nota: requiere configurar Meta Cloud API (webhook URL, access token, verify token)
```

### Bloqueantes activos
```
Ninguno
```

---

## PROGRESO DE FASES

| Fase | Descripción | Estado | Fecha |
|------|-------------|--------|-------|
| Fase 0 | Setup + documentación técnica base | ✅ Completada | 2026-05-09 |
| Fase 1 | Auth + Multi-tenant + Roles + Usuarios | ✅ Completada | 2026-05-09 |
| Fase 2 | Recibos de sueldo + Firma electrónica | ✅ Completada | 2026-05-09 |
| Fase 3 | WhatsApp Bot (FSM core + flujos recibos) | ⏳ Pendiente | — |
| Fase 4 | Licencias + Aprobación RRHH | ⏳ Pendiente | — |
| Fase 5 | Comunicaciones institucionales | ⏳ Pendiente | — |
| Fase 6 | Portal Web del colaborador | ⏳ Pendiente | — |
| Fase 7 | Servicio Médico | ⏳ Pendiente | — |
| Fase 8 | Reportes + Dashboard RRHH | ⏳ Pendiente | — |

---

## DECISIONES TÉCNICAS

### 2026-05-09 — Multi-tenant: shared database / shared schema
**Decisión:** Una sola base de datos PostgreSQL con `tenant_id` en cada tabla + RLS.
**Contexto:** HRConnect es SaaS multi-empresa. Necesita aislamiento de datos pero simplicidad operativa en v1.0.
**Razón:** Facilita queries cross-tenant para super_admin, menor overhead de infraestructura, escalable con particionado.
**Alternativas descartadas:** Schema por tenant (operaciones DDL complejas), DB por tenant (costo y complejidad de routing).
**Impacto:** Toda tabla de datos tiene `tenant_id`. El backend siempre filtra por `tenant_id` extraído del JWT.

### 2026-05-09 — WhatsApp como canal primario del colaborador
**Decisión:** El colaborador interactúa principalmente por WhatsApp Business API (Cloud API de Meta).
**Contexto:** Requerimiento de negocio central. El portal web es complementario, no reemplaza al bot.
**Razón:** Alta adopción de WhatsApp en Argentina. Cero fricción de instalación para el colaborador.
**Impacto:** Módulo `whatsapp/` con FSM de conversación, session manager, message queue (RabbitMQ/SQS en v1).

### 2026-05-09 — Firma electrónica probatoria (no Ley 25.506)
**Decisión:** La firma de recibos es probatoria: hash SHA-256 + timestamp UTC + sesión verificada. No firma digital con certificado.
**Contexto:** La firma digital certificada (Ley 25.506) está fuera de scope v1.0 por complejidad y costo.
**Razón:** La firma probatoria tiene valor legal suficiente para la mayoría de los casos. Escalable a firma digital en v1.1.
**Impacto:** Tabla `firmas_electronicas` con timestamp, hash, IP, session_id.

### 2026-05-09 — Datos médicos: encriptación AES-256 a nivel campo
**Decisión:** Los campos sensibles de `fichas_medicas` y `examenes_medicos` se encriptan con AES-256 en la aplicación antes de persistir.
**Contexto:** Ley 25.326 (protección de datos personales) exige tratamiento especial para datos de salud.
**Razón:** Encriptación a nivel campo garantiza que ni el DBA ni un acceso directo a la DB puede leer los datos sin la clave de la aplicación.
**Impacto:** `fichas_medicas.alergias_encrypted`, `condiciones_encrypted`, `examenes_medicos.resultado`. El módulo médico solo es accesible para el rol `servicio_medico`.

---

## DEUDA TÉCNICA

| ID | Descripción | Impacto | Prioridad | Agregado |
|----|-------------|---------|-----------|---------|
| DT-001 | Message queue (RabbitMQ/SQS) no implementada en v1 — envíos masivos serán síncronos inicialmente | Performance en envíos a >100 destinatarios | Alta | 2026-05-09 |
| DT-002 | MFA (TOTP) pendiente hasta antes de producción | Seguridad para roles admin/rrhh/médico | Alta | 2026-05-09 |
| DT-003 | Firma digital Ley 25.506 fuera de scope v1.0 | Legal — implementar en v1.1 | Media | 2026-05-09 |
| DT-004 | Reset de contraseña por email fuera de scope v1.0 | UX — flujo de recuperación manual | Baja | 2026-05-09 |

---

## PROBLEMAS CONOCIDOS

*Ninguno al inicio del proyecto.*

---

## CONTEXTO DE ARQUITECTURA RÁPIDO

### Stack
- **Backend:** FastAPI + Uvicorn (Python 3.12+)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind
- **Base de datos:** Supabase (PostgreSQL 15+) via `supabase-py` AsyncClient
- **Auth:** JWT con PyJWT — access token 8h (portal) / no expiry (bot sessions gestionadas por Redis)
- **WhatsApp:** Meta Cloud API (webhooks entrantes + API REST saliente)
- **Deploy:** Render (backend + frontend estáticos)

### Flujo principal — Onboarding colaborador
```
1. RRHH crea usuario → genera invite_token (hash en DB, plano por WA)
2. Bot envía link de activación por WhatsApp
3. Colaborador abre link → confirma nombre + CUIL (anti-suplantación)
4. Colaborador setea contraseña → estado = 'activo'
5. Desde ese momento: puede usar bot WA Y portal web
```

### Flujo principal — Recibo de sueldo
```
1. RRHH sube ZIP con PDFs → sistema parsea CUIL de cada archivo
2. Preview del mapeo → RRHH confirma → distribución en background
3. Bot notifica a cada colaborador (Template Message HSM)
4. Colaborador responde VER → bot envía PDF (signed URL 24h)
5. Colaborador responde CONFIRMO → firma registrada (hash + timestamp + sesión)
```

### Flujo principal — Licencia
```
1. Colaborador inicia flujo en bot → selecciona tipo → ingresa fechas
2. Bot muestra balance disponible → colaborador confirma
3. Solicitud en estado PENDIENTE → RRHH recibe notificación
4. RRHH aprueba/rechaza en back-office → notificación WhatsApp <30s
5. Si aprobada: saldo_licencias se actualiza automáticamente
```

### Módulos del backend
```
app/routers/
  auth.py          → POST /auth/login, /refresh, /logout, GET /auth/me
  tenants.py       → CRUD tenants (super_admin)
  users.py         → CRUD usuarios + invitaciones
  recibos.py       → Upload, distribución, firma
  comunicaciones.py → Creación, segmentación, envío
  licencias.py     → Solicitudes, aprobación, saldo
  medico.py        → Fichas, aptitudes, accidentes (acceso restringido)
  whatsapp.py      → Webhook entrante + mensajes salientes
```

### Variables de entorno requeridas
```
APP_ENV=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SECRET_KEY=
ALLOWED_ORIGINS=
ENCRYPTION_KEY=            # AES-256 para datos sensibles
META_VERIFY_TOKEN=         # Webhook verification de Meta
META_APP_SECRET=           # Para validar firma HMAC de webhooks
```

---

## LOG DE SESIONES

### 2026-05-09 — Sesión 1
**Duración aproximada:** 1 hora
**Objetivo de la sesión:** Setup inicial del proyecto

**Completado:**
- Estructura de carpetas completa (backend, frontend, tests, supabase, docs)
- Archivos base: main.py, config.py, exception_handlers.py, supabase.py, apiClient.ts
- Documentación: DATA_MODEL.md completo para HRConnect (30 tablas)
- CLAUDE.md y CLAUDE_GUIDE.md actualizados con datos reales del proyecto
- Eliminada carpeta `proyecto/` (template obsoleto)
- `.claude/settings.json` commiteado

**Commits realizados:**
- `921593d` — chore: add Claude Code permissions config

**Decisiones tomadas:** Ver sección Decisiones Técnicas (4 entradas)
**Deuda generada:** DT-001 (queue), DT-002 (MFA), DT-003 (firma digital), DT-004 (reset password)
**Quedó pendiente:** API_SPEC.md para HRConnect, setup entornos, primera migración
**Estado al cerrar:** Documentación de datos completa. Falta API_SPEC y entornos para empezar a codear.

### 2026-05-09 — Sesión 2
**Duración aproximada:** 2 horas
**Objetivo de la sesión:** Módulo auth completo

**Completado:**
- API_SPEC.md completo para HRConnect (todos los endpoints)
- Setup backend: venv Python 3.12, requirements.txt, estructura de carpetas
- Setup frontend: React 18 + TypeScript + Vite + Tailwind v4
- Migración inicial aplicada en Supabase remoto (tenants, sedes, depto, puestos, convenios, users, colaborador_perfil, invite_tokens, audit_log)
- Migración refresh_tokens aplicada en Supabase remoto
- Módulo auth completo:
  - `app/schemas/auth.py` — LoginRequest, ActivateRequest (con validadores), RefreshRequest, LogoutRequest
  - `app/schemas/user.py` — UserSummary (computed full_name), UserMe, TokenPair, LoginResponse, ActivateResponse, RefreshResponse
  - `app/repositories/user_repository.py` — get_by_email, get_by_id, get_by_id_with_profile, update_last_login, activate, get_by_cuil_and_tenant
  - `app/repositories/token_repository.py` — create/get/revoke refresh_token, get/use invite_token
  - `app/services/auth_service.py` — login, refresh, logout, activate, get_me
  - `app/dependencies/auth.py` — get_current_user, require_role
  - `app/routers/auth.py` — 5 endpoints registrados
  - `main.py` actualizado con auth router
  - Tests: 19/19 pasando (repositories, services, routers)

**Commits realizados:**
- Pendiente commitear módulo auth

**Quedó pendiente:** (nada — todo commiteado)
**Estado al cerrar:** Auth + usuarios implementados. 29 tests pasando. Próximo: Fase 2 recibos.

### 2026-05-09 — Sesión 3
**Duración aproximada:** 1.5 horas
**Objetivo de la sesión:** Fase 2 — Recibos de sueldo

**Completado:**
- Migración: periodos_liquidacion + recibos + firmas_electronicas + storage bucket `recibos` (privado)
- DB trigger `sync_recibos_firmados` mantiene contador desnormalizado automáticamente
- Módulo recibos completo (commit `5082ae2`):
  - `GET/POST /periodos` — lista y crea períodos de liquidación
  - `POST /periodos/{id}/upload` — sube ZIP o PDF, extrae CUIL de nombre de archivo, retorna preview
  - `POST /periodos/{id}/upload/{job_id}/confirm` — sube PDFs a Supabase Storage, crea registros en DB
  - `GET /periodos/{id}/recibos` — dashboard con estado de firma por colaborador
  - `POST /periodos/{id}/renotificar` — re-notifica no firmados (WhatsApp pendiente DT-006)
  - `GET /recibos` — recibos del colaborador autenticado
  - `GET /recibos/{id}` — recibo con signed URL (24h) + marca visto_at
  - `POST /recibos/{id}/firmar` — firma electrónica probatoria (hash SHA-256 + timestamp UTC + IP + session_id)
  - `GET /recibos/export` — CSV con estado de firmas por período
- python-multipart agregado a requirements
- 12 tests nuevos, 41 totales pasando

**Deuda generada:**
- DT-005: job store de upload en memoria (dict process-scoped) — debe reemplazarse con Redis o tabla DB
- DT-006: renotificar por WhatsApp pendiente de implementación del bot

**Estado al cerrar:** Fases 1 y 2 completas. Base sólida. Próximo: Fase 3 WhatsApp bot.

---

## COMANDOS ÚTILES DEL PROYECTO

```bash
# Backend
cd backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev

# Tests
cd backend && pytest
cd backend && pytest tests/routers/ -v

# Supabase
supabase start                          # levantar local
supabase migration new nombre           # nueva migración
supabase db reset                       # aplicar migraciones en local
supabase db push                        # aplicar en producción

# Deploy (manual)
git push origin main                    # Render detecta y redeploya
```

---

## CONTACTOS Y RECURSOS EXTERNOS

| Servicio | Propósito | URL / Referencia |
|----------|-----------|-----------------|
| Supabase | Base de datos + Auth | Dashboard en supabase.com |
| Meta for Developers | WhatsApp Cloud API | developers.facebook.com |
| Render | Deploy backend + frontend | dashboard.render.com |
