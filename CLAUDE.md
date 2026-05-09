# HRConnect

> **Softlink** — Plataforma HR multi-empresa con canal WhatsApp como interfaz principal para colaboradores
> Stack: FastAPI + React 18 + Supabase PostgreSQL | Deploy: Render

---

## ⚡ Antes de implementar cualquier cosa

1. Leer el MD correspondiente en `docs/` (ver tabla en sección Documentación)
2. Verificar que el endpoint esté definido en `docs/API_SPEC.md`
3. Verificar que el schema esté en `docs/DATA_MODEL.md`
4. Si la tarea toca UI: leer `docs/DESIGN_SYSTEM.md` antes de escribir cualquier componente
5. Implementar con tests
6. Correr tests y confirmar que pasan
7. Actualizar `CLAUDE_GUIDE.md` con lo que se completó

**No cambiar arquitectura, librerías core, schema o mecanismo de auth sin preguntar primero.**

---

## Stack

| Capa       | Tecnología                                      |
|------------|-------------------------------------------------|
| Backend    | FastAPI + Uvicorn                               |
| Base de datos | Supabase (PostgreSQL) via `supabase-py` AsyncClient |
| Frontend   | React 18 + TypeScript + Vite + Tailwind         |
| Auth       | JWT con PyJWT                                   |
| Config     | pydantic-settings                               |
| Tests      | pytest + pytest-asyncio + pytest-mock           |
| Deploy     | Render (backend + frontend estáticos)           |

---

## Entorno de desarrollo

```bash
# Backend
cd backend && source .venv/bin/activate
uvicorn main:app --reload
# → http://localhost:8000/docs

# Frontend
cd frontend && npm run dev
# → http://localhost:5173

# Tests
cd backend && pytest              # todos
cd backend && pytest tests/routers/  # solo routers
```

Variables de entorno necesarias en `.env` del backend:
```
APP_ENV=development
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SECRET_KEY=dev-secret-key
ALLOWED_ORIGINS=http://localhost:5173
# [agregar variables específicas del proyecto]
```

---

## Estructura de carpetas

```
[proyecto]/                          # Raíz del repositorio
│
├── CLAUDE.md                        # ← Claude lo lee automático al iniciar sesión
├── CLAUDE_GUIDE.md                  # Estado vivo del proyecto (fases, decisiones, log)
│
├── .claude/
│   └── settings.json                # Permisos de Claude Code — herramientas sin confirmación
│
├── docs/                            # Documentación técnica — leer antes de implementar
│   ├── API_SPEC.md                  # Contratos de endpoints (request/response)
│   ├── DATA_MODEL.md                # Tablas, columnas, relaciones, índices
│   ├── DESIGN_SYSTEM.md             # Tokens de color, componentes, UX patterns
│   ├── ARCHITECTURE.md              # Flujo general del sistema
│   └── requirements/                # Requerimientos por módulo
│       ├── README.md                # Índice y estado de todos los requerimientos
│       ├── REQ_01_auth.md           # Requerimientos de autenticación
│       └── REQ_XX_[modulo].md       # Un archivo por módulo funcional
│
├── backend/                         # API FastAPI
│   ├── .env                         # ← NO commitear (está en .gitignore)
│   ├── .env.example                 # Variables requeridas sin valores — sí commitear
│   ├── main.py                      # Entry point — registra routers y handlers
│   └── app/
│       ├── core/
│       │   ├── config.py            # Settings con pydantic-settings
│       │   └── exception_handlers.py# Handlers globales de errores
│       ├── db/
│       │   └── supabase.py          # AsyncClient singleton
│       ├── dependencies/            # Factory functions para inyección de dependencias
│       ├── schemas/                 # Pydantic schemas — request y response
│       ├── repositories/            # Acceso a datos — única capa con AsyncClient
│       ├── services/                # Lógica de negocio — orquesta repositorios
│       └── routers/                 # Endpoints FastAPI — delegan a services
│
├── supabase/
│   └── migrations/                  # Historial completo del schema — Supabase CLI
│
├── tests/                           # Tests del backend
│   ├── conftest.py                  # Fixtures globales
│   ├── routers/
│   ├── services/
│   └── repositories/
│
└── frontend/                        # App React
    ├── .env                         # ← NO commitear
    ├── .env.example                 # Variables VITE_ requeridas sin valores
    └── src/
        ├── lib/
        │   └── apiClient.ts         # Cliente base con interceptores (401, 403, red)
        ├── services/                # Llamadas a API — nunca desde componentes
        ├── components/              # Componentes reutilizables
        └── pages/                   # Páginas — una por ruta principal
```

---

## Reglas de código — Backend

### 1. Siempre `async def`
Toda función en routers, services y repositories es asíncrona.
Si una librería no soporta async (ej: `requests`), reemplazarla por su equivalente (`httpx`).

### 2. Config centralizada con pydantic-settings

```python
# ✅ Correcto
from app.core.config import get_settings
settings: Settings = Depends(get_settings)

# ❌ Prohibido
import os
url = os.environ["SUPABASE_URL"]
```

