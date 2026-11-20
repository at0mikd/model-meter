# T-004 · Banda 8-bit sobre el prompt y modo `auto`

- **Estado:** In progress
- **Rama:** `feat/T-004-band-auto`
- **Plan:** `docs/PLAN.md` §3.2, §3.3 (`placement`, `autoMinColumns`), §3.4 y §5

## Objetivo

A pantalla completa, model-meter puede mostrar además una **banda 8-bit** encima del prompt (`AbovePrompt`): un sprite original de la familia del modelo y un rótulo con el modelo y el esfuerzo. Cuándo se ve lo decide la opción `placement`:

- `footer` (por defecto): solo el pie, como hoy;
- `auto`: el pie, más la banda cuando la terminal es ancha;
- `band`: el pie, más la banda siempre que quepa.

El pie compacto de T-003, T-003b y T-009 **no cambia**.

## Datos de partida

- **Contrato de `AbovePrompt`** (tipos de la CLI 2.1.327):
  - se pregunta una vez por cada plugin que lo engancha, con `e.plugin` nombrando al plugin; un hook dibuja la fila de su plugin o pasa;
  - props de solo lectura: `hasSurvey` (hay una encuesta: hay que cederle el sitio), `isCollapsed` (la persona plegó la banda; el árbol se devuelve igual), `isWorking`, `maxRows` y `bodyColumns` (celdas útiles, ya descontadas las 5 del `[-]`);
  - una fila que no valida, o que pasa de los límites del árbol, no dibuja nada;
  - en la terminal, un árbol que lanza un error vacía la banda.
- **Medidas de T-000:**
  - `bodyColumns` = `columns − 5`: 90 a media pantalla y 186 maximizada;
  - `maxRows` = 47 con la sesión vacía y 18 en uso;
  - al cambiar el ancho de la ventana se redibujan `SessionMode` y `AbovePrompt`.
- **Opciones del plugin:** se declaran en `userConfig` de `plugin.json`, como hace `sub-meter`, y llegan a `register(on, options)`. Son entrada no confiable: se validan.
- **Decisión del Maintainer (CA7 de T-003):** el texto, en minúscula; solo el nombre del modelo empieza por mayúscula (`Opus 5.5`).

## Alcance

**Entra:**

1. **Opciones** en `plugin.json` (`userConfig`):
   - `placement`: `footer` | `auto` | `band`, por defecto `footer`;
   - `autoMinColumns`: número, por defecto `140`, entre 80 y 400.

   Una función pura del núcleo las valida: un valor que no es de la lista o está fuera de rango toma el valor por defecto, sin lanzar errores.
2. **Visibilidad de la banda**, como función pura del núcleo con histéresis, para que no parpadee al redimensionar:
   - con `footer`, nunca;
   - con `band`, siempre que quepa;
   - con `auto`, entra con `columns ≥ autoMinColumns` y sale con `columns < autoMinColumns − 20`; entre los dos umbrales mantiene lo que había;
   - en todos los casos, solo si `maxRows ≥ 6` y no hay encuesta (`hasSurvey`).
3. **Sprites**, como datos puros del núcleo: uno por familia (Opus, Sonnet, Haiku, Fable y desconocido).
   - **Diseño original**, sin parecido con personajes ni arte existentes.
   - Como mucho 4 filas por 8 columnas, con medios bloques (`▀ ▄ █` y espacio).
   - El mismo tamaño para todos.
   - Se pintan con el token de color de la familia (`familyColor`).
   - En el estado «desactivado» (§3.1.1), el sprite del desconocido, atenuado.
4. **Rótulo de la banda**, a la derecha del sprite, en minúscula salvo el modelo. Por ejemplo, `player Opus 5.5` y `power ▮▮▮▯▯ high`.
   - Usa las mismas piezas sanitizadas del núcleo que el pie (`badgeState`, `badgeRuns` o equivalentes).
   - Se ajusta a `bodyColumns`, en este orden: primero se quita el medidor, después el rótulo de esfuerzo y al final solo queda el sprite. Si ni el sprite cabe, la banda no se dibuja.
5. **Hook `ui.render { component: 'AbovePrompt' }`** en `register.tsx`, que solo cablea:
   - dibuja únicamente cuando `e.plugin === 'model-meter'` y la superficie es la terminal; con cualquier otro plugin o superficie, `return next(e)`;
   - si la banda no debe verse, pasa (`next(e)`);
   - el estado de la histéresis vive en el cierre del módulo, como `hintColumns`;
   - no añade llamadas a `$`.

**No entra:**

- paletas (`palette`) y `showEffortMeter`: van en otra tarea;
- `desktop` y `mobile`, donde el mod sigue sin dibujar nada;
- cualquier cambio en el pie, en su cálculo de espacio o en `$.store`;
- animaciones o temporizadores.

## Criterios de aceptación

- **CA1** — Tests de núcleo de la validación de opciones: valores válidos, los que no son de la lista, los de fuera de rango, los que no son números o textos, y `undefined`.
- **CA2** — Tests de núcleo de la visibilidad, en tabla:
  - `footer`, `band` y `auto` a 95, 119, 120, 139, 140 y 191 columnas, viniendo de banda visible y de banda oculta;
  - `maxRows` 5 frente a 6;
  - `hasSurvey`.
- **CA3** — Tests de núcleo de los sprites:
  - mismo tamaño para todas las familias, como mucho 4×8;
  - solo los glifos permitidos;
  - los cinco distintos entre sí;
  - el sprite atenuado en el estado `disabled`.
- **CA4** — Tests de mod de la banda:
  - dibuja con `e.plugin` igual a `model-meter`, y pasa con otro plugin o con `desktop`;
  - cede con `hasSurvey`;
  - con `auto`, pasar de 191 a 130 columnas la mantiene, de 130 a 110 la quita y de 110 a 191 la vuelve a poner;
  - con `footer`, nunca dibuja;
  - se ajusta a `bodyColumns` en el orden de la sección 4 del alcance.
- **CA5** — Los 46 tests de mod del pie siguen en verde y sin cambios. `capabilities` en verde, con las mismas llamadas a `$` que hoy. `npm run check` en verde.
- **CA6** — Documentación:
  - PLAN §3.2, con el rótulo en minúscula, y §3.3–§3.4 al día con lo implementado;
  - README del mod, con las opciones y una muestra en texto de la banda;
  - CHANGELOG.
- **CA7** — Capturas del Maintainer, con el mod instalado desde el marketplace y `placement: auto`:
  - maximizada (unas 190 columnas), con la banda visible;
  - a media pantalla (unas 95), sin banda y con el pie como hoy.

  El Maintainer da el visto bueno al aspecto de los sprites.

## Restricciones de seguridad

- Las opciones de `userConfig` son entrada no confiable: se validan con una lista cerrada y un rango, y nunca se dibujan tal cual.
- El rótulo solo dibuja texto ya sanitizado por el núcleo. Los sprites son constantes del código.
- No hay llamadas nuevas a `$`: la allowlist no cambia.
- Sin dependencias nuevas.
- Un error dentro del hook nunca deja la banda vacía para otros plugins: el hook solo dibuja la fila de model-meter, y si falla, pasa.

## Evidencia requerida

- La salida de `npm run check` y de `claude plugin validate`, con las capacidades.
- Las tablas de los tests de CA2.
- Una muestra en texto de la banda a 186 y a 90 celdas.
- Las capturas de CA7.
