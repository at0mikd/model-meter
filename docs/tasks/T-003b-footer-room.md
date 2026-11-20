# T-003b · Espacio real en el pie: la insignia a media pantalla junto a `sub-meter`

- **Estado:** Done ([#19](https://github.com/at0mikd/model-meter/pull/19), `872bfc8`)
- **Rama:** `fix/T-003b-footer-room`
- **Plan:** `docs/PLAN.md` §3.1; CA7 de T-003 ([#12](https://github.com/at0mikd/model-meter/pull/12#issuecomment-7005912032))

## Objetivo

Que a media pantalla (unas 95 columnas) la insignia aparezca cuando de verdad hay sitio, sin volver a pisar ni partir el pie. Es el uso principal del Maintainer.

## Datos de partida (CA7 de T-003)

- En reposo, con `sub-meter` y `auto mode on`, quedan unas **41 columnas libres a la vista** y `full` necesita **27** (hueco de 24 + separador). Aun así, la insignia **no sale**. Solo aparece mientras se escribe, como `modelOnly`.
- El cálculo reserva de más por dos motivos:
  1. **La pista cruda.** El hook de `PromptHint` mide `e.props.hint` tal como llega, con `(shift+tab to cycle)`, pero `sub-meter` oculta esa parte (`hideCycleHint`), así que en pantalla mide unas 23 columnas menos.
  2. **La etiqueta de modo pesimista.** Se reservan 26 columnas (`⏵⏵ bypass permissions on ·`) aunque la etiqueta real sea más corta (`⏵⏵ auto mode on ·`, unas 17) o no haya ninguna.

## Fase 1 · Medir (sin cambiar el comportamiento del mod)

Con el spike (`spikes/wic-spike`, desechable, con permiso para añadir observaciones pero no capacidades fuera de las que ya usa) o con un build local que no se sube, responde con datos, igual que en T-000:

- **P1 · Qué ve nuestro hook en `PromptHint`** con `sub-meter` activo: ¿la pista cruda o la recortada? ¿Qué devuelve `next(e)`: un nodo opaco del motor (`{ type: 'engine' }`) o un árbol con el texto? Hipótesis que hay que confirmar: `e.props.hint` **no** incluye la etiqueta de modo. Es la única forma de que cuadre la captura 9 de CA7 (escribiendo, ~95 columnas, sale `modelOnly`): si la incluyera, la reserva sería 4 + 26 + 35 + 2 + 29 = 96 > 95 y no saldría nada.
- **P2 · Orden de los hooks entre plugins.** Según los tipos (`TIERS`, `Tier`, `EngineCreateInput`), hay cinco tiers fijos (`prepend → user → append → builtin → core`, de fuera adentro). Un plugin no elige su tier. Dentro de un tier, los módulos se encadenan «in list order, first outermost», sin documentar cómo se ordena esa lista en `user`. Sin ajustes gestionados, la persona puede mover sus propios plugins a `prepend`/`append` con `prependPlugins`/`appendPlugins` en sus ajustes de usuario. Hay que medir:
  - el orden con `--plugin-dir` (`model-meter@inline`, como en CA7, donde `model-meter` quedó por fuera de `sub-meter`) **frente a** la instalación desde el marketplace (`model-meter@model-meter`), que es como lo usará la gente;
  - si es estable entre sesiones, tras `/reload-plugins` y tras reinstalar;
  - el efecto de listar uno u otro en `prependPlugins`/`appendPlugins`.
- **P3 · `permission_mode`.** Según los tipos, solo existe en los eventos clásicos (`BaseHookInput.permission_mode`) y en el `permissionMode` del spawn de un subagente. Ningún evento de mod avisa de un cambio de modo, `config.set` es solo para filas de `/config`, y los props de `SessionMode` no traen el modo de permisos. Hay que medir:
  - qué eventos clásicos lo traen y cuándo llegan: inicio de sesión, cada prompt, cada herramienta;
  - si llega alguno al cambiar de modo con shift+tab;
  - el **ciclo real de shift+tab** en la versión y configuración probadas: `bypassPermissions` solo aparece con `allowDangerouslySkipPermissions`, y `auto` solo si está activo;
  - cuánto mide en pantalla la etiqueta de cada modo del ciclo.
- **P4 · Desbordamiento:** si el árbol de `SessionMode` no cabe, ¿qué hace el motor: recorta la pista de la izquierda, recorta nuestro árbol o parte la fila? Pruébalo **solo** en un build local forzando una insignia ancha, nunca en el PR.

Resultados en `docs/spikes/T-003b-results.md`: tabla por pregunta, versión de la CLI, terminal y JSON saneado si lo hay.

## Fase 2 · Implementar según los datos

- **Pista:** medir lo que se dibuja, no `e.props.hint`. Si `next(e)` devuelve texto medible, medir ese árbol. Si es opaco, proponer en el PR la alternativa que permitan P1 y P2, con sus riesgos. No se oculta, recorta ni reescribe ninguna pista del motor ni de otro mod.
- **Etiqueta de modo:** reservar el ancho del modo real a partir de `permission_mode`, con una **tabla cerrada** de anchos por modo. Un modo desconocido o ausente reserva las 26 columnas de hoy. Si P3 confirma que un cambio con shift+tab no se ve hasta el siguiente evento clásico, mientras no llegue hay que reservar el máximo de los modos del ciclo. Si el ciclo incluye `bypassPermissions`, ese máximo vuelve a ser 26: documéntalo y propón otra solución en el PR. `permission_mode` nunca se dibuja: solo elige una fila de la tabla.
- **Independiente del orden:** el cálculo tiene que ser correcto quede `model-meter` por encima o por debajo de `sub-meter` (P2). Si en algún orden no se puede saber qué pista se dibuja, se reserva como hoy en ese caso.
- Se mantiene el orden `full → noMeter → modelOnly → none` y que **nunca** se pise ni se parta el pie.
- Si P4 muestra que el motor recorta la pista sin partir la fila, documéntalo y propón en el PR un cálculo menos pesimista. No lo implementes sin la aprobación del Reviewer.

## Criterios de aceptación

- **CA1** — P1–P4 respondidas con datos en `docs/spikes/T-003b-results.md`.
- **CA2** — Tests de mod con la pista cruda frente a la recortada, con cada `permission_mode` de la tabla y con uno desconocido (que reserva 26), a 95 y 191 columnas, con y sin un nodo de 30 columnas debajo.
- **CA3** — Capturas del Maintainer en el PR, con `model-meter` **instalado desde el marketplace** (como lo usará la gente; `--plugin-dir` solo como comparación), a unas 95 columnas con `sub-meter`:
  - en reposo con `auto mode on`, la insignia sale **completa**;
  - con `1 shell · ↓ to manage`, sale la variante que quepa o ninguna, **sin pisar ni partir** el pie;
  - tras cambiar de modo con shift+tab (a uno más largo y a uno más corto), tampoco pisa ni parte.
- **CA4** — `capabilities` en verde **sin ampliar la allowlist de llamadas**. Cualquier hook nuevo (por ejemplo, un evento clásico para leer `permission_mode`) solo observa, devuelve `next(e)` intacto y, si puede bloquear un evento, lleva `.catch` que deja pasar.
- **CA5** — `npm run check` en verde, con cobertura ≥ 95 % del núcleo.

## Restricciones de seguridad

- `permission_mode` y la pista son datos del motor: solo se miden o se comparan con una allowlist. Nunca se dibujan ni se guardan en `$.store`.
- Sin dependencias nuevas.

## Evidencia requerida

`docs/spikes/T-003b-results.md`, la salida de `npm run check` y `npm run capabilities`, y las capturas de CA3.