### 3. Pydantic schemas en todo request/response
Nunca `dict` crudo. Schemas en `app/schemas/`. Un schema nunca se usa como modelo de DB ni al revés.
Los contratos de request/response (campos, tipos, validaciones) están definidos en `docs/API_SPEC.md` — implementar exactamente lo que dice, sin agregar ni quitar campos.

### 4. HTTP status codes correctos

| Situación              | Código |
|------------------------|--------|
| No encontrado          | `404`  |
| No autenticado         | `401`  |
| Sin permisos           | `403`  |
| Conflicto (duplicado)  | `409`  |
| Datos inválidos        | `422`  |
| Creación exitosa       | `201`  |
| Error interno          | `500`  |

### 5. Exception handler global
Registrado en `main.py`. Nunca exponer stack traces al cliente. Loguear internamente, responder genérico.

### 6. Supabase — AsyncClient + patrón repositorio

- Usar siempre `AsyncClient` de `supabase._async.client` — el cliente sync bloquea el event loop
- Cada entidad tiene su clase repositorio en `app/repositories/`
- El repositorio recibe el cliente en `__init__` y expone métodos async
- Validar `response.data` antes de usarlo — nunca asumir que viene data
- `SUPABASE_SERVICE_ROLE_KEY` solo en backend, nunca en variables `VITE_`

### 7. Migraciones con Supabase CLI

```bash
supabase migration new nombre_descriptivo
supabase db reset        # iterar en local
supabase db push         # aplicar en producción
```

Toda tabla nueva debe tener RLS habilitado desde la migración:
```sql
alter table mi_tabla enable row level security;
```

---

## Reglas de código — Frontend

### TypeScript estricto — prohibido `any`
`tsconfig.json` con `"strict": true`. Si el tipo es genuinamente desconocido: usar `unknown` + type guard.

### Llamadas a API solo desde `src/services/`
Los componentes nunca llaman APIs directamente.
El cliente base con interceptores va en `src/lib/apiClient.ts` (maneja 401, 403, errores de red).

### Siempre loading + error + data
Ningún componente con fetch puede quedar sin estado de carga y sin error visible.
Los tres estados siempre presentes: `loading` / `error` / `data`.

### Design System y UX
Para cualquier tarea de UI, leer primero: `docs/DESIGN_SYSTEM.md`

Cubre: tokens de color, tipografía, componentes base, patrones de layout, estados (loading/error/empty), accesibilidad y responsive breakpoints.

---

## Git y GitHub

- Repositorio: `https://github.com/gnajera-spec/numi`
- Branch principal: `main` — **nunca pushear directo**
- Flujo obligatorio: `feature branch → PR → merge`

Naming de branches:
```
feat/descripcion-corta
fix/descripcion-corta
refactor/descripcion-corta
chore/descripcion-corta
```

Antes de abrir un PR: correr tests, confirmar que el build pasa, y verificar que no hay archivos `.env` ni secrets en el diff.

---

## Reglas generales

- **Nunca commitear `.env`** — si se commitea un secret, rotarlo inmediatamente
- **Commits semánticos en inglés:** `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`, `perf:`
- Un commit por unidad de trabajo — no mezclar features con fixes

---

## Tests — Convenciones

Nombre: `test_<qué_hace>_<condición>_<resultado_esperado>`
Patrón: **Arrange / Act / Assert** siempre

| Capa        | Qué mockear                                      |
|-------------|--------------------------------------------------|
| Routers     | Repos via `dependency_overrides`                 |
| Services    | Repositorios                                     |
| Repositories | Supabase client con `AsyncMock`                 |

Unit tests **nunca tocan la DB real**.

---

## Documentación del proyecto

Leer ANTES de implementar:

| Archivo                          | Contenido                                        |
|----------------------------------|--------------------------------------------------|
| `docs/requirements/README.md`    | Índice de requerimientos y estado actual         |
| `docs/requirements/REQ_XX_*.md`  | Requerimientos del módulo en el que estás        |
| `docs/ARCHITECTURE.md`           | Estructura y flujo general                       |
| `docs/DATA_MODEL.md`             | Tablas, columnas, relaciones                     |
| `docs/API_SPEC.md`               | Endpoints, request/response                      |
| `docs/IMPLEMENTATION.md`         | Fases y checklist de tareas                      |
| `CLAUDE_GUIDE.md`                | Estado actual del proyecto y próximos pasos      |
| `docs/DESIGN_SYSTEM.md`         | Design tokens, componentes, UX patterns (leer para trabajo de UI) |

---

## Deploy

- **No hay CI/CD** — el deploy es manual via `git push origin main`
- Render detecta el push a `main` y redeploya automáticamente backend y frontend
- Verificar que el deploy fue exitoso en el dashboard de Render antes de cerrar la tarea
- **No hay Docker** — Render corre el proceso directamente con el `Procfile` o comando de start
- Variables de entorno de producción se configuran en Render, nunca en el repo
