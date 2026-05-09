# DESIGN_SYSTEM.md

> Documento de referencia de UI/UX para Claude.
> Leer completo antes de construir cualquier componente de frontend.
> Actualizar este archivo cuando se defina o cambie la identidad visual del proyecto.

---

## 1. Principios de diseño

- **Claridad funcional:** cada pantalla tiene una acción principal obvia. El ruido visual es mínimo.
- **Densidad controlada:** la información se agrupa en cards, no se muestra en tablas densas sin estructura.
- **Estado siempre visible:** el usuario siempre sabe dónde está (sidebar), qué está seleccionado (borde activo) y si hay datos o no (empty state).
- **Color con significado:** el color nunca es decorativo — siempre comunica estado (confirmado, presente, ausente, pendiente).

---

## 2. Paleta de colores

### Colores de marca

| Token                | Valor hex   | Uso                                              |
|----------------------|-------------|--------------------------------------------------|
| `color-primary`      | `#4BA3D9`   | Botones CTA, íconos activos, borde card selected |
| `color-primary-light`| `#EBF5FB`   | Fondo sidebar item activo, fondo card selected   |
| `color-primary-dark` | `#2E86C1`   | Hover de botón primario                          |

### Colores de estado

| Token               | Valor hex   | Uso                                |
|---------------------|-------------|------------------------------------|
| `color-confirmed`   | `#2E86C1`   | Confirmados — número + ícono       |
| `color-present`     | `#27AE60`   | Presentes — número + ícono         |
| `color-absent`      | `#E74C3C`   | Ausentes — número + ícono          |
| `color-pending`     | `#F39C12`   | Pendientes — número + ícono        |
| `color-neutral`     | `#7F8C8D`   | Total / neutro — número + ícono    |

### Colores de UI base

| Token                  | Valor hex   | Uso                                        |
|------------------------|-------------|--------------------------------------------|
| `color-bg-app`         | `#F4F6F8`   | Fondo general de la app                    |
| `color-bg-surface`     | `#FFFFFF`   | Cards, sidebar, header                     |
| `color-bg-empty`       | `#F8F9FA`   | Fondo de empty states                      |
| `color-border`         | `#E8ECF0`   | Bordes de cards, divisores                 |
| `color-border-active`  | `#4BA3D9`   | Borde de card o item seleccionado          |
| `color-text-primary`   | `#1A2332`   | Títulos, labels principales                |
| `color-text-secondary` | `#6B7A8D`   | Subtítulos, labels secundarios, metadata   |
| `color-text-disabled`  | `#B0BEC5`   | Texto deshabilitado, empty state icon      |

---

## 3. Tipografía

Fuente principal: **Inter** (sans-serif). Fallback: `system-ui, -apple-system, sans-serif`.

| Rol                  | Tamaño | Peso       | Color                  | Uso                              |
|----------------------|--------|------------|------------------------|----------------------------------|
| Page title           | 22px   | 700 (Bold) | `color-text-primary`   | "Tablero", "Presentismo"         |
| Section title        | 16px   | 600        | `color-text-primary`   | "Turnos de hoy — Sábado..."      |
| KPI number           | 28px   | 700        | Color de estado        | Los números grandes en las cards |
| KPI label            | 12px   | 400        | `color-text-secondary` | "Total hoy", "Confirmados"       |
| Nav item             | 14px   | 400 / 600  | `color-text-primary`   | Normal / activo en sidebar       |
| Body text            | 14px   | 400        | `color-text-primary`   | Contenido general                |
| Caption / metadata   | 12px   | 400        | `color-text-secondary` | Subtítulos de empty state, hints |
| Button label         | 14px   | 600        | Según variante         | CTAs                             |

---

## 4. Espaciado y layout

Unidad base: **8px**. Todo el espaciado es múltiplo de 4 u 8.

| Token         | Valor | Uso típico                                  |
|---------------|-------|---------------------------------------------|
| `space-xs`    | 4px   | Gap entre ícono y texto inline              |
| `space-sm`    | 8px   | Padding interno pequeño, gap entre badges   |
| `space-md`    | 16px  | Padding de cards, gap entre elementos       |
| `space-lg`    | 24px  | Padding de secciones, gap entre cards       |
| `space-xl`    | 32px  | Separación entre secciones principales      |

### Layout general

```
┌──────────────────────────────────────────────────────────┐
│  Header (fixed, 64px)                                    │
├───────────────┬──────────────────────────────────────────┤
│               │                                          │
│  Sidebar      │  Content area                            │
│  (240px)      │  padding: 24px                           │
│  fixed        │  max-width: sin límite                   │
│               │                                          │
│               │                                          │
└───────────────┴──────────────────────────────────────────┘
```

- **Sidebar:** 240px fijo, fondo blanco, borde derecho `color-border`
- **Header:** 64px fijo, fondo blanco, borde inferior `color-border`, z-index sobre contenido
- **Content area:** padding `24px`, scroll vertical, fondo `color-bg-app`

