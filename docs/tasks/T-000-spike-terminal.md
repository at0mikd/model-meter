# T-000 · Spike en terminal: `/model`, `/effort` y ancho del pie

- **Estado:** In review
- **Rama:** `spike/T-000-terminal`
- **Plan:** `docs/PLAN.md` §2.4

## Objetivo

Responder con datos reales de una terminal las dos incógnitas que la sesión cloud no puede observar: si un cambio con `/model` o `/effort` llega al mod antes del siguiente turno, y cuánto ancho queda en el pie (`SessionMode`) junto a otros mods como `sub-meter`.

## Alcance

**Entra:** ejecutar el spike `spikes/wic-spike` en local, recoger su informe y documentarlo.
**No entra:** código de producto, cambios en el plan (los propone el Reviewer tras leer los datos). Solo se puede tocar el spike para añadir observaciones, nunca capacidades nuevas fuera de las que ya usa.

## Procedimiento

1. `claude --plugin-dir spikes/wic-spike` en una terminal **a media pantalla**, con `sub-meter` activo.
2. Envía un prompt cualquiera y espera la respuesta.
3. Ejecuta `/model` y cambia de modelo; luego `/effort` y cambia de nivel. **No envíes prompt todavía.**
4. Pide: «llama a la herramienta report de wic-spike» (esto es un turno: anota que el informe incluye los eventos previos a él).
5. Maximiza la terminal a **pantalla completa**, envía otro prompt y vuelve a pedir el informe.
6. Para la pasada **sin** `sub-meter`: `/plugin` → desactívalo temporalmente, repite los pasos 1–5 y vuelve a activarlo al terminar.
7. Modo de pantalla completa de Claude Code: búscalo en `/config` o en la documentación de tu versión. Si existe, repite el paso 1 en ese modo y anota `viewport.isFullscreen`; si no lo encuentras en 10 minutos, marca CA4 como N/A con lo que buscaste.

El informe (`report`) devuelve JSON completo y parseable, agrupado por tipo de evento (hasta 40 entradas por tipo; los renders solo se registran cuando cambian), así que los eventos de `/model` y `/effort` no se pierden entre redibujados.

## Criterios de aceptación

- **CA1** — Se sabe si `/model` produce algún evento (`config.set`, `command.run`, `prompt.submit`, render) antes del siguiente `turn.step`, y con qué datos.
- **CA2** — Igual para `/effort`, incluido si `$.settings.read({ key: 'effortLevel' })` cambia tras usarlo.
- **CA3** — `viewport.columns` y `rows` registrados en media pantalla y pantalla completa, con y sin `sub-meter`.
- **CA4** — Valor de `viewport.isFullscreen` en terminal normal y en el modo de pantalla completa de Claude Code.
- **CA5** — Versión de Claude Code y sistema operativo / emulador de terminal anotados.

## Restricciones de seguridad

- Revisa el informe antes de publicarlo: solo nombres de modelo, niveles, eventos y tamaños. Elimina cualquier ruta, nombre de usuario, prompt o dato personal.
- El spike no se publica ni se importa desde el producto.

## Evidencia requerida

PR con `docs/spikes/T-000-results.md` que contenga los informes JSON (saneados) y una tabla con la respuesta a cada CA.
