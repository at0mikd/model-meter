# model-meter

Mod para Claude Code que muestra, en el pie de la terminal y con estética 8-bit, qué modelo y qué nivel de esfuerzo está usando la sesión:

```text
◆ opus 5.5 ▮▮▮▯▯ high · ⏵⏵ auto mode on
```

## Qué muestra

- **Modelo:** `◆` y el nombre corto (`opus 5.5`, `sonnet 5.5 1m`…) en el color de su familia, con tokens del tema (nunca ANSI crudo). Un modelo que no reconoce sale como `?` y atenuado.
- **Esfuerzo:** un medidor de 5 «píxeles» (`low` = 1 … `max` = 5) y su etiqueta (`low`, `med`, `high`, `xhi`, `max`). Un esfuerzo numérico (solo en builds internas) sale como `custom`, sin medidor.
- **En minúscula,** como el resto del pie (la etiqueta de modo, las pistas y otros mods).
- **En vivo:** se actualiza con cada turno, al momento con `/model` y como **pendiente** (`high…`, atenuado) tras `/effort`, hasta que el siguiente turno lo confirma.
- **Lo que falta se ve «apagado»,** como una ranura de cartucho vacía, sin cambiar de ancho:

  | Situación | Aspecto |
  | --- | --- |
  | Todo conocido | `◆ opus 5.5 ▮▮▮▯▯ high` |
  | Esfuerzo de una sesión anterior | `◆ opus 5.5` + `▮▮▯▯▯ med` atenuado |
  | Esfuerzo aún desconocido | `◆ opus 5.5 ░░░░░ ---` |
  | Nada leído todavía | `◇ ----- ░░░░░ ---` |

- **Se adapta al ancho:** comparte la fila con la etiqueta de modo, las pistas del motor (`esc to interrupt`, `1 shell · ↓ to manage`…) y otros mods como `sub-meter`. Si no cabe, pierde primero el medidor, después el esfuerzo y por último desaparece, sin tapar nunca lo que hay a su lado.
- **Solo en la terminal.** En la app de escritorio, VS Code o el móvil no dibuja nada: ya muestran el modelo y el esfuerzo.

## Qué hace y qué no

- **Solo observa:** no cambia el modelo ni el esfuerzo, y deja pasar intactos `/model`, `/effort` y cada turno, aunque algo suyo falle.
- **Datos que guarda:** solo el **último nivel de esfuerzo** (`low` … `max`), en el almacén del mod (`$.store`), para mostrarlo atenuado al abrir la siguiente sesión. Nada más: ni prompts, ni rutas, ni el id del modelo.
- **Sin acceso** a ficheros, procesos, red ni variables de entorno: lo comprueba la CI con `claude plugin validate` y una lista cerrada de capacidades.

## Requisitos

Claude Code 2.1.327 o posterior (API de mods).

## Instalación

```text
/plugin marketplace add at0mikd/model-meter
/plugin install model-meter@model-meter
```

## Cómo probar

1. Abre Claude Code en una terminal: la insignia aparece en el pie, abajo a la derecha.
2. Envía un prompt: el esfuerzo se enciende con el primer turno.
3. Prueba `/model` y `/effort` y vuelve a enviar un prompt.

> **Aviso:** `/model` y `/effort` cambian tu modelo y tu esfuerzo **por defecto** para las sesiones nuevas (Claude Code guarda lo que eliges). Anota tus valores antes de probar y restáuralos al terminar.

Para ver el estado «apagado» de una sesión nueva, abre la sesión sin un esfuerzo guardado (por ejemplo, en una instalación limpia del mod): antes del primer turno el esfuerzo sale como `░░░░░ ---`.

## Licencia

MIT