---

## 5. Componentes

### 5.1 Sidebar

```
Estado normal:
  - Fondo ítem: transparente
  - Texto: color-text-primary, 14px, weight 400
  - Ícono: color-text-secondary

Estado activo (página actual):
  - Fondo ítem: color-primary-light (#EBF5FB)
  - Texto: color-primary, weight 600
  - Ícono: color-primary
  - Sin borde lateral — el fondo es suficiente indicador

Logo/marca:
  - Parte superior, separado del nav por 16px
  - Subtítulo con el nombre del módulo o sistema en color-text-secondary, 11px

Usuario (footer):
  - Avatar circular con iniciales, color-primary background
  - Nombre + rol en dos líneas
  - Ícono de logout al extremo derecho
```

### 5.2 Header

```
- Fondo blanco, altura 64px
- Izquierda: ícono hamburger + título de sección + subtítulo contextual (módulo, sede, etc.)
- Derecha: ícono campana + avatar de usuario
- Borde inferior: 1px solid color-border
```

### 5.3 KPI Card

Componente central para métricas. Siempre en grilla horizontal de 4.

```
Estructura:
┌─────────────────────────┐
│  [ícono]   [número]     │  ← número en color de estado, 28px bold
│            [label]      │  ← label en color-text-secondary, 12px
└─────────────────────────┘

Estados visuales:
- Default:   fondo blanco, borde color-border, sin sombra prominente
- Selected:  fondo color-primary-light, borde 2px color-primary
- Hover:     leve sombra (box-shadow: 0 2px 8px rgba(0,0,0,0.08))

Íconos por estado:
- Total:        ícono lista/calendario, color neutral (#7F8C8D)
- Confirmados:  ícono check circle, color-confirmed
- Presentes:    ícono persona+, color-present
- Ausentes:     ícono campana tachada, color-absent
- Pendientes:   ícono reloj, color-pending

Reglas:
- Siempre 4 cards en la misma fila (responsive: 2x2 en mobile)
- Nunca mezclar íconos de distintas familias en el mismo set
- El número SIEMPRE tiene el color del estado, nunca gris
```

### 5.4 Empty State

Patrón para cuando no hay datos que mostrar.

```
Estructura (centrada verticalmente en el contenedor):
  [Ícono grande ~48px, color-text-disabled]
  [Título, 16px, weight 600, color-text-primary]
  [Subtítulo, 14px, color-text-secondary, max 2 líneas]
  [CTAs opcionales — solo si hay acción clara]

Variantes:
  - Sin datos + sin acción: solo ícono + título + subtítulo
  - Sin datos + con acción: agrega 1-2 botones debajo del subtítulo

Íconos según contexto (ejemplos — adaptar al dominio del proyecto):
  - Sin resultados de búsqueda: lupa con X
  - Sin registros en lista:     ícono lista vacía
  - Sin elemento principal:     ícono representativo de la entidad
  - Error de carga:             ícono nube con X o triángulo de advertencia

Reglas:
  - Fondo: color-bg-empty con borde color-border y border-radius 8px
  - Mínimo 200px de altura para que no se vea apretado
  - El ícono NUNCA lleva color de estado — siempre color-text-disabled
  - Los CTAs del empty state son secundarios (outlined), nunca primarios sólidos
    excepto la acción principal ("Nuevo turno" es la excepción por su importancia)
```

### 5.5 Botones

```
Primario (CTA principal):
  background: color-primary (#4BA3D9)
  color: #FFFFFF
  border-radius: 8px
  padding: 10px 20px
  font: 14px, weight 600
  hover: color-primary-dark (#2E86C1)
  Uso: "Nuevo Turno", "Guardar", acción principal de la página

Secundario (outlined):
  background: transparent
  border: 1px solid color-border
  color: color-text-primary
  border-radius: 8px
  padding: 10px 20px
  hover: background color-bg-empty
  Uso: "Ver agendas", "Cancelar", acciones secundarias

Destructivo:
  background: color-absent (#E74C3C)
  color: #FFFFFF
  Uso: eliminar, dar de baja — siempre con modal de confirmación previa

Reglas:
  - Máximo 2 botones por área de acción (1 primario + 1 secundario)
  - Botón primario siempre a la derecha o en posición destacada
  - Nunca dos botones primarios juntos
  - Loading state: texto cambia a "Guardando..." + spinner inline + disabled
```

### 5.6 Page Header (dentro del content)

```
Estructura:
  [Ícono de sección] [Título de página]          [Acción principal (CTA)]
                                        [Metadata: "Fecha", date picker]

Reglas:
  - El ícono usa color-primary, 20-24px
  - El título es 22px, bold
  - El CTA principal va siempre a la derecha
  - Separado del contenido por 20-24px
```

### 5.7 Section Card

Contenedor para agrupar contenido dentro de la página.

