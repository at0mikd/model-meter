# T-002 · Núcleo puro: modelo, esfuerzo, sanitización y encaje por ancho

- **Estado:** Ready (requiere T-001 en `main` ✅)
- **Rama:** `feat/T-002-pure-core`
- **Plan:** `docs/PLAN.md` §2.4 (decisiones tras T-000), §3.1, §4, §5

## Objetivo

Módulos **sin `$`** en `plugins/model-meter/hooks/core/`, totalmente testeados con `node --test`, que convierten lo que da el motor en lo que se dibuja. T-003 solo cableará eventos y pintará con ellos.

## Alcance

**Entra** (cada módulo en `hooks/core/<nombre>.ts` con su `<nombre>.test.ts`; sintaxis borrable para Node 22, sin `enum` ni `namespace`):

1. **`sanitize.ts`**
   - `sanitize(text: string, max = 32): string`: elimina todo lo que no sea `[A-Za-z0-9.\-\[\] @/_]` (incluidos controles, ANSI/OSC, bidi y no imprimibles), colapsa espacios, recorta a `max` y nunca lanza.
   - Property test con `fast-check` (≥ 1 000 casos): la salida solo contiene caracteres permitidos y mide ≤ `max`, para cualquier entrada.
2. **`model.ts`**
   - `parseModel(id: string): { family: Family, label: string }`, con `Family = 'opus' | 'sonnet' | 'haiku' | 'fable' | 'unknown'`.
   - Debe reconocer, con un test por cada forma:
     - ids actuales: `claude-opus-5-5` → `OPUS 5.5`; `claude-fable-5-2` → `FABLE 5.2`;
     - sufijo de contexto: `claude-sonnet-5-5[1m]` → `SONNET 5.5 1M`;
     - ids con fecha: `claude-opus-4-1-20250805` → `OPUS 4.1`;
     - formato antiguo: `claude-3-5-sonnet-20241022` → `SONNET 3.5`;
     - Bedrock (`us.anthropic.claude-opus-4-1-20250805-v1:0`) y Vertex (`claude-opus-4-1@20250805`);
     - alias sueltos (`opus`, `sonnet`, `haiku`, `fable`) → familia sin versión.
   - Cualquier otra cosa → `unknown`, con la etiqueta saneada en mayúsculas (≤ 16).
3. **`effort.ts`**
   - `type Level = 'low' | 'medium' | 'high' | 'xhigh' | 'max'`; `LEVELS` congelado.
   - `parseLevel(value: unknown): Level | undefined`: allowlist exacta, sin distinguir mayúsculas y minúsculas, después de `trim`.
   - `parseEffortArg(args: string): Level | undefined`: lo escrito tras `/effort` (`'high'` → `high`; `''` o cualquier otra cosa → `undefined`). Nunca devuelve texto del usuario.
   - `effortCells(level: Level): 1|2|3|4|5` (de `low` = 1 a `max` = 5) y `effortLabel(level)`: `LOW`, `MED`, `HIGH`, `XHI`, `MAX`.
   - Esfuerzo numérico (solo en builds internas): `{ label: 'CUSTOM', cells: null }`. No se inventa ninguna escala.
4. **`state.ts`**
   - `effortState({ step, stored, pending }): EffortView`, con `EffortView = { level?: Level, custom?: boolean, source: 'step' | 'stored' | 'pending' | 'unknown' }`, según PLAN §2.4:
     - `pending` (tras `/effort`) manda: muestra el nivel de `args` si es válido y, si no, el último conocido;
     - si no, `step` (el último `turn.step`);
     - si no, `stored` (el valor de `$.store`, validado con `parseLevel`);
     - si no, `unknown`.
   - Un `stored` corrupto o con un tipo inesperado da `unknown` y nunca lanza.
5. **`layout.ts`**
   - `widthOf(text)`: columnas de texto saneado más nuestros glifos (`◆ ▮ ▯ …`), ignorando los selectores de variación.
   - `fitBadge({ columns, reserved, variants }): Variant | 'none'`: elige la primera variante que cabe en `columns − reserved`, en este orden: `full` → `noMeter` → `modelOnly` → `none`. `reserved` agrupa márgenes, etiqueta de modo, ancho de las pistas y lo que hay debajo (PLAN §3.1).
   - Tests a 95 y 191 columnas con las pistas `''`, `1 shell · ↓ to manage` y `esc to interrupt`, con y sin un nodo debajo de 30 columnas.

**No entra:** ningún hook, ningún uso de `$` ni de `claude-code` (eso es T-003), ni sprites (T-004).

## Criterios de aceptación

- **CA1** — Los cinco módulos existen con las firmas indicadas y ninguno importa `claude-code` ni `node:*` (lo verifica un test que lee los ficheros).
- **CA2** — Un test por cada forma de id de modelo de la lista y por cada fila de la cascada de `effortState`.
- **CA3** — Property tests de `sanitize`, `parseModel` y `parseEffortArg` (≥ 1 000 casos cada uno): nunca lanzan, y su salida es un valor de la allowlist o texto saneado.
- **CA4** — `npm run check` en verde; cobertura ≥ 95 % de líneas y ramas en `hooks/core/`.
- **CA5** — `claude plugin validate --strict plugins/model-meter` sigue en verde, y `capabilities` no cambia: el núcleo no añade llamadas a `$`.

## Restricciones de seguridad

- Cero dependencias nuevas (`fast-check` ya está permitida).
- Ninguna función del núcleo devuelve texto del usuario o del motor sin pasar por `sanitize` o por una allowlist.

## Evidencia requerida

Salida de `npm run check` (con la cobertura de `hooks/core/`) y la lista de tests.
