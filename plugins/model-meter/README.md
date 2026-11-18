# model-meter

Mod para Claude Code que muestra qué modelo y qué nivel de esfuerzo está usando la sesión, con estética 8-bit, en el pie de la interfaz (y, opcionalmente, en una banda sobre el prompt).

> **Estado: esqueleto.** Esta versión no dibuja nada todavía: registra cero hooks y solo existe para que el repositorio pase por todos sus controles de calidad y seguridad. La funcionalidad llega en las tareas siguientes (`docs/tasks/`).

## Qué hará

- Mostrar el modelo de la sesión (`OPUS 5.5`, `SONNET 5.5`…) y un medidor de esfuerzo de 5 «píxeles».
- Solo **observar**: nunca cambia el modelo ni el esfuerzo, ni bloquea comandos como `/model` o `/effort`.
- Sin acceso a ficheros, procesos, red ni variables de entorno: lo comprueba la CI con `claude plugin validate`.

## Requisitos

Claude Code 2.1.327 o posterior (API de mods).

## Instalación

```text
/plugin marketplace add at0mikd/model-meter
/plugin install model-meter@model-meter
```

## Cómo probar

Probar el mod con `/model` o `/effort` cambia tu modelo o tu esfuerzo **por defecto** para las sesiones nuevas: Claude Code guarda lo que eliges. Anota tus valores antes de probar y restáuralos al terminar.

## Licencia

MIT
