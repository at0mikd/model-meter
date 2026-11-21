# T-010 · Sprites 8-bit de alta calidad y familia Mythos

- **Estado:** Ready (después de T-004, #24)
- **Rama:** `feat/T-010-sprites-mythos`
- **Plan:** `docs/PLAN.md` §3.2; decisiones del Maintainer sobre los sprites de T-004 (2026-11-21)

## Objetivo

Sustituir los sprites de T-004 (4×8, de un color) por sprites 8-bit de **16×16 píxeles con 3 colores y transparencia**, al estilo de los sprites de la NES. Además, reconocer la familia **Mythos** en el pie y en la banda.

**Decisiones del Maintainer (2026-11-21):**
- Opus pasa de una corona a un **cáliz**.
- Se añade **Mythos**, con un sprite inspirado en la mitología: un **casco alado**.
- La calidad debe estar al nivel de la mascota de Claude, pero **sin copiarla ni parecerse a ella**: los diseños son originales.

## Datos de partida

- **Media celda con dos colores.** Una celda de la terminal es `▀` con `color` (píxel de arriba) y `backgroundColor` (píxel de abajo). `Text` admite las dos props, según los tipos de la CLI 2.1.327. Una celda con un solo píxel usa `▀` o `▄` sin fondo; una vacía, un espacio.
- **Colores:** solo claves del tema (`ThemeKey`), nunca colores crudos, para que sigan al tema de la persona.
  - `text` es claro en el tema oscuro y oscuro en el claro. Por eso los diseños lo usan solo en **detalles finos**: brillos, la nieve, las líneas del libro, el filo del casco.
  - Las superficies grandes van en el color de la familia o en el de acento.
  - Vista previa con los dos temas: [`docs/assets/sprites-v2-preview.png`](../assets/sprites-v2-preview.png).
- **Mythos.** IDs de modelo según la documentación de Anthropic:
  - `claude-mythos-5`, la [vista general de Mythos 5](https://platform.claude.com/docs/en/models/mythos-5/overview);
  - `claude-mythos-5-1`, la [vista general de Mythos 5.1](https://platform.claude.com/docs/en/models/mythos-5-1/overview);
  - en Bedrock existe también `claude-mythos-preview` ([ficha de modelo](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-mythos-preview.html)).

## Alcance

**Entra:**

1. **Familia `mythos`** en el núcleo (`model.ts`):
   - `claude-mythos-5` → `Mythos 5` y `claude-mythos-5-1` → `Mythos 5.1`;
   - `claude-mythos-preview` → `Mythos preview`, en minúscula salvo el nombre;
   - color de familia `planMode`;
   - glifo `◆`, como las demás.
2. **Sprites** en `sprite.ts`, con las cuadrículas de abajo **tal cual**. Cada cuadrícula tiene 16 filas de 16 caracteres:
   - `.` es transparente;
   - `1`, `2` y `3` son las ranuras de color de la tabla.
3. **Paso de píxeles a celdas** como función pura: dos filas de píxeles dan una fila de celdas, cada una con su carácter, color y fondo. El hook solo pinta.
4. **Banda** de 8 filas por 16 columnas:
   - `BAND_MIN_ROWS` pasa a 8, la altura del sprite;
   - el rótulo va junto a las dos filas centrales;
   - el resto de T-004 (opciones, histéresis y orden de ajuste) no cambia.

**No entra:** paletas configurables, animaciones y cambios en el pie, salvo reconocer Mythos.

### Paleta por sprite (claves del tema)

| Familia | Motivo | `1` | `2` | `3` |
| --- | --- | --- | --- | --- |
| Opus | cáliz | `claude` | `warning` | `text` |
| Sonnet | pluma | `suggestion` | `warning` | `text` |
| Haiku | montaña y sol | `success` | `warning` | `text` |
| Fable | libro abierto | `merged` | `claude` | `text` |
| Mythos | casco alado | `planMode` | `warning` | `text` |
| desconocido | cartucho vacío | atenuado | atenuado | atenuado |

### Cuadrículas

**Opus — cáliz**

```text
................
.22222222222222.
.23111111111112.
.23111111111112.
..231112211112..
..231123321112..
...2311221112...
....21111112....
.....222222.....
.......22.......
.......22.......
......2222......
.......22.......
.....222222.....
...2222222222...
..222222222222..
```

**Sonnet — pluma**

```text
............111.
..........11113.
.........111131.
........1.11311.
.......1111311..
......1.11311...
.....1111311....
....1.11311.....
....111311......
....11311.......
.....33.........
....33..........
...22...........
..22............
..2.............
.2..............
```

**Haiku — montaña y sol**

```text
..........222...
.........22222..
.........22222..
.........22222..
..........222...
......3.........
.....333........
....33333.......
...3131313...3..
..111111111.313.
..11111111113131
.111111111111111
1111111111111111
1111111111111111
1111111111111111
................
```

**Fable — libro abierto**

```text
................
................
..1111....1111..
.111111..111111.
2111111111111112
2133331111333312
2111111331111112
2133311331133312
2111111331111112
2133331331333312
2111111331111112
2211111111311122
.22222211232222.
..222222223222..
.........333....
................
```

**Mythos — casco alado**

```text
......2222......
.....222222.....
.....222222.....
....11111111....
...1333333331...
2..1111111111..2
22.1111111111.22
2221........1222
.2211......1122.
..2111....1112..
...1111..1111...
...1111..1111...
...111....111...
....11....11....
................
................
```

**desconocido — cartucho vacío**

```text
................
..111111111111..
..133333333331..
..13........31..
..13........31..
..13........31..
..13........31..
..133333333331..
..111111111111..
..1.1.1..1.1.1..
..111111111111..
..111111111111..
................
................
................
................
```

## Criterios de aceptación

- **CA1** — Tests de núcleo de Mythos:
  - los tres IDs con su etiqueta;
  - el color de familia;
  - un ID parecido pero no válido sigue siendo desconocido, por ejemplo `claude-mythos-x`.
- **CA2** — Tests de núcleo de los sprites:
  - 16×16;
  - como mucho 3 ranuras, más la transparencia;
  - las seis cuadrículas distintas e idénticas a las de esta tarea;
  - el desconocido, atenuado.
- **CA3** — Tests de núcleo del paso a celdas: las cuatro combinaciones de dos píxeles (vacío/vacío, color/vacío, vacío/color y color/color) dan el carácter, el color y el fondo esperados.
- **CA4** — Tests de mod:
  - la banda dibuja 8 filas;
  - con `maxRows` 7 no sale y con 8 sí;
  - con Mythos, el pie dice `Mythos 5.1` en `planMode`;
  - los tests de T-004 y del pie siguen en verde.
- **CA5** — `capabilities` en verde, con las mismas llamadas a `$`. `npm run check` en verde.
- **CA6** — PLAN §3.2, el README del mod y el CHANGELOG al día.
- **CA7** — Capturas del Maintainer con la banda, a pantalla completa, de al menos Opus y Fable. Mythos solo si tiene acceso. El Maintainer da el visto bueno final al aspecto.

## Restricciones de seguridad

- Los sprites y la paleta son constantes del código. Solo se usan claves del tema, nunca colores crudos.
- No hay llamadas nuevas a `$` ni dependencias nuevas.
- Mythos se reconoce con la misma validación estricta de IDs que las demás familias: cualquier otro texto sigue siendo desconocido y se sanitiza igual.

## Evidencia requerida

- La salida de `npm run check` y de `npm run capabilities`.
- Una muestra en texto de la banda.
- Las capturas de CA7.
