# T-003b · Resultados de la medición (fase 1)

- **Tarea:** [`docs/tasks/T-003b-footer-room.md`](../tasks/T-003b-footer-room.md)
- **Fecha:** 2026-11-19
- **Spike:** `spikes/wic-spike` con las observaciones de T-003b (54e129a). No llama a nada nuevo en `$`.

## Entorno

| Dato | Valor |
| --- | --- |
| Claude Code | 2.1.328 |
| Sistema operativo | Fedora Linux 44 (x86_64) |
| Terminal | tmux 3.8 con servidor propio, ventana fijada a **95 × 47** y **191 × 47** |
| Renderer | `fullscreen` |
| Otros mods | `sub-meter` 0.4.4, `context-meter` 0.1.0, `quick-peek` 0.2.0 e `image-preview` 0.2.2 (`better-claude`) |
| Modelo y esfuerzo | Opus 5.5, `xhigh` |

## Método

- **Sesiones:** el Builder las dirige en tmux con `claude --plugin-dir spikes/wic-spike [--plugin-dir plugins/model-meter]`, sin las variables de entorno de su propia sesión. Solo envía prompts triviales.
- **Pie:** se lee como texto con `tmux capture-pane`, columna a columna.
- **Informe del spike:** su herramienta `report`, leída del `toolUseResult` del transcript de esa sesión.
- **Pasadas:**

| Pasada | Carga de model-meter | Qué se hizo |
| --- | --- | --- |
| A | `--plugin-dir` | reposo, un turno, 8 shift+tab, escribiendo, shell en segundo plano, `report` |
| C | `--plugin-dir` | un prompt en cada modo; `dontAsk` con `--permission-mode` |
| B | marketplace del clon local | reposo, ciclo, 191 columnas, `/reload-plugins`, `prependPlugins` con `--settings` |
| P4 | build local en una carpeta temporal, fuera del repo | badge forzado a sobrar |

## P1 · Qué ve el hook de `PromptHint` y qué devuelve `next(e)`

Pasada A: model-meter queda por fuera de `sub-meter`.

| Momento | `e.props.hint` que recibe model-meter | Lo que recibe el motor (se dibuja) |
| --- | --- | --- |
| arranque | `(shift+tab to cycle) · ← for agents` (35) | `← for agents` (12) |
| reposo, auto | `(shift+tab to cycle)` (20) | `''` (0) |
| trabajando | `(shift+tab to cycle) · esc to interrupt` | `''` |
| modo manual | `? for shortcuts` (15) | `? for shortcuts` (15) |
| shell en segundo plano | `1 shell · ↓ to manage` (21) | igual |
| shell y trabajando | `1 shell · esc to interrupt · ↓ to manage` (40) | `1 shell · ↓ to manage` (21) |

- **Recibe la pista cruda.** Por eso reserva de más. `sub-meter` (eslabón 4) quita `(shift+tab to cycle)` y `esc to interrupt`, y `context-meter` ya recibe la pista recortada.
- **`next(e)` en `PromptHint` es opaco:** `{ type: 'engine', ref }`.
- **`next.trace` sí da lo que se dibuja.** Tras `await next(e)` lista los eslabones de debajo, el motor el último, y el `received.props.hint` del motor es la pista tal como se dibuja. Esto vale tanto si model-meter queda por encima de `sub-meter` como por debajo.
- **Hipótesis confirmada:** en reposo, `hint` **no** incluye la etiqueta de modo; el motor la dibuja aparte, seguida de ` · `.
- **Excepción transitoria:** justo después de un shift+tab llega un render cuya pista lleva el nombre del modo **anterior**, por ejemplo `auto mode on (shift+tab to cycle)` o `manual mode on · ? for shortcuts`. En seguida vuelve a la pista normal.

## P2 · Orden de los hooks entre plugins

| Carga | Orden (`next.trace`, 0 = el de fuera) | Insignia | Pista que recibe model-meter |
| --- | --- | --- | --- |
| `--plugin-dir` (CA7) | 0 wic-spike, 1 model-meter, 2 quick-peek, 3 image-preview, 4 sub-meter, 5 context-meter, 6 engine | a la izquierda de `sub-meter` | cruda |
| marketplace | …, sub-meter, context-meter, **model-meter**, engine | **a la derecha** de `sub-meter` | recortada |

