# T-003 · Modo compacto en el pie (`SessionMode`)

- **Estado:** Draft (pasa a Ready cuando T-002 esté en `main`)
- **Rama:** `feat/T-003-compact-footer`
- **Plan:** `docs/PLAN.md` §2.4, §3.1, §5, §6

## Objetivo

Primera versión usable del mod: `◆ OPUS 5.5 ▮▮▯▯▯ MED` en el pie, compartiendo fila con otros mods (`sub-meter`) y con las pistas del motor, y actualizado en vivo con `/model`, `/effort` y cada turno.

## Borrador de alcance

- `register.tsx`, solo cableado, apoyado en `hooks/core/`. Todos los hooks observan y devuelven `next(e)` intacto:
  - `session.start` y `classic.SessionStart` (`source: 'clear'`): `$.session.model()` y el esfuerzo previo de `$.store`.
  - `turn.step` (generador asíncrono; solo si `e.agentId === undefined`): registra `e.model` y `e.effort`, guarda el nivel en `$.store` y limpia el estado pendiente.
  - `config.set` con `key === 'model'`: refresca con `$.session.model()`.
  - `command.run` con `{ command: 'effort' }`: marca el esfuerzo como pendiente con `parseEffortArg(e.args)`.
  - `ui.render` `PromptHint`: solo mide `e.props.hint`; si el ancho cambia, `$.ui.invalidate('ui.render')`.
  - `ui.render` `SessionMode`: dibuja la insignia y después lo que devuelve `next(e)`, con la variante de `fitBadge`. En `mobile`, solo `modelOnly`.
- Los hooks en `config.set`, `command.run` y `prompt.submit` llevan `try/catch` y un `.catch` explícito que deja pasar el evento (PLAN §2.4, decisión 6).
- Contrato de `$.state` en `types/index.d.ts`: `{ model, effort, pending, hintWidth }`.
- Colores con tokens del tema; atenuado (`dimColor`) para `stored` y `pending`.
- README: «Cómo probar», con el aviso de que `/model` y `/effort` cambian los valores por defecto del usuario.

## Borrador de criterios de aceptación

- Tests de mod en `terminal` y `desktop`:
  - la insignia aparece;
  - `turn.step` la actualiza;
  - `config.set` del modelo la refresca;
  - `/effort high` la muestra como pendiente;
  - un `turn.step` posterior la confirma.
- Tests de que `/model` y `/effort` llegan intactos a lo que hay debajo, aunque la lógica interna lance.
- Tests de degradación por ancho con `PromptHint` variable y un nodo debajo.
- `capabilities` en verde con la allowlist actual (sin ampliarla).
- Prueba manual en terminal del Maintainer junto a `sub-meter`, a media pantalla y maximizada, con capturas.
