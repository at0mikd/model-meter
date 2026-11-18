# T-002 · Núcleo puro: modelo, esfuerzo y sanitización

- **Estado:** Draft (pasa a Ready tras fusionar T-000 y T-001)
- **Rama:** `feat/T-002-pure-core`
- **Plan:** `docs/PLAN.md` §3.1, §4, §5

## Objetivo

Módulos sin `$`, totalmente testeados, que convierten lo que da el motor en lo que se dibuja.

## Borrador de criterios de aceptación

- `sanitize(text)`: solo `[A-Za-z0-9.\-\[\] ]`, longitud ≤ 32; property test con `fast-check` (1 000 casos) que garantiza que la salida nunca contiene caracteres de control ni ANSI.
- `parseModel(id)`: `claude-opus-5-5` → `{ family: 'opus', label: 'OPUS 5.5' }`; sufijo `[1m]` → `1M`; ids desconocidos → familia `unknown` con etiqueta saneada.
- `effortCells(effort)`: `low..max` → 1..5; número → escalado y acotado; `undefined` → estado desconocido.
- `effortState({ stepEffort, stored, isPending })`: valor de `turn.step` si existe; si no, `stored` marcado como previo; si no, desconocido. `isPending` (tras `/effort`) conserva el último valor marcado como pendiente. Decisiones de `docs/PLAN.md` §2.4 tras T-000.
- Cobertura ≥ 95 % de líneas y ramas.
