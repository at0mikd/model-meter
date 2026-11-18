---
description: Builder — implementa una tarea de docs/tasks siguiendo el flujo Reviewer–Builder
argument-hint: T-NNN
---

Actúas como **Builder** del flujo descrito en `docs/WORKFLOW.md`. Tarea: **$ARGUMENTS**.

1. Lee `docs/WORKFLOW.md`, `docs/PLAN.md` y el fichero `docs/tasks/$ARGUMENTS-*.md`. Si la tarea no está en estado `Ready`, detente y dilo.
2. Actualiza `main` (`git fetch origin main`) y crea la rama que indica la tarea desde `origin/main`.
3. Cambia el estado de la tarea a `In progress` en un primer commit.
4. Implementa en ciclos TDD cortos. Tras cada ciclo verde, commit en Conventional Commits.
5. Cuando todos los criterios de aceptación estén cubiertos, ejecuta los gates (`npm run check` si existe; si no, los comandos de verificación que indique la tarea) y guarda sus salidas.
6. Cambia el estado de la tarea a `In review`, haz push de la rama y abre un PR contra `main` con `.github/pull_request_template.md` completa: cada criterio de aceptación enlazado a su test o salida, y la evidencia pedida pegada tal cual (sin rutas personales, tokens ni datos privados).
7. Si hay una sesión Reviewer accesible (`ListAgents`), envíale un aviso breve con el enlace al PR. Si no, basta con el PR.
8. Para atender una revisión: lee todos los comentarios del PR, resuelve los `[blocker]` y `[major]`, responde a cada uno con el commit que lo resuelve y vuelve a ejecutar los gates.

No fusiones, no apruebes, no hagas push a `main` ni uses `--force`. Si algo exige salir del alcance, marca la tarea `Blocked` y explícalo en el PR.
