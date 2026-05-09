# ARCHITECTURE.md

> **Proyecto:** [Nombre del proyecto]
> **Versión:** 1.0 | **Fecha:** [YYYY-MM-DD]

---

## Flujo general del sistema

```
1. Usuario se autentica → POST /auth/login → recibe JWT (24h) + refresh token (30d)
2. Frontend adjunta Bearer token en cada request vía apiClient.ts
3. Backend valida JWT en dependencia → extrae user_id
4. Router delega a Service → Service orquesta Repository → Repository consulta Supabase
5. Respuesta tipada con Pydantic schema → JSON al cliente
```

---

## Capas y responsabilidades

| Capa | Archivo(s) | Responsabilidad |
|------|-----------|-----------------|
| Router | `app/routers/*.py` | Recibe HTTP, valida auth, delega a Service, devuelve respuesta |
| Service | `app/services/*.py` | Lógica de negocio, orquesta repositorios |
| Repository | `app/repositories/*.py` | Única capa que toca Supabase AsyncClient |
| Schema | `app/schemas/*.py` | Contratos de request/response Pydantic |
| Dependency | `app/dependencies/*.py` | Factory functions: get_current_user, get_supabase, etc. |

---

## Decisiones de arquitectura

### Auth — JWT con PyJWT
- Access token: 24h, firmado con `SECRET_KEY`
- Refresh token: 30d
- Nunca devolver info diferente según si el usuario existe (previene enumeración)

### Base de datos — Supabase AsyncClient
- Siempre `AsyncClient` (nunca sync — bloquea el event loop)
- `SUPABASE_SERVICE_ROLE_KEY` solo en backend, nunca expuesto al frontend
- RLS habilitado en todas las tablas desde la migración inicial

### Frontend — fetch nativo vía apiClient
- Un solo punto de entrada: `src/lib/apiClient.ts`
- 401 → limpia token y redirige a `/login`
- Componentes nunca llaman APIs directamente
