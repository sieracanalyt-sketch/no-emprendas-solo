# Sistema de diseño — NoEmprendasSolo (NES)

> Fuente de verdad estética de toda la web. Cualquier pantalla nueva o rediseño
> **debe** partir de este documento. Si algo no encaja aquí, primero se decide
> aquí y luego se implementa.
>
> Los tokens viven en [`src/index.css`](src/index.css) (`:root`). Este documento
> explica **qué** son, **cuándo** usarlos y **por qué**.

---

## 0. Principio rector — *Liquid glass sobre luz de ambiente*

La interfaz es **cristal flotante** iluminado por **glows de color** que viven
detrás. Nada es opaco porque sí: las superficies dejan pasar la luz, los bordes
brillan donde les da la luz, y los elementos activos se sienten como una **lente
líquida** que se desliza sobre el contenido.

Tres ideas que no se negocian:

1. **Dark mode dominante.** Fondo casi negro (`--bg`), color solo en los glows y en un único acento.
2. **Cero esquinas rectas.** Todo lo interactivo es *pill* o de radio generoso.
3. **Un solo acento vivo** (índigo) sobre neutros. El color se gana, no se reparte.

---

## 1. Paleta

### Base (neutros)
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0c0d0e` | Fondo general de la app |
| `--surface` | `rgba(255,255,255,.05)` | Tarjetas de cristal |
| `--surface-2` | `rgba(255,255,255,.03)` | Fondos secundarios (sidebars) |
| `--surface-3` | `rgba(255,255,255,.07)` | Inputs, burbujas recibidas |
| `--border` | `rgba(255,255,255,.09)` | Borde de cristal por defecto |
| `--border-strong` | `rgba(255,255,255,.16)` | Borde de cristal enfatizado |

### Texto
| Token | Valor | Uso |
|---|---|---|
| `--text` | `#f7f8f8` | Texto principal / titulares |
| `--text-dim` | `#8a8f98` | Texto secundario, nav inactiva |
| `--text-dimmer` | `#62666d` | Terciario, placeholders, labels |

### Acento (índigo — el único color de marca vivo)
| Token | Valor | Uso |
|---|---|---|
| `--accent` | `#5e6ad2` | Acción primaria, estado activo, MERGE |
| `--accent-blue` | `#3b82f6` | Anillo de focus en inputs |

Acento en texto sobre oscuro: usar `#9aa4f0`/`#aeb6ff` (versiones aclaradas)
para que el contraste sea legible.

### Glow secundario (solo ambiente, nunca en texto ni bordes)
- Teal `rgba(47,141,160,·)` — segundo foco de luz, siempre en la esquina opuesta al índigo.
- Regla: **máximo dos glows de color** por pantalla + un velo blanco tenue arriba.

### Semánticos (estado, no marca)
| Significado | Color |
|---|---|
| Éxito / positivo | `#3fb950` |
| Error / riesgo | `#f85149` (texto claro `#f8817b`) |
| Aviso | `#d29922` / `#e3b341` |

---

## 2. El cristal (glassmorphism)

Receta reutilizable. En CSS es la clase `.glass`; sus tokens:

```
--glass-bg: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
--glass-border: rgba(255,255,255,.12);
--glass-shadow: 0 24px 60px rgba(0,0,0,.45), 0 4px 16px rgba(0,0,0,.25),
                inset 0 1px 0 rgba(255,255,255,.10);
backdrop-filter: blur(24px) saturate(1.3);
```

Tres profundidades de cristal:

| Clase | Cuándo |
|---|---|
| `.glass` | Cromo flotante y contenedores principales (translúcido). |
| `.glass-dark` | Capas que **flotan sobre contenido** (modales, menús, popovers). Más opaco para que el texto de debajo no ensucie. |
| `.row-card` / `.mg-card` | Tarjetas y filas dentro de un panel: cristal más ligero, con hover que "levanta". |

**Regla de oro del blur:** el `backdrop-filter` solo se ve si hay **luz de color
detrás**. Toda pantalla nueva hereda los glows globales del `body::before`; si
una sección los tapa, añade sus propios glows locales (ver MERGE `.mg-glow`).

**El brillo especular** (`inset 0 1px 0 rgba(255,255,255,.08-.10)`) es lo que
convierte una caja translúcida en "cristal". No lo omitas.

---

## 3. Liquid glass — la lente que se desliza

Evolución del cristal para elementos **activos/seleccionados**. En lugar de
pintar un fondo plano bajo la pestaña activa, una **lente de cristal** se
*desliza* físicamente hasta ella (navbar, tabs, toggles).

Anatomía de la lente (`.lg-lens`):
- Cuerpo de cristal claro + `backdrop-filter: blur` (refracta lo de debajo).
- **Borde iridiscente**: gradiente índigo→teal→blanco a 1px (el "canto" del cristal líquido).
- **Reflejo especular** superior (highlight blanco que resbala al moverse).
- **Movimiento con muelle**: `cubic-bezier(.34,1.56,.64,1)` sobre `transform`/`width`, ~0.45 s. La lente **nunca** aparece/desaparece con `opacity`: siempre viaja.

Se implementa midiendo el ítem activo y posicionando una capa absoluta bajo el
texto. Referencia canónica: la navbar (`src/components/Navbar.tsx`).

---

## 4. Forma

- **Radios:** `pill` (999px) para navegación, botones, chips, inputs de una línea.
  `18–24px` para tarjetas y paneles. `10–12px` solo para inputs de formulario densos.
- **Nunca** esquinas a 90° visibles en superficies interactivas.
- **Densidad:** aire generoso. El vacío es parte del diseño (composición centrada por defecto).

