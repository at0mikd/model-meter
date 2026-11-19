# T-003b · Espacio real en el pie: la insignia a media pantalla junto a `sub-meter`

- **Estado:** Ready
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

- **P1 · Qué ve nuestro hook en `PromptHint`** con `sub-meter` activo: ¿la pista cruda o la recortada? ¿Qué devuelve `next(e)`: un nodo opaco del motor (`{ type: 'engine' }`) o un árbol con el texto?
- **P2 · Orden de los hooks entre plugins:** ¿`model-meter` queda por encima o por debajo de `sub-meter`? ¿El orden es estable entre sesiones y tras recargas? ¿De qué depende (tier, nombre, orden de instalación)?
- **P3 · `permission_mode`:** el campo existe en los eventos clásicos (`BaseHookInput.permission_mode`). ¿Qué eventos lo traen y cuándo llegan (inicio de sesión, cada prompt, cada herramienta)? ¿Llega alguno al cambiar de modo con shift+tab? ¿Cuánto mide en pantalla la etiqueta de cada modo (`default`, `acceptEdits`, `plan`, `auto`, `bypassPermissions`, `dontAsk`) en la versión de la CLI que uses?
- **P4 · Desbordamiento:** si el árbol de `SessionMode` no cabe, ¿qué hace el motor: recorta la pista de la izquierda, recorta nuestro árbol o parte la fila? Pruébalo **solo** en un build local forzando una insignia ancha, nunca en el PR.

Resultados en `docs/spikes/T-003b-results.md`: tabla por pregunta, versión de la CLI, terminal y JSON saneado si lo hay.

## Fase 2 · Implementar según los datos

- **Pista:** medir lo que se dibuja, no `e.props.hint`. Si `next(e)` devuelve texto medible, medir ese árbol. Si es opaco, proponer en el PR la alternativa que permitan P1 y P2, con sus riesgos. No se oculta, recorta ni reescribe ninguna pista del motor ni de otro mod.
- **Etiqueta de modo:** reservar el ancho del modo real a partir de `permission_mode`, con una **tabla cerrada** de anchos por modo. Un modo desconocido o ausente reserva las 26 columnas de hoy. Si P3 muestra que un cambio con shift+tab no llega a tiempo, reservar el máximo entre el último modo conocido y el siguiente posible, o documentar el riesgo y proponer otra solución. `permission_mode` nunca se dibuja: solo elige una fila de la tabla.
- Se mantiene el orden `full → noMeter → modelOnly → none` y que **nunca** se pise ni se parta el pie.
- Si P4 muestra que el motor recorta la pista sin partir la fila, documéntalo y propón en el PR un cálculo menos pesimista. No lo implementes sin la aprobación del Reviewer.

## Criterios de aceptación

- **CA1** — P1–P4 respondidas con datos en `docs/spikes/T-003b-results.md`.
- **CA2** — Tests de mod con la pista cruda frente a la recortada, con cada `permission_mode` de la tabla y con uno desconocido (que reserva 26), a 95 y 191 columnas, con y sin un nodo de 30 columnas debajo.
- **CA3** — Capturas del Maintainer en el PR, a unas 95 columnas con `sub-meter`:
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
