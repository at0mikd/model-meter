# Spikes

Código **desechable** para responder preguntas técnicas antes de diseñar. No se publica en el marketplace, no se importa desde `plugins/` y no está sujeto a los gates del producto (sí a la revisión de seguridad).

## wic-spike

Mod que observa, sin modificar nada, lo que el motor de Claude Code expone sobre modelo, esfuerzo y tamaño de pantalla, y lo devuelve mediante una herramienta de solo lectura (`report`).

- Eventos: `session.start`, `prompt.submit`, `turn.step` (solo observa), `config.set`, `command.run`, renders `SessionMode` y `AbovePrompt`.
- Lecturas: `$.session.model()`, `$.settings.read({ key: 'effortLevel' })`, variables `CLAUDE_CODE_EFFORT_LEVEL` y `CLAUDE_EFFORT`.
- No lee ficheros, no ejecuta procesos y no usa la red.

Uso (ver `docs/tasks/T-000-spike-terminal.md`):

```bash
claude --plugin-dir spikes/wic-spike
```
