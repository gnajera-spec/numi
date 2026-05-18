# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Softlink — HRConnect:** Plataforma HR multi-empresa con canal WhatsApp como interfaz principal para colaboradores.
> Stack: FastAPI + React 18 + Supabase PostgreSQL | Deploy: Render

---

## Antes de implementar cualquier cosa

1. Leer `CLAUDE_GUIDE.md` — estado actual del proyecto, decisiones y próximos pasos
2. Verificar que el endpoint esté en `docs/API_SPEC.md` y el schema en `docs/DATA_MODEL.md`
3. Para UI: leer `docs/DESIGN_SYSTEM.md` antes de escribir cualquier componente
4. Implementar con tests; correr tests y confirmar que pasan
5. Actualizar `CLAUDE_GUIDE.md` al cerrar la sesión

**No cambiar arquitectura, librerías core, schema o mecanismo de auth sin preguntar primero.**

---

## Comandos de desarrollo

```bash
# Backend
cd backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000
# Nota: uvicorn --reload NO detecta cambios en .env — reiniciar manualmente si se cambia .env

# Frontend (el servidor corre desde /frontend en el proyecto principal, no desde worktrees)
cd frontend && npm run dev          # dev server → http://localhost:5580
npm run build                       # tsc -b && vite build
npm run lint                        # ESLint
node_modules/.bin/tsc --noEmit     # solo chequeo de tipos (no hay tsc global)
```

```bash
# Tests — backend
cd backend && pytest                                                        # todos
cd backend && pytest tests/routers/                                        # solo routers
cd backend && pytest tests/services/test_auth_service.py                   # un archivo
cd backend && pytest tests/services/test_auth_service.py::test_login_ok   # un test específico
cd backend && pytest -v --tb=short                                         # verbose + traceback corto
```

```bash
# Supabase CLI
supabase migration new nombre_descriptivo   # nueva migración
supabase db reset                           # aplicar migraciones en local
supabase db push                            # aplicar en producción
```

---

## Variables de entorno — backend (`backend/.env`)

```
APP_ENV=development
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SECRET_KEY=                   # mín. 32 chars — firma JWTs (HS256)
ENCRYPTION_KEY=               # 64 hex chars (32 bytes AES-256) — datos médicos + WA access_token
ALLOWED_ORIGINS=["http://localhost:5173","http://localhost:5580"]
META_VERIFY_TOKEN=            # token para verificar webhook GET /whatsapp/webhook
META_APP_SECRET=              # App Secret de Meta para validar firma HMAC-SHA256 de webhooks
```

---

## Arquitectura general

### Capas backend (orden estricto: router → service → repository → DB)

```
routers/     Endpoints FastAPI. Solo validan entrada, delegan a services, retornan schemas.
services/    Lógica de negocio. Orquestan múltiples repositories. No tocan DB directamente.
repositories/ Única capa con AsyncClient. Un archivo por entidad de DB.
schemas/     Pydantic — request y response. Nunca usados como modelos de DB.
```

**Patrón factory en routers** — cada router define una función privada que construye el servicio con sus repos inyectados:

```python
def _svc(db: AsyncClient = Depends(get_supabase)) -> AuthService:
    return AuthService(UserRepository(db), TokenRepository(db))

@router.post("/login")
async def login(data: LoginRequest, svc: AuthService = Depends(_svc)):
    return await svc.login(data)
```

### Auth y JWT

- Tokens HS256 firmados con `SECRET_KEY`. Access: 8h. Refresh: 30d. MFA token: 5 min.
- **El rol viene del JWT, no de la DB.** En `get_current_user` el campo `role` del JWT sobreescribe el de la DB (`user["role"] = payload["role"]`). Esto permite `switch_role` sin mutar la DB.
- Refresh tokens: el valor plano nunca se almacena — solo su hash SHA-256.
- `require_role(*roles)` depende de `get_current_user`; FastAPI encadena automáticamente.

### Supabase AsyncClient

```python
# app/db/supabase.py — singleton global
async def get_supabase() -> AsyncClient:
    global _client
    if _client is None:
        _client = await create_client(url, key)
    return _client
```

