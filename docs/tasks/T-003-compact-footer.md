# T-003 · Modo compacto en el pie (`SessionMode`)

- **Estado:** Ready (T-002 en `main` ✅, #10)
- **Rama:** `feat/T-003-compact-footer`
- **Plan:** `docs/PLAN.md` §2.4 (decisiones 1–6), §3.1, §5, §6

## Objetivo

Primera versión usable del mod: `◆ OPUS 5.5 ▮▮▯▯▯ MED` en el pie de la terminal, compartiendo fila con otros mods (`sub-meter`) y con las pistas del motor, y actualizada en vivo con `/model`, `/effort` y cada turno. Toda la lógica de decisión sale de `hooks/core/` (T-002); `register.tsx` solo cablea eventos y dibuja.

## Alcance

**Entra:**

1. **Superficie.** Solo se dibuja en `e.surface === 'terminal'`. En `desktop`, `vscode` y `mobile`, `return next(e)` sin cambios: la app ya muestra modelo y esfuerzo, y duplicarlo no aporta nada.
2. **Imports.** `register.tsx` importa el núcleo como `./core/<nombre>.js` (la forma que aceptan `validate --strict` y `claude plugin test`; ver la desviación de T-002). Los tests del mod siguen siendo solo `hooks/register.test.tsx`.
3. **Hooks.** Todos observan y devuelven el resultado de `next(e)` sin cambios:
   - `session.start`: `isInteractive`; `$.session.model()` → estado; `$.store.get('effort')` → `stored`, validado con `parseLevel`.
   - `classic.SessionStart` con `source === 'clear'`: igual que `session.start` (el modelo puede seguir, el turno no).
   - `turn.step`: **generador asíncrono** con `return yield* next(e)`. Solo si `e.agentId === undefined`: guarda `e.model` y `e.effort` en el estado y borra `pending`. Si `parseLevel(e.effort)` da un nivel, `$.store.set('effort', level)` (solo ese valor de la allowlist, nunca otro texto).
   - `config.set` con `key === 'model'`: refresca con `$.session.model()`.
   - `command.run` con `{ command: 'effort' }`: `pending = { args: e.args }`. El texto lo interpreta `effortState`, que nunca devuelve texto del usuario.
   - `ui.render` `{ component: 'PromptHint' }`: solo mide `widthOf(e.props.hint)` y guarda el ancho; si cambia, llama a `$.ui.invalidate('ui.render')`. Devuelve `next(e)` intacto: no oculta, recorta ni reescribe pistas.
   - `ui.render` `{ component: 'SessionMode' }`: dibuja la insignia y, a continuación, lo que devuelve `next(e)`, con un separador ` · ` solo si debajo hay algo.
4. **Puntos que pueden bloquear un evento** (`config.set`, `command.run`): el cuerpo va en `try/catch` y siempre devuelve `next(e)`, y cada hook lleva `.catch(($, e, next) => next(e))` (PLAN §2.4, decisión 6). `capabilities` ya rechaza cualquier hook de este tipo sin `.catch`.
5. **Encaje por ancho**, con `fitBadge` del núcleo:
   - `reserved` = márgenes del pie + etiqueta de modo (`e.props.modes`) + ancho medido de las pistas + ancho de lo que devuelve `next(e)`.
   - El ancho de un árbol de render se calcula con un helper **puro** nuevo en `hooks/core/layout.ts` (`widthOfTree`), con un tipo estructural propio, sin importar `claude-code`, y tests en `test/core/`.
   - Con `none` se devuelve solo lo que hay debajo.
6. **Presentación**:
   - **Familia reconocida:** `◆` + etiqueta con el color de la familia, mediante tokens del tema (nunca ANSI crudo).
   - **`unknown`:** `? ` + etiqueta atenuada, para que no se confunda con un modelo reconocido (comentario de la revisión de #10).
   - **Medidor:** `▮` llenas con color, `▯` vacías atenuadas. `CUSTOM` sin medidor.
   - **Estados** según `source`: `stored` atenuado; `pending` atenuado con `…` al final; `unknown` como `?`.
7. **Estado**: `atom`s con contrato en `types/index.d.ts`: `model: string | null`, `step: unknown` (validado al leer), `pending: { args: string } | null` y `hintWidth: number`. En `$.store` solo se guarda `effort` (un `Level`).
8. **README** del plugin: qué muestra, cómo instalarlo, «Cómo probar», con el aviso de que `/model` y `/effort` cambian los valores por defecto del usuario (T-000, hallazgo 7), y qué datos guarda (solo el último nivel de esfuerzo).

**No entra:** la banda 8-bit y el modo `auto` (T-004), `userConfig` (T-005), ampliar la allowlist de capacidades.

## Criterios de aceptación

- **CA1** — Tests de mod en `terminal`:
  - con `session.start`, la insignia muestra el modelo y el esfuerzo previo atenuado (o `?`);
  - un `turn.step` del hilo principal la actualiza, y uno con `agentId` no;
  - `config.set` del modelo la refresca;
  - `/effort high` la muestra como pendiente;
  - un `turn.step` posterior la confirma.
- **CA2** — En `desktop`, la salida es exactamente la del motor (`next(e)`), y lo prueba un test.
- **CA3** — Tests de que `/model` y `/effort` llegan intactos a lo que hay debajo, también cuando la lógica interna lanza (inyectado en el test).
- **CA4** — Tests de degradación a 95 y 191 columnas con las pistas `''`, `1 shell · ↓ to manage` y `esc to interrupt`, con y sin un nodo debajo de 30 columnas: el orden `full` → `noMeter` → `modelOnly` → `none` se cumple y lo que hay debajo nunca se pierde.
- **CA5** — `$.store` solo recibe valores de `LEVELS`; un `stored` corrupto da `?` (test).
- **CA6** — `npm run check` en verde, `capabilities` en verde **sin ampliar la allowlist**, y `validate --strict` en verde.
- **CA7** — Prueba manual del Maintainer en su terminal, con capturas en el PR:
  - junto a `sub-meter`, a media pantalla y maximizada;
  - con una shell en segundo plano (`1 shell · ↓ to manage`);
  - tras `/model` y `/effort`.

## Restricciones de seguridad

- Ningún texto del motor ni del usuario se dibuja sin pasar por `sanitize`, `parseModel` o la allowlist de niveles.
- Ningún hook reescribe, bloquea ni retrasa un evento del motor.
- Sin dependencias nuevas.

## Evidencia requerida

Salida de `npm run check` y `npm run capabilities`, la lista de tests del mod y las capturas de CA7.
