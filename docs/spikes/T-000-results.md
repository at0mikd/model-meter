# T-000 · Resultados del spike en terminal

- **Tarea:** [`docs/tasks/T-000-spike-terminal.md`](../tasks/T-000-spike-terminal.md)
- **Fecha:** 2026-11-18
- **Spike:** `spikes/wic-spike` tal como está en `main` (3eb881d), sin modificaciones.

## Entorno (CA5)

| Dato | Valor |
| --- | --- |
| Claude Code | 2.1.327 |
| Sistema operativo | Fedora Linux 44 Workstation (x86_64), GNOME sobre Wayland |
| Emulador de terminal | Ghostty 1.4.0 (`TERM=xterm-ghostty`, truecolor), sin tmux |
| Renderer por defecto | `fullscreen` (ajuste `tui` del usuario; `/tui` → `Current renderer: fullscreen`) |
| Otros mods | `sub-meter@better-claude` |

## Respuesta a cada criterio

| CA | Respuesta |
| --- | --- |
| **CA1** `/model` | **Sí hay evento antes del siguiente turno.** `/model` emite `command.run` y a continuación `config.set` con `{ key: "model", value: "sonnet", previous: "opus" }`, antes del siguiente `turn.step`. `value` es el alias, no el id; en el siguiente `prompt.submit`, `$.session.model()` ya devuelve el id nuevo (`claude-sonnet-5-5`). |
| **CA2** `/effort` | **Solo `command.run`; no hay `config.set`.** `$.settings.read({ key: "effortLevel" })` **no cambia**: devuelve `"medium"` en las tres sesiones, mientras el esfuerzo efectivo de `turn.step` es `xhigh` al empezar la pasada A y `high` tras `/effort`. El nivel nuevo solo se conoce en el siguiente `turn.step`. |
| **CA3** viewport | Media pantalla: **95 × 47**. Ventana maximizada: **191 × 47**. Mismos valores con y sin `sub-meter`. `AbovePrompt.bodyColumns` = `columns − 5` (90 / 186); `maxRows` = 47 con la sesión vacía y 18 después. Al maximizar se registra un render nuevo de `SessionMode` y `AbovePrompt` con el ancho nuevo. |
| **CA4** `isFullscreen` | `true` con el renderer `fullscreen` (pasadas A y B), tanto a 95 como a 191 columnas. `false` con el renderer clásico (pasada C, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1`). Confirma `docs/PLAN.md` §3.4: indica el modo de render, no si la ventana está maximizada. |
| **CA5** entorno | Ver tabla anterior. |

## Procedimiento ejecutado

Tres sesiones `claude --plugin-dir spikes/wic-spike`. Prompts triviales (`responde solo: hola`) para no generar datos.

| Pasada | `sub-meter` | Renderer | Secuencia |
| --- | --- | --- | --- |
| A | activo | fullscreen | `/tui` → prompt → `/model` (Opus 5.5 → Sonnet 5.5) → `/effort` (xhigh → high) → report → maximizar → prompt → report |
| B | desactivado con `/plugin` | fullscreen | prompt → `/model` (Sonnet 5.5 → Opus 5.5) → `/effort` (high → high) → report → maximizar → prompt → report → reactivar `sub-meter` |
| C | activo | clásico (`CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1`) | `/tui` (→ `classic`) → prompt → report |

Los `command.run` traen las claves `command`, `args`, `origin` y `presentation`. El spike solo registró los **nombres** de las claves (leía un campo `name` que no existe), así que su correspondencia con `/tui`, `/model` y `/effort` se deduce del orden y de la salida de cada comando en la sesión.

### Línea temporal de la pasada A (por `seq`)

| seq | Evento | Datos relevantes |
| --- | --- | --- |
| 0–1 | render `AbovePrompt` / `SessionMode` | 95 × 47, `isFullscreen: true` |
| 2 | `session.start` | modelo `claude-opus-5-5`, `effortSetting: "medium"` |
| 3 | `command.run` | `/tui` |
| 4–5 | `prompt.submit` → `turn.step` | `turn.step.effort: "xhigh"` (aunque el ajuste dice `medium`) |
| 6 | `command.run` | `/model` |
| 7 | `config.set` | `model`: `opus` → `sonnet` |
| 8 | `command.run` | `/effort`, **sin `config.set`** |
| 9–10 | `prompt.submit` → `turn.step` | modelo `claude-sonnet-5-5`, `effort: "high"`; `effortSetting` sigue en `"medium"` |
| 13–14 | render `AbovePrompt` / `SessionMode` | 191 × 47 tras maximizar |

## Hallazgos para el Reviewer

Propuestas, no cambios: el plan lo actualiza el Reviewer (`T-000`, «No entra»).

1. **`settings.effortLevel` no sirve como fuente del esfuerzo.** En este entorno el ajuste de usuario `effortLevel` vale `medium`, pero el esfuerzo efectivo al arrancar con Opus 5.5 era `xhigh`. `/effort high` dice «saved as your default for new sessions» y las sesiones B y C arrancan en `high`, pero `effortLevel` sigue en `medium`: `/effort` guarda el valor en otro sitio. La cascada de `docs/PLAN.md` §2.4 (`settings.effortLevel` → env → `$.store` → `?`) mostraría un valor **falso** antes del primer turno. Propuesta: antes del primer `turn.step`, último valor de `$.store` atenuado o `?`. `settings.effortLevel` como mucho como pista marcada incierta, o no usarlo.
2. **Variables de entorno:** `CLAUDE_CODE_EFFORT_LEVEL` y `CLAUDE_EFFORT` vienen `undefined` en todas las lecturas (en el JSON no aparecen las claves `envEffort` y `envEffort2`).
3. **`/model` permite refrescar sin esperar al turno:** en `config.set` con `key === "model"` basta llamar a `$.session.model()` (el `value` es el alias).
4. **`/effort` no es observable hasta el siguiente turno**, salvo quizá por los valores de `command`/`args` de `command.run`, que este spike no registró. Con el selector interactivo (`/effort` sin argumentos) es probable que `args` venga vacío. Opciones: marcar el esfuerzo como «pendiente» (atenuado) tras un `command.run` de `/effort` hasta el siguiente `turn.step`, o hacer un mini-spike que registre `command` y `args` (incluido `/effort high` con argumento).
5. **Ancho junto a `sub-meter`:** `SessionMode.props.modes` es `[]` en todas las pasadas, y el spike no mide el contenido que devuelve `next(e)`. Los datos solo dicen que el viewport es el mismo con y sin `sub-meter`, no cuántas columnas ocupa. Hay que medir el ancho de lo que devuelve `next(e)` (en el producto o en un mini-spike) antes de fijar los umbrales de degradación.
6. **`turn.step`:** sin `agentId` en ningún caso (hilo principal). Un turno con herramienta produce `index` 0 y 1.
7. **Efecto secundario de las pruebas:** `/model` y `/effort` guardan el valor como predeterminado para sesiones nuevas. Probar el mod con esos comandos cambia la configuración del usuario; conviene avisarlo en futuros spikes y en el README del mod.

## Informes (saneados)

Solo contienen nombres de modelo, niveles de esfuerzo, nombres de eventos y tamaños; sin rutas, prompts ni datos personales. `seq` es el orden global de los eventos. `JSON.stringify` omite los campos `undefined` (`envEffort`, `envEffort2`, `agentId`, `name`). El primer informe de las pasadas A y B es un prefijo exacto del segundo (comprobado), así que se incluye solo el informe final de cada pasada.

### Pasada A — con `sub-meter`, renderer fullscreen

```json
{
 "render.AbovePrompt": [
  {"seq": 0, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": true}, "bodyColumns": 90, "maxRows": 18}},
  {"seq": 13, "data": {"surface": "terminal", "viewport": {"columns": 191, "rows": 47, "isFullscreen": true}, "bodyColumns": 186, "maxRows": 18}}
 ],
 "render.SessionMode": [
  {"seq": 1, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": true}, "modes": []}},
  {"seq": 14, "data": {"surface": "terminal", "viewport": {"columns": 191, "rows": 47, "isFullscreen": true}, "modes": []}}
 ],
 "session.start": [
  {"seq": 2, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}}
 ],
 "command.run": [
  {"seq": 3, "data": {"keys": ["command", "args", "origin", "presentation"]}},
  {"seq": 6, "data": {"keys": ["command", "args", "origin", "presentation"]}},
  {"seq": 8, "data": {"keys": ["command", "args", "origin", "presentation"]}}
 ],
 "prompt.submit": [
  {"seq": 4, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}},
  {"seq": 9, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}},
  {"seq": 15, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}},
  {"seq": 17, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}}
 ],
 "turn.step": [
  {"seq": 5, "data": {"model": "claude-opus-5-5", "effort": "xhigh", "index": 0}},
  {"seq": 10, "data": {"model": "claude-sonnet-5-5", "effort": "high", "index": 0}},
  {"seq": 12, "data": {"model": "claude-sonnet-5-5", "effort": "high", "index": 1}},
  {"seq": 16, "data": {"model": "claude-sonnet-5-5", "effort": "high", "index": 0}},
  {"seq": 18, "data": {"model": "claude-sonnet-5-5", "effort": "high", "index": 0}}
 ],
 "config.set": [
  {"seq": 7, "data": {"key": "model", "value": "sonnet", "previous": "opus"}}
 ],
 "report": [
  {"seq": 11, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}},
  {"seq": 19, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}}
 ]
}
```

### Pasada B — sin `sub-meter`, renderer fullscreen

```json
{
 "render.AbovePrompt": [
  {"seq": 0, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": true}, "bodyColumns": 90, "maxRows": 47}},
  {"seq": 3, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": true}, "bodyColumns": 90, "maxRows": 18}},
  {"seq": 13, "data": {"surface": "terminal", "viewport": {"columns": 191, "rows": 47, "isFullscreen": true}, "bodyColumns": 186, "maxRows": 18}}
 ],
 "render.SessionMode": [
  {"seq": 1, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": true}, "modes": []}},
  {"seq": 14, "data": {"surface": "terminal", "viewport": {"columns": 191, "rows": 47, "isFullscreen": true}, "modes": []}}
 ],
 "session.start": [
  {"seq": 2, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}}
 ],
 "prompt.submit": [
  {"seq": 4, "data": {"model": "claude-sonnet-5-5", "effortSetting": "medium"}},
  {"seq": 9, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}},
  {"seq": 15, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}},
  {"seq": 17, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}}
 ],
 "turn.step": [
  {"seq": 5, "data": {"model": "claude-sonnet-5-5", "effort": "high", "index": 0}},
  {"seq": 10, "data": {"model": "claude-opus-5-5", "effort": "high", "index": 0}},
  {"seq": 12, "data": {"model": "claude-opus-5-5", "effort": "high", "index": 1}},
  {"seq": 16, "data": {"model": "claude-opus-5-5", "effort": "high", "index": 0}},
  {"seq": 18, "data": {"model": "claude-opus-5-5", "effort": "high", "index": 0}}
 ],
 "command.run": [
  {"seq": 6, "data": {"keys": ["command", "args", "origin", "presentation"]}},
  {"seq": 8, "data": {"keys": ["command", "args", "origin", "presentation"]}}
 ],
 "config.set": [
  {"seq": 7, "data": {"key": "model", "value": "opus", "previous": "sonnet"}}
 ],
 "report": [
  {"seq": 11, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}},
  {"seq": 19, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}}
 ]
}
```

### Pasada C — renderer clásico

```json
{
 "render.AbovePrompt": [
  {"seq": 0, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": false}, "bodyColumns": 90, "maxRows": 47}}
 ],
 "render.SessionMode": [
  {"seq": 1, "data": {"surface": "terminal", "viewport": {"columns": 95, "rows": 47, "isFullscreen": false}, "modes": []}}
 ],
 "session.start": [
  {"seq": 2, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}}
 ],
 "command.run": [
  {"seq": 3, "data": {"keys": ["command", "args", "origin", "presentation"]}}
 ],
 "prompt.submit": [
  {"seq": 4, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}},
  {"seq": 6, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}}
 ],
 "turn.step": [
  {"seq": 5, "data": {"model": "claude-opus-5-5", "effort": "high", "index": 0}},
  {"seq": 7, "data": {"model": "claude-opus-5-5", "effort": "high", "index": 0}}
 ],
 "report": [
  {"seq": 8, "data": {"model": "claude-opus-5-5", "effortSetting": "medium"}}
 ]
}
```
