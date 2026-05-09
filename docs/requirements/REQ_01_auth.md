# REQ_01 — Autenticación

**Estado:** ⏳ Pendiente  
**Módulo:** auth  
**Prioridad:** Alta

---

## Descripción

Sistema de autenticación basado en JWT. El usuario se registra con email y contraseña, inicia sesión y obtiene tokens de acceso y refresh.

---

## Requerimientos funcionales

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-01-01 | El usuario puede registrarse con email y contraseña | ⏳ |
| RF-01-02 | El usuario puede iniciar sesión y obtener access + refresh token | ⏳ |
| RF-01-03 | El access token expira en 24h; el refresh token en 30d | ⏳ |
| RF-01-04 | El usuario puede renovar su access token con el refresh token | ⏳ |
| RF-01-05 | El usuario puede cerrar sesión (invalidar refresh token) | ⏳ |

---

## Endpoints involucrados

Ver `docs/API_SPEC.md` → Sección Auth.

---

## Tablas involucradas

Ver `docs/DATA_MODEL.md` → Tabla `users`.

---

## Notas de implementación

- Nunca devolver info diferente si el email existe o no (previene enumeración de usuarios)
- Hash de contraseña con bcrypt (nunca MD5/SHA1)
- Refresh tokens se almacenan hasheados en DB
