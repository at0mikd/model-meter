# T-001 · Estructura del repo, gates locales y CI

- **Estado:** Ready
- **Rama:** `chore/T-001-scaffold`
- **Plan:** `docs/PLAN.md` §4, §6, §6.1, fase 1

## Objetivo

Dejar el repositorio listo para que todo el código posterior pase por los mismos controles de calidad y seguridad en local (`npm run check`) y en CI, con un mod vacío que valida.

## Alcance

**Entra:**
- `package.json` (`"private": true`, `"type": "module"`, `engines.node >= 22`) **sin dependencias de runtime**. devDependencies con versión exacta y `package-lock.json`: `typescript`, `eslint`, `typescript-eslint`, `eslint-plugin-security`, `prettier`, `c8`, `fast-check`. Cualquier otra requiere justificación en el PR.
- `tsconfig.base.json` estricto (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`).
- ESLint (`strict-type-checked` + `eslint-plugin-security`), Prettier, `.editorconfig`.
- Mod esqueleto `plugins/who-is-claude/` (manifest con `license: MIT`, `author`, `types`; `hooks/hooks.json`; `register.tsx` que registra cero hooks; `types/index.d.ts`; `tsconfig.json`; `README.md`) y `.claude-plugin/marketplace.json` en la raíz.
- `scripts/check-capabilities.mjs`: ejecuta `claude plugin validate plugins/who-is-claude`, extrae las líneas `calls:` y `env reads:` y falla si aparece algo fuera de la allowlist definida en el propio script (inicial: `$.session.model`, `$.settings.read`, `$.env.get`, `$.store.get`, `$.store.set`, `$.ui.*`, `$.clock.now`; env: `CLAUDE_CODE_EFFORT_LEVEL`). Con tests propios sobre salidas de ejemplo.
- Scripts npm: `typecheck`, `lint`, `format:check`, `test:node` (con `c8`, umbral 95 %), `test:mod`, `validate`, `capabilities`, y `check` que los encadena.
- Workflows en `.github/workflows/`:
  - `ci.yml`: `check` en matriz Node 22/24 × ubuntu/macos/windows para lo que no requiere la CLI; job con la CLI `claude` **fijada a versión exacta** para `validate`, `test:mod` y `capabilities`.
  - `codeql.yml` (javascript-typescript), `dependency-review.yml`, `scorecard.yml`, `gitleaks.yml` (historial completo), lint de workflows con `actionlint` y `zizmor`.
  - Todos con `permissions: contents: read` por defecto (ampliar solo por job y justificado), acciones fijadas por **SHA completo** con comentario de versión, `persist-credentials: false` en checkout, sin `pull_request_target`.
- `.github/dependabot.yml` (npm y github-actions, semanal, agrupado), `.github/CODEOWNERS`, `SECURITY.md` (reporte privado de vulnerabilidades de GitHub), `CONTRIBUTING.md` (enlaza a `docs/WORKFLOW.md`), `CHANGELOG.md`.
- Commitlint (Conventional Commits) en CI sobre los commits del PR.

**No entra:** lógica del mod (T-002 en adelante), configuración del repositorio en GitHub (protección de ramas, secret scanning: la hace el Maintainer, el PR debe listarla como checklist).

## Criterios de aceptación

- **CA1** — `npm ci && npm run check` pasa en local desde un clon limpio.
- **CA2** — `claude plugin validate plugins/who-is-claude` y `claude plugin validate .` pasan sin errores.
- **CA3** — `npm run capabilities` falla si se añade una llamada no permitida (demostrado con un test del script).
- **CA4** — Todos los workflows pasan en el PR; `actionlint` y `zizmor` sin hallazgos.
- **CA5** — Ninguna acción referenciada por tag o rama; todas por SHA.
- **CA6** — `npm ls --omit=dev` vacío (cero dependencias de runtime); `npm audit --audit-level=low` limpio.
- **CA7** — El PR incluye la checklist de ajustes de GitHub que debe aplicar el Maintainer (§6.1 del plan).

## Restricciones de seguridad

- Instalar con `npm ci --ignore-scripts` en CI; si la CLI `claude` necesita scripts de instalación, aislarlo en su job y documentarlo.
- Ningún secreto en workflows; el job de Scorecard usa solo `id-token: write` y `security-events: write` en su propio job.

## Evidencia requerida

Salidas de `npm run check`, `claude plugin validate`, `npm ls --omit=dev`, la demostración de CA3 y el enlace a la ejecución de CI.