---

## 5. Tipografía

- **Familia:** `Inter, system-ui, -apple-system, sans-serif`.
- **Titulares (h1–h3):** `600`, `letter-spacing: -0.01em` (hero puede ir a `-0.03em`).
- **Display de marca** (auth, hero): peso `800`, tracking cerrado, `line-height` ~1.15.
- **Cuerpo:** `400–500`, line-height `1.6–1.7`.
- **Labels/eyebrows:** `11px`, `uppercase`, `letter-spacing .08em`, color `--text-dimmer` (clase `.mg-label`).
- Números en vivo (timers, métricas): `font-variant-numeric: tabular-nums`.

Toque editorial permitido (inspiración *Clarity in Complexity*): una palabra
del titular en **serif itálica** como acento. Con moderación.

---

## 6. Motion

| Gesto | Curva | Duración |
|---|---|---|
| Aparición de contenido | `ease-out` + `translateY(8px)` (`.animate-in`, `fadeIn`) | 0.35 s |
| Lente líquida / toggles | `cubic-bezier(.34,1.56,.64,1)` (muelle) | 0.25–0.45 s |
| Entradas de panel/modal | `cubic-bezier(.16,1,.3,1)` | 0.35–0.45 s |
| Hover "levanta" | `translateY(-1px)` | 0.15 s |
| Glows de ambiente | deriva lenta infinita (`mg-drift`) | 14–18 s |

Respeta **siempre** `@media (prefers-reduced-motion: reduce)`: anula animación y transición.

---

## 7. Componentes

### Navegación (`Navbar`)
Píldora `.glass` flotante (`top-3`, `max-w-6xl`). Ítems con **lente líquida
deslizante** marcando el activo. MERGE es un ítem de acento (índigo + badge
Premium). En móvil, tab bar inferior fija (`.bottomnav`) con la misma lente.

### Botones
- **Primario claro** (auth): fondo blanco sólido, texto `#111`, radio 10–12px o pill. Para el CTA "una acción principal por pantalla".
- **Primario de acento** (`.mg-btn-primary`): gradiente índigo + glow `0 8px 28px rgba(94,106,210,.45)`. Para acciones de marca (MERGE, upgrade).
- **Cristal** (`.btn-linear` / `.mg-btn`): translúcido, para acciones secundarias.
- **Icono redondo** (`.mg-icon-btn`): 42px, círculo de cristal, para controles (micro, enviar, cerrar).
- Todos: hover `translateY(-1px)`, active vuelve a 0.

### Inputs
`.field-input` — cristal tenue, borde `--border-strong`, y **anillo azul** en focus
(`box-shadow: 0 0 0 3px rgba(59,130,246,.18)`). Placeholder en `--text-dimmer`.
Pill para búsquedas, radio 10–12px para formularios.

### Chips / badges
`.mg-chip` pill translúcido. Badge Premium: `rgba(94,106,210,.18)` + texto `#9aa4f0`, uppercase.

---

## 8. Autenticación (Login / Register) — patrón

Layout **split** (inspiración Astria / Gen AI, imágenes 2 y 3):

- **Panel visual (izquierda, ~50%, oculto < 768px):** hero a sangre con
  overlay oscuro degradado. Marca (logo NES) + tagline rotatoria. Como no hay
  fotografía de stock, el hero se genera con **aurora de glows** (índigo + teal)
  y grano sutil — mismo lenguaje que el resto de la app.
- **Panel formulario (derecha, ~50%):** cristal oscuro. Titular display, botón
  Google (blanco), divisor "o con correo", inputs pill, contraseña con **toggle
  de ojo**, CTA primario, y enlace a la otra pantalla.
- El fondo global (glows del `body`) se ve entre columnas: `background: transparent`.

Breakpoints: `< 1024px` reduce padding; `< 768px` oculta el panel visual y el
formulario ocupa el 100%.

---

## 9. MERGE — patrón de la consola

MERGE es el copiloto de voz/texto del fundador dentro de NES. Su pantalla es la
expresión máxima del lenguaje: cristal sobre glows con deriva.

- **Composer estilo "prompt bar"** (inspiración imagen 4): input largo en píldora
  de cristal con **borde glow animado** (índigo→teal recorriendo el perímetro).
  Es la firma visual de MERGE.
- **Explicar para qué sirve, siempre**: estado inicial con propuesta de valor
  clara (qué hace, qué puede pedirle el usuario). Nada de pantalla en blanco.
- **Privacidad por diseño — "trabajando" pixelado**: cuando MERGE procesa
  (matchmaking, briefings), se muestra que *está trabajando* con un preview
  **difuminado/pixelado** que **no revela datos** reales. La confianza se
  construye enseñando el esfuerzo sin filtrar información.
- **Sin puntuaciones crudas** en las tarjetas de match: explicación humana
  (por qué encaja, primer paso), nunca un número de "compatibilidad".
- El **orbe** que respira (`.mg-orb`) es el avatar de MERGE.

---

## 10. Checklist para cualquier pantalla nueva

- [ ] ¿Fondo oscuro con glows visibles detrás del cristal?
- [ ] ¿Cero esquinas rectas en lo interactivo?
- [ ] ¿Un solo acento índigo, resto neutro?
- [ ] ¿El elemento activo usa lente líquida deslizante (no un cambio brusco)?
- [ ] ¿Brillo especular en las superficies de cristal?
- [ ] ¿Titulares 600 con tracking cerrado; labels 11px uppercase?
- [ ] ¿Motion con las curvas de la tabla; `prefers-reduced-motion` respetado?
- [ ] ¿Una única acción primaria por vista?
