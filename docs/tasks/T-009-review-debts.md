# T-009 · Deudas de revisión: medir lo que se dibuja en toda la fila y probar la guarda de commitlint

- **Estado:** In progress
- **Rama:** `fix/T-009-review-debts`
- **Plan:** `docs/PLAN.md` §3.1; revisiones de [#19](https://github.com/at0mikd/model-meter/pull/19) (hallazgo 2) y [#20](https://github.com/at0mikd/model-meter/pull/20) (nit 2)

## Objetivo

Que la insignia cuente con lo que de verdad se dibuja en su fila. Eso incluye los casos en que un mod de debajo envuelve la línea de pistas o cambia las etiquetas de modo del motor. Además, que la guarda de tipo de `isDependabotBump` tenga un test que la distinga.

## Datos de partida

- **Pista (`PromptHint`).** Desde T-003b, el hook mide la pista que recibe el eslabón del motor en `next.trace` (`drawnHintWidth`).
  - Cubre las dos formas documentadas de cambiar la línea: reescribir `hint` o añadir `tail`. También cubre un eslabón que dibuja la línea él mismo.
  - No cubre un eslabón de debajo que llama a `next(e)` y **envuelve** el nodo del motor en un árbol con más texto: solo se mide la pista del motor.
- **Etiquetas de modo (`SessionMode`).** El ancho del nodo del motor sale de `e.props.modes`, es decir, de los `modes` tal como **le llegan** a model-meter (`register.tsx`, cálculo de `below`).
  - Si un mod de debajo quita o añade etiquetas, el motor dibuja otras.
  - Es el mismo problema que T-003b resolvió para la pista.
- **Contrato** (tipos de la CLI 2.1.327):
  - `next.trace` lista los eslabones de debajo: el más cercano primero y el motor (el par `engine`/`core`) el último;
  - `next(e)` resuelve a lo que dibujan los de debajo. En `PromptHint`, sin envolturas, es el nodo opaco del motor, `{ type: 'engine' }` (T-003b, P1).
  - Si el arnés o el motor no dejan ver el nodo del motor dentro de un árbol que lo envuelve, se marca la tarea `Blocked` y se explica (`docs/WORKFLOW.md` §8).
- **commitlint.** Sin la guarda `typeof message !== 'string'`, `RegExp.test` convierte el valor a texto: `undefined`, `null` y `42` siguen dando `false`, y el mutante sobrevive (revisión de #20).

## Alcance

**Entra:**

1. **La pista, medida como se dibuja, también con envolturas.**
   - El ancho de la línea es el del árbol que devuelve `next(e)`. El nodo del motor cuenta con el ancho de la pista que recibió el eslabón del motor, que es lo que hoy da `drawnHintWidth`.
   - Si el resultado no es un árbol reconocible, se mide como hoy.
   - La lógica pura va en el núcleo, por ejemplo con `widthOfTree(result, engineWidth)`, que ya usa `SessionMode`.
2. **Las etiquetas de modo, como se dibujan.** El ancho del nodo del motor en `SessionMode` sale de los `modes` que recibió el eslabón del motor según `next.trace` (el par `engine`/`core`). Si el trace no lo dice, se usa `e.props.modes`, como hoy.
3. **Test de la guarda de commitlint.** Un objeto cuyo `toString()` devuelve un asunto de bump da `false` y no lanza ningún error. Sin la guarda, el test falla.

**No entra:**

- cambiar la reserva de 26 columnas de la etiqueta de modo ni el orden `full → noMeter → modelOnly → none`;
- los mods que están **por encima**, porque sus cambios no se ven desde aquí;
- dibujar nada de otros mods: solo se mide.

## Criterios de aceptación

- **CA1** — Tests de núcleo para la medición de la línea, con la cobertura del núcleo al 100 %:
  - solo el nodo del motor;
  - el nodo del motor envuelto con texto delante y detrás;
  - un árbol propio sin nodo del motor;
  - un resultado no reconocible, que se mide como hoy.
- **CA2** — Tests de mod a 95 columnas:
  - un mod en `append` envuelve la línea de pistas con unas 10 columnas más: la insignia las cuenta y cede (el test calcula la variante esperada);
  - un mod en `append` quita `focus` de los `modes`: la insignia gana ese sitio;
  - un mod en `append` añade una etiqueta: la insignia cede;
  - sin ningún mod, todo sale igual que hoy.
- **CA3** — Existe el test de la guarda de commitlint, y la salida de ese test con la guarda quitada muestra que falla.
- **CA4** — `capabilities` en verde, con las mismas llamadas a `$` que hoy, y `npm run check` en verde.
- **CA5** — PLAN §3.1 y el README del mod dicen que se mide lo que se dibuja, también las etiquetas de modo y las envolturas.

## Restricciones de seguridad

- Lo que llega de otros mods (`next.trace` y el resultado de `next(e)`) solo se mide, con la profundidad acotada de `widthOfTree`. Nunca se dibuja ni se guarda.
- Los hooks devuelven intacto el resultado de `next(e)`.
- Sin dependencias nuevas.

## Evidencia requerida

- La salida de `npm run check` y de `npm run capabilities`.
- La lista de tests nuevos.
- Para CA3, la salida del test con la guarda quitada.
