# Spikes

Código **desechable** para responder preguntas técnicas antes de diseñar. No se publica en el marketplace, no se importa desde `plugins/` y no está sujeto a los gates del producto (sí a la revisión de seguridad).

## wic-spike

Mod que observa, sin modificar nada, lo que el motor de Claude Code expone sobre modelo, esfuerzo y tamaño de pantalla, y lo devuelve mediante una herramienta de solo lectura (`report`).

- Eventos: `session.start`, `prompt.submit`, `turn.step` (solo observa), `config.set`, `command.run`, renders `SessionMode` y `AbovePrompt`.
- Para T-003b:
  - el render `PromptHint`: la pista tal como la recibe el spike;
  - en `PromptHint` y `SessionMode`, la cadena de hooks que queda debajo (`next.trace`), con el plugin, el tier, los props que recibió cada eslabón (el del motor es lo que se dibuja) y la forma de lo que devuelve `next(e)`;
  - el `permission_mode` de cada evento clásico (`classic.*`).

  Todo pasa tal como llegó, también si el hook falla.
- Lecturas: `$.session.model()`, `$.settings.read({ key: 'effortLevel' })`, variables `CLAUDE_CODE_EFFORT_LEVEL` y `CLAUDE_EFFORT`.
- No lee ficheros, no ejecuta procesos y no usa la red.

Uso (ver `docs/tasks/T-000-spike-terminal.md`):

```bash
claude --plugin-dir spikes/wic-spike
```
