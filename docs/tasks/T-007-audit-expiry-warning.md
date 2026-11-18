# T-007 · Aviso anticipado de caducidad de excepciones y auditoría semanal

- **Estado:** In progress
- **Rama:** `chore/T-007-audit-expiry-warning`
- **Plan:** `docs/PLAN.md` §6; T-001 «Excepciones de seguridad»

## Objetivo

Que la caducidad de una excepción de auditoría (hoy `GHSA-fc5q-39xc-vjpf`, el 2026-12-18) **no pille por sorpresa**: aviso visible con antelación y una auditoría periódica en `main` que no dependa de que haya PRs ni de ninguna sesión de Claude. Decisión del Maintainer (opción 3, 2026-11-18).

## Alcance

**Entra:**
- `scripts/audit.mjs`: si una excepción caduca en **14 días o menos** (UTC), emite un aviso. No falla: la caducidad sigue siendo la regla 2. El aviso sale:
  - en la salida estándar, con el GHSA, la fecha y los días que quedan;
  - como anotación de GitHub Actions (`::warning title=...::...`) cuando `GITHUB_ACTIONS === 'true'`, sin rutas ni datos del entorno.
  - El margen es una constante exportada (`EXPIRY_WARNING_DAYS = 14`) con tests en los límites (15, 14, 1 y 0 días) y con varias excepciones.
- `.github/workflows/audit-schedule.yml`:
  - Disparadores: `schedule` semanal (lunes, minuto no redondo) y `workflow_dispatch`.
  - Pasos: `npm ci --ignore-scripts` y `npm run audit` sobre `main`, más `npm audit --prefix tools/claude-cli --audit-level=low`.
  - Permisos: `permissions: contents: read` y nada más; acciones fijadas por SHA; `persist-credentials: false`.
  - Un fallo programado avisa al Maintainer por el correo estándar de GitHub. No se crean issues ni se usa ningún token con escritura.
- `SECURITY.md`: en «Excepciones activas», explicar el aviso a 14 días y la auditoría semanal.

**No entra:** renovar o cambiar ninguna excepción, crear issues automáticamente o tocar Dependabot.

## Criterios de aceptación

- **CA1** — Con una excepción que caduca dentro de ≤ 14 días, `npm run audit` termina con 0 e imprime el aviso; con > 14 días no hay aviso; caducada, falla como antes. Cada caso cubierto por un test.
- **CA2** — Bajo `GITHUB_ACTIONS=true`, el aviso sale como anotación `::warning` (test).
- **CA3** — `audit-schedule.yml` pasa actionlint y zizmor (también el perfil pedante); solo `contents: read`.
- **CA4** — Una ejecución manual (`workflow_dispatch`) del workflow sobre la rama del PR o tras la fusión queda en verde, con su enlace en el PR.
- **CA5** — `npm run check` en verde; cobertura de `scripts/` ≥ 95 %.

## Restricciones de seguridad

- Ningún permiso de escritura ni secreto en el workflow nuevo.
- El aviso no imprime rutas absolutas ni contenido del entorno.

## Evidencia requerida

Salida de `npm run audit` con una excepción simulada a 10 días (en test), salida de actionlint y zizmor, y el enlace a la ejecución de CA4.