- Siempre `AsyncClient` de `supabase._async.client` — el sync bloquea el event loop.
- Siempre validar `response.data` antes de usarlo; nunca asumir que hay datos.
- `SUPABASE_SERVICE_ROLE_KEY` solo en backend, nunca en variables `VITE_`.

### Multi-tenant

- Toda tabla de datos tiene `tenant_id`. El backend **siempre** lo extrae del JWT, nunca del body o query.
- RLS habilitado en toda tabla nueva: `alter table mi_tabla enable row level security;`

### Frontend — routing y roles

Dos aplicaciones separadas con guards propios:

| Path prefix | Guard | Roles permitidos |
|---|---|---|
| `/employee/*` | `ProtectedRoute` | cualquier usuario autenticado |
| `/admin/*` | `AdminProtectedRoute` | `rrhh`, `admin_empresa`, `super_admin`, `servicio_medico` |
| `/superadmin/*` | propio | `super_admin` |

El sidebar de `AdminLayout` adapta los ítems visibles por rol:
- `rrhh` → menú operativo completo
- `admin_empresa` → Usuarios + Organización + Configuración
- `super_admin` → todo + médico + configuración
- `servicio_medico` → solo fichas / accidentes / reportes médicos

Las llamadas a la API van **solo** desde `src/services/`. Los componentes nunca hacen fetch directamente. `src/lib/apiClient.ts` maneja 401 redirigiendo a `/admin/login` o `/employee/login` según el path activo.

---

## Reglas de código

### Backend

- Toda función en routers, services y repositories es `async def`.
- Config solo vía pydantic-settings: `from app.core.config import get_settings` + `Depends(get_settings)`. Prohibido `os.environ`.
- HTTP status codes: 201 creación, 401 no autenticado, 403 sin permisos, 404 no encontrado, 409 conflicto, 422 datos inválidos.
- El exception handler global en `main.py` nunca expone stack traces al cliente.

### Tests

Nombre: `test_<qué_hace>_<condición>_<resultado_esperado>`  
Patrón: Arrange / Act / Assert  
**pytest-asyncio mode: STRICT** — todos los tests async requieren `@pytest.mark.asyncio`  
UUIDs en fixtures: usar formato real (`"00000000-0000-0000-0000-000000000001"`), no strings arbitrarios.

| Capa | Qué mockear |
|---|---|
| Routers | Repos via `app.dependency_overrides` |
| Services | Repositorios (inyectados en `__init__`) |
| Repositories | Supabase client con `AsyncMock` |

### Frontend

- TypeScript estricto (`"strict": true`). Prohibido `any`; usar `unknown` + type guard si necesario.
- Todo componente con fetch expone los tres estados: `loading` / `error` / `data`.
- Para UI, leer `docs/DESIGN_SYSTEM.md` — define tokens CSS (`var(--color-*)`, `var(--shadow-*)`), componentes base y patrones de layout.

---

## Git

- Repo: `https://github.com/gnajera-spec/numi` | Branch principal: `main` — nunca pushear directo
- Flujo: `feature branch → PR → merge`
- Naming: `feat/`, `fix/`, `refactor/`, `chore/`
- Commits semánticos en inglés: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`, `perf:`
- Antes de PR: correr tests + confirmar build + verificar que no hay `.env` ni secrets en el diff

---

## Deploy

- Sin CI/CD — deploy manual: `git push origin main` → Render redeploya backend y frontend automáticamente
- Sin Docker — Render corre el proceso directo con `Procfile` o comando de start
- Variables de entorno de producción: solo en Render, nunca en el repo

---

## Documentación técnica

| Archivo | Contenido |
|---|---|
| `CLAUDE_GUIDE.md` | Estado actual, decisiones técnicas, log de sesiones |
| `docs/API_SPEC.md` | Contratos de endpoints (request / response) |
| `docs/DATA_MODEL.md` | Tablas, columnas, relaciones, índices |
| `docs/DESIGN_SYSTEM.md` | Tokens de color, tipografía, componentes, UX patterns |
| `docs/ARCHITECTURE.md` | Flujo general del sistema |
| `docs/requirements/` | Requerimientos por módulo |