```
  background: #FFFFFF
  border: 1px solid color-border
  border-radius: 8px
  padding: 20px 24px
  margin-bottom: 16px

  Header de sección (si aplica):
    [Ícono] [Título]              [Link "Ver todos →"]
    border-bottom: 1px solid color-border
    padding-bottom: 16px
    margin-bottom: 16px
```

---

## 6. Patrones de layout por tipo de pantalla

### Dashboard / Tablero
```
1. Page header (título + CTA principal)
2. KPI cards (grilla 4 columnas)
3. Section cards con contenido principal
   └── Si vacío: empty state con CTAs
```

### Listado con filtros (Presentismo, Historial)
```
1. Page header (título + selector de fecha/filtro)
2. KPI cards clicables (actúan como filtros de estado)
3. Table o lista de resultados
   └── Si vacío: empty state
```

### Formulario / Modal
```
Fixed overlay (rgba(0,0,0,0.4))
  └── Modal centered, max-width 480px, border-radius 12px
      ├── Header: título + botón ✕
      ├── Body: campos del formulario
      └── Footer: [Cancelar] [Confirmar] (alineados a la derecha)
```

---

## 7. Estados de UI

Todos los componentes con datos deben implementar los tres estados:

```
Loading:
  - Skeleton loaders (rectángulos grises animados) en lugar de spinners
  - Mantienen el layout para evitar saltos visuales
  - Duración máxima antes de mostrar error: 10 segundos

Error:
  - Banner rojo suave al tope del contenido (no modal)
  - background: #FEF0EE, border: #E74C3C, texto descriptivo + acción "Reintentar"
  - No bloquear toda la pantalla por un error parcial

Empty:
  - Ver componente 5.4 — Empty State
  - Distinguir "sin datos aún" de "sin resultados para este filtro"
```

---

## 8. Accesibilidad (mínimos no negociables)

- Contraste texto/fondo: mínimo **4.5:1** (WCAG AA)
- Todos los inputs tienen `<label>` asociado con `htmlFor`
- Botones con solo ícono tienen `aria-label`
- Navegación completa por teclado (Tab + Enter + Escape en modales)
- Focus visible: `outline: 2px solid color-primary`, `outline-offset: 2px`
- Tap targets mínimo **44x44px** en mobile

---

## 9. Responsive

Breakpoints (Tailwind defaults):

| Breakpoint | Ancho    | Comportamiento                                    |
|------------|----------|---------------------------------------------------|
| Mobile     | < 640px  | Sidebar oculto (drawer), KPI cards 2x2, 1 col     |
| Tablet     | 640-1024px | Sidebar colapsado a íconos, KPI 2x2              |
| Desktop    | > 1024px | Layout completo como en los screenshots           |

Regla general: diseñar desktop-first pero verificar siempre en 375px.

---

## 10. Librería de íconos

**Familia usada en este proyecto:** `[completar — ej: Lucide, Heroicons, Material Icons, Phosphor]`

Instalar una sola librería y usarla en todo el proyecto. No mezclar.

```bash
# Ejemplo con Lucide (recomendado para proyectos React/Tailwind)
npm install lucide-react

# Uso:
import { User, Calendar, CheckCircle } from 'lucide-react'
<CheckCircle size={20} className="text-green-600" />
```

---

## 11. Mapeo de tokens a Tailwind

Configurar los tokens de color en `tailwind.config.js` para usar clases semánticas en lugar de valores hex hardcodeados:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4BA3D9',   // color-primary
          light:   '#EBF5FB',   // color-primary-light
          dark:    '#2E86C1',   // color-primary-dark
        },
        state: {
          confirmed: '#2E86C1',
          present:   '#27AE60',
          absent:    '#E74C3C',
          pending:   '#F39C12',
          neutral:   '#7F8C8D',
        },
        surface: {
          app:     '#F4F6F8',   // color-bg-app
          card:    '#FFFFFF',   // color-bg-surface
          empty:   '#F8F9FA',   // color-bg-empty
          border:  '#E8ECF0',   // color-border
        },
        content: {
          primary:   '#1A2332', // color-text-primary
          secondary: '#6B7A8D', // color-text-secondary
          disabled:  '#B0BEC5', // color-text-disabled
        },
      },
    },
  },
}
```

Uso en componentes:
```tsx
// ✅ Correcto — semántico
<button className="bg-primary text-white hover:bg-primary-dark">
<span className="text-state-present">Presente</span>

// ❌ Prohibido — valor hex hardcodeado
<button className="bg-[#4BA3D9]">
<span style={{ color: '#27AE60' }}>
```

---

## 12. Lo que NO hacer

- ❌ No usar colores de estado para decoración (verde/rojo solo para presente/ausente)
- ❌ No poner más de 4 KPI cards en una fila
- ❌ No mostrar errores como alert() del browser — siempre UI integrada
- ❌ No usar tablas densas sin cards de resumen arriba
- ❌ No mezclar familias de íconos (elegir una y mantenerla en todo el proyecto)
- ❌ No dejar ningún componente sin estado de loading y sin empty state
- ❌ No usar `any` en TypeScript para manejar respuestas de API
