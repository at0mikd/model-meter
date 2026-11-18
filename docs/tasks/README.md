# Tareas

Backlog del flujo Reviewer–Builder (`docs/WORKFLOW.md`). El Reviewer las escribe y las pasa a `Ready`; el Builder las ejecuta con `/build T-NNN`.

| ID | Título | Fase del plan | Estado |
| --- | --- | --- | --- |
| [T-000](T-000-spike-terminal.md) | Spike en terminal: `/model`, `/effort` y ancho del pie | 0 | Done |
| [T-001](T-001-scaffold.md) | Estructura del repo, gates locales y CI | 1 | Done |
| [T-002](T-002-pure-core.md) | Núcleo puro: modelo, esfuerzo y sanitización | 2 | Draft |
| [T-007](T-007-audit-expiry-warning.md) | Aviso anticipado de caducidad de excepciones y auditoría semanal | 1 | Ready |

## Formato de una tarea

Cabecera con `Estado`, `Rama`, `Plan`; después Objetivo, Alcance (entra / no entra), Criterios de aceptación (CA), Restricciones de seguridad y Evidencia requerida.