- **Todos en el tier `user`.** Primero van los `--plugin-dir`, en el orden de los flags. Después, los instalados, en el orden de `enabledPlugins`: al instalar, model-meter se añadió al final de esa lista.
- **Estabilidad:** el orden se mantiene tras `/reload-plugins` y entre sesiones, porque el orden de `enabledPlugins` es persistente. No se probó a reinstalar; lo esperable es que vuelva al final.
- **`prependPlugins`:**
  - con `--settings` no tiene efecto;
  - en los ajustes de usuario no se probó, porque cambiaría los ajustes del Maintainer. Según la referencia de mods, mueve el plugin al tier `prepend`.
- **Instalado desde el marketplace**, model-meter no ve a `sub-meter`: la deja encima.
  - Elige la variante sin contar con ella.
  - `sub-meter`, que sí mide lo que tiene debajo, se adapta: en modo manual a 95 columnas quitó su barra (`week 19% ↻ 6d 4h`).
  - El pie no se parte, pero la insignia gana el espacio.
  - El relleno a la izquierda del hueco se ve como un espacio tras el separador: `98% ↻ 1h 8m ·     ◆ Opus 5.5 ░░░░░ ---`.

## P3 · `permission_mode`

- **Lo traen:** `UserPromptSubmit`, `Stop`, `PostToolUse`, `PostToolBatch` y `SubagentStop`.
- **No lo traen:** `SessionStart`, `InstructionsLoaded`, `PreToolUse` y `MessageDisplay`.
- **shift+tab no produce ningún evento**, ni clásico ni de mod: solo renders de `PromptHint` y `SessionMode`.
- **Ciclo real**, sin flag de bypass: `auto` → `default` («manual mode on») → `acceptEdits` → `plan` → `auto`.
  - `dontAsk` solo se alcanza con `--permission-mode` y sale del ciclo con el primer shift+tab.
  - **bypass no se midió en vivo.** `--allow-dangerously-skip-permissions` pide aceptar un aviso que se guarda en la configuración global del Maintainer, así que no se aceptó.
- **Valor de cada modo**, por el `permissionMode` del transcript en cada prompt: `auto`, `default`, `acceptEdits`, `plan`.

| `permission_mode` | Etiqueta (con ` ·`) | Columnas |
| --- | --- | --- |
| `auto` | `⏵⏵ auto mode on ·` | 17 |
| `default` | `⏸ manual mode on ·` | 18 |
| `acceptEdits` | `⏵⏵ accept edits on ·` | 20 |
| `plan` | `⏸ plan mode on ·` | 16 |
| `dontAsk` | `⏵⏵ don't ask on ·` | 17 |
| `bypassPermissions` | `⏵⏵ bypass permissions on ·` | 26 (de T-003, sin medir en vivo) |

Los anchos coinciden con `widthOf` del mod y con lo que se ve en pantalla.

## P4 · Desbordamiento

Probado con un build local que dibuja siempre `full` más 40 columnas de relleno. **El motor parte el pie:**
- la pista se queda en su fila;
- el árbol de `SessionMode` baja a una fila propia;
- si tampoco cabe ahí, el texto continúa en una tercera fila.

No recorta ni la pista ni el árbol, así que no hay margen para un cálculo menos pesimista que se apoye en que el motor recorte.

```text
  ⏵⏵ auto mode on · ← for agents
      ◆ Opus 5.5 ▮▮▮▮▯ xhi####################################### · 5h ━━━━━━━━━━ 97% ↻ 1h 9m
                          #
```

## La fórmula actual predice lo observado

La reserva es `4 + 26 + (1 + pista) + 2 + (3 + debajo)`, y lo que queda se compara con los huecos de 24 (`full`), 18 (`noMeter`) y 12 (`modelOnly`). A 95 columnas, con `sub-meter` (26 o 27 columnas) debajo:

