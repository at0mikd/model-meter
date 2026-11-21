# Tareas

Backlog del flujo Reviewer–Builder (`docs/WORKFLOW.md`). El Reviewer las escribe y las pasa a `Ready`; el Builder las ejecuta con `/build T-NNN`.

| ID | Título | Fase del plan | Estado |
| --- | --- | --- | --- |
| [T-000](T-000-spike-terminal.md) | Spike en terminal: `/model`, `/effort` y ancho del pie | 0 | Done |
| [T-001](T-001-scaffold.md) | Estructura del repo, gates locales y CI | 1 | Done |
| [T-002](T-002-pure-core.md) | Núcleo puro: modelo, esfuerzo, sanitización y encaje por ancho | 2 | Done |
| [T-003](T-003-compact-footer.md) | Modo compacto en el pie | 3 | Done |
| [T-003b](T-003b-footer-room.md) | Espacio real en el pie: la insignia a media pantalla junto a `sub-meter` | 3 | Done |
| [T-004](T-004-band-auto.md) | Banda 8-bit sobre el prompt y modo `auto` | 4 | In review |
| [T-007](T-007-audit-expiry-warning.md) | Aviso anticipado de caducidad de excepciones y auditoría semanal | 1 | Done |
| [T-008](T-008-ci-dependabot-names.md) | CI: commits de Dependabot y nombre estable del job del mod | 1 | Done |
| [T-009](T-009-review-debts.md) | Deudas de revisión: medir lo que se dibuja en toda la fila y probar la guarda de commitlint | 3 | Done |

## Formato de una tarea

Cabecera con `Estado`, `Rama`, `Plan`; después Objetivo, Alcance (entra / no entra), Criterios de aceptación (CA), Restricciones de seguridad y Evidencia requerida.