| Caso | Pista medida hoy | Queda hoy | Observado | Con la pista dibujada | Con etiqueta exacta |
| --- | --- | --- | --- | --- | --- |
| reposo, auto | 20 | 12 | `modelOnly` | 33: `full` | 42: `full` |
| modo manual | 15 | 17–18 | `modelOnly` / `noMeter` | igual | 25–26: `full` |
| shell, auto | 21 | 12 | `modelOnly` | 12: `modelOnly` | 21: `noMeter` |

## Informe (extracto saneado, pasada A)

Contiene solo plugins, tiers, pistas y tamaños, sin rutas, prompts ni datos personales.

```json
{
 "render.PromptHint": [
  {
   "seq": 7,
   "columns": 95,
   "isWorking": false,
   "beneath": [
    {
     "index": 1,
     "plugin": "model-meter",
     "tier": "user",
     "hint": "(shift+tab to cycle)"
    },
    {
     "index": 2,
     "plugin": "quick-peek",
     "tier": "user",
     "hint": "(shift+tab to cycle)"
    },
    {
     "index": 3,
     "plugin": "image-preview",
     "tier": "user",
     "hint": "(shift+tab to cycle)"
    },
    {
     "index": 4,
     "plugin": "sub-meter",
     "tier": "user",
     "hint": "(shift+tab to cycle)"
    },
    {
     "index": 5,
     "plugin": "context-meter",
     "tier": "user",
     "hint": ""
    },
    {
     "index": 6,
     "plugin": "engine",
     "tier": "core",
     "hint": ""
    }
   ],
   "result": {
    "type": "engine",
    "keys": [
     "type",
     "ref"
    ]
   }
  },
  {
   "seq": 15,
   "columns": 95,
   "isWorking": true,
   "beneath": [
    {
     "index": 1,
     "plugin": "model-meter",
     "tier": "user",
     "hint": "(shift+tab to cycle) · esc to interrupt"
    },
    {
     "index": 2,
     "plugin": "quick-peek",
     "tier": "user",
     "hint": "(shift+tab to cycle) · esc to interrupt"
    },
    {
     "index": 3,
     "plugin": "image-preview",
     "tier": "user",
     "hint": "(shift+tab to cycle) · esc to interrupt"
    },
    {
     "index": 4,
     "plugin": "sub-meter",
     "tier": "user",
     "hint": "(shift+tab to cycle) · esc to interrupt"
    },
    {
     "index": 5,
     "plugin": "context-meter",
     "tier": "user",
     "hint": ""
    },
    {
     "index": 6,
     "plugin": "engine",
     "tier": "core",
     "hint": ""
    }
   ],
   "result": {
    "type": "engine",
    "keys": [
     "type",
     "ref"
    ]
   }
  },
  {
   "seq": 29,
   "columns": 95,
   "isWorking": false,
   "beneath": [
    {
     "index": 1,
     "plugin": "model-meter",
     "tier": "user",
     "hint": "auto mode on (shift+tab to cycle)"
    },
    {
     "index": 2,
     "plugin": "quick-peek",
     "tier": "user",
     "hint": "auto mode on (shift+tab to cycle)"
    },
    {
     "index": 3,
     "plugin": "image-preview",
     "tier": "user",
     "hint": "auto mode on (shift+tab to cycle)"
    },
    {
     "index": 4,
     "plugin": "sub-meter",
     "tier": "user",
     "hint": "auto mode on (shift+tab to cycle)"
    },
    {
     "index": 5,
     "plugin": "context-meter",
     "tier": "user",
     "hint": "auto mode on"
    },
    {
     "index": 6,
     "plugin": "engine",
     "tier": "core",
     "hint": "auto mode on"
    }
   ],
   "result": {
    "type": "engine",
    "keys": [
     "type",
     "ref"
    ]
   }
  },
  {
   "seq": 84,
   "columns": 95,
   "isWorking": true,
   "beneath": [
    {
     "index": 1,
     "plugin": "model-meter",
     "tier": "user",
     "hint": "1 shell · esc to interrupt · ↓ to manage"
    },
    {
     "index": 2,
     "plugin": "quick-peek",
     "tier": "user",
     "hint": "1 shell · esc to interrupt · ↓ to manage"
    },
    {
     "index": 3,
     "plugin": "image-preview",
     "tier": "user",
     "hint": "1 shell · esc to interrupt · ↓ to manage"
    },
    {
     "index": 4,
     "plugin": "sub-meter",
     "tier": "user",
     "hint": "1 shell · esc to interrupt · ↓ to manage"
    },
    {
     "index": 5,
     "plugin": "context-meter",
     "tier": "user",
     "hint": "1 shell · ↓ to manage"
    },
    {
     "index": 6,
     "plugin": "engine",
     "tier": "core",
     "hint": "1 shell · ↓ to manage"
    }
   ],
   "result": {
    "type": "engine",
    "keys": [
     "type",
     "ref"
    ]
   }
  },
  {
   "seq": 89,
   "columns": 95,
   "isWorking": false,
   "beneath": [
    {
     "index": 1,
     "plugin": "model-meter",
     "tier": "user",
     "hint": "1 shell · ↓ to manage"
    },
    {
     "index": 2,
     "plugin": "quick-peek",
     "tier": "user",
     "hint": "1 shell · ↓ to manage"
    },
    {
     "index": 3,
     "plugin": "image-preview",
     "tier": "user",
     "hint": "1 shell · ↓ to manage"
    },
    {
     "index": 4,
     "plugin": "sub-meter",
     "tier": "user",
     "hint": "1 shell · ↓ to manage"
    },
    {
     "index": 5,
     "plugin": "context-meter",
     "tier": "user",
     "hint": "1 shell · ↓ to manage"
    },
    {
     "index": 6,
     "plugin": "engine",
     "tier": "core",
     "hint": "1 shell · ↓ to manage"
    }
   ],
   "result": {
    "type": "engine",
    "keys": [
     "type",
     "ref"
    ]
   }
  }
 ],
 "render.SessionMode": [
  {
   "seq": 100,
   "columns": 95,
   "modes": [],
   "beneath": [
    {
     "index": 1,
     "plugin": "model-meter",
     "tier": "user"
    },
    {
     "index": 2,
     "plugin": "quick-peek",
     "tier": "user"
    },
    {
     "index": 3,
     "plugin": "image-preview",
     "tier": "user"
    },
    {
     "index": 4,
     "plugin": "sub-meter",
     "tier": "user"
    },
    {
     "index": 5,
     "plugin": "context-meter",
     "tier": "user"
    },
    {
     "index": 6,
     "plugin": "engine",
     "tier": "core"
    }
   ]
  }
 ],
 "classic": [
  {
   "seq": 4,
   "event": "classic.InstructionsLoaded"
  },
  {
   "seq": 5,
   "event": "classic.SessionStart"
  },
  {
   "seq": 18,
   "event": "classic.UserPromptSubmit",
   "permission_mode": "auto"
  },
  {
   "seq": 21,
   "event": "classic.MessageDisplay"
  },
  {
   "seq": 22,
   "event": "classic.Stop",
   "permission_mode": "auto"
  },
  {
   "seq": 76,
   "event": "classic.UserPromptSubmit",
   "permission_mode": "auto"
  },
  {
   "seq": 80,
   "event": "classic.PreToolUse"
  },
  {
   "seq": 82,
   "event": "classic.PostToolUse",
   "permission_mode": "auto"
  },
  {
   "seq": 83,
   "event": "classic.PostToolBatch",
   "permission_mode": "auto"
  },
  {
   "seq": 86,
   "event": "classic.MessageDisplay"
  },
  {
   "seq": 87,
   "event": "classic.Stop",
   "permission_mode": "auto"
  },
  {
   "seq": 91,
   "event": "classic.SubagentStop",
   "permission_mode": "auto"
  },
  {
   "seq": 98,
   "event": "classic.UserPromptSubmit",
   "permission_mode": "auto"
  },
  {
   "seq": 101,
   "event": "classic.PreToolUse"
  }
 ]
}
```
