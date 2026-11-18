# T-001 · Estructura del repo, gates locales y CI

- **Estado:** Ready (revisada tras el handshake H-0 del Builder)
- **Rama:** `chore/T-001-scaffold`
- **Plan:** `docs/PLAN.md` §4, §6, §6.1, fase 1

## Objetivo

Dejar el repositorio listo para que todo el código posterior pase por los mismos controles de calidad y seguridad en local (`npm run check`) y en CI, con un mod vacío que valida.

## Alcance

**Entra:**
- `package.json` (`"private": true`, `"type": "module"`, `engines.node >= 22`) **sin dependencias de runtime**. devDependencies con versión exacta y `package-lock.json`: `typescript`, `@types/node`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-security`, `prettier`, `c8`, `fast-check`, `@commitlint/cli`, `@commitlint/config-conventional`. Cualquier otra requiere justificación en el PR.
- La CLI `claude` **no** es devDependency: en local, la global ≥ 2.1.327; en CI, `npm i -g @anthropic-ai/claude-code@2.1.327` (versión exacta, en su propio job). `validate` y `test` funcionan **sin autenticación** (verificado por el Reviewer con `HOME` vacío): ningún secreto en CI.
- `tsconfig.base.json` estricto (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`).
- **Tipos, en dos capas** (los tipos del motor no se versionan: son del motor, se regeneran por versión y `validate` no los escribe):
  - Núcleo puro (`plugins/who-is-claude/hooks/core/*.ts`, sin importar `claude-code`): `tsc -p tsconfig.core.json` propio, sin la CLI.
  - Hooks: `claude plugin validate --strict --json`. Con `--strict` falla ante los errores TypeScript que el validador reporta como avisos (verificado: un `const n: number = 'x'` hace salir con 1).
  - En local, si el motor ya ha escrito `.claude-plugin/types/` (al cargar el mod con `--plugin-dir`), `tsc -p plugins/who-is-claude` es un extra opcional, no un gate.
- ESLint (`strict-type-checked` + `eslint-plugin-security`), Prettier, `.editorconfig`.
- Mod esqueleto `plugins/who-is-claude/` (manifest con `license: MIT`, `author`, `types`; `hooks/hooks.json`; `register.tsx` que registra cero hooks; `types/index.d.ts`; `tsconfig.json`; `README.md`) y `.claude-plugin/marketplace.json` en la raíz.
- `scripts/check-capabilities.mjs`: ejecuta `claude plugin validate plugins/who-is-claude --json`, lee `contents[].notes` y extrae las entradas `calls:` y `env reads:` (sin depender de las rutas absolutas del informe, que nunca se imprimen ni se pegan como evidencia) y falla si aparece algo fuera de la allowlist definida en el propio script (inicial: `$.session.model`, `$.store.get`, `$.store.set`, `$.ui.*`, `$.clock.now`; env: ninguna — actualizado tras T-000). Además falla si algún elemento de `gatingHooks` del informe JSON no tiene `.catch` (`docs/PLAN.md` §2.4, decisión 6). Con tests propios sobre salidas de ejemplo.
- Scripts npm: `typecheck` (núcleo), `lint`, `format:check`, `test:node` (con `c8`, umbral 95 %), `commitlint`; `check:core` encadena los anteriores **sin la CLI**. `validate` (`--strict`), `test:mod`, `capabilities` requieren la CLI; `check` = `check:core` + esos tres.
- `node --test` en Node 22 solo elimina tipos de `.ts` (no `.tsx`, `enum`, `namespace` ni parameter properties): el núcleo puro y sus tests son `.ts` con sintaxis borrable (`erasableSyntaxOnly` en su tsconfig).
- `claude plugin test` sale con 1 si no hay tests: el esqueleto incluye un test mínimo del mod (p. ej., que `register` no registra hooks de escritura).
- Workflows en `.github/workflows/`:
  - `ci.yml`: `check:core` en matriz Node 22/24 × ubuntu/macos/windows; job ubuntu con la CLI fijada para `validate`, `test:mod` y `capabilities`.
  - `codeql.yml` (javascript-typescript), `dependency-review.yml`, `scorecard.yml` (push a `main` + semanal), `gitleaks.yml` (historial completo; binario oficial fijado por versión y **verificado por checksum SHA-256**, sin acción de terceros), lint de workflows con `actionlint` y `zizmor`.
  - Todos con `permissions: contents: read` por defecto (ampliar solo por job y justificado), acciones fijadas por **SHA completo** con comentario de versión, `persist-credentials: false` en checkout, sin `pull_request_target`.
- `.github/dependabot.yml` (npm y github-actions, semanal, agrupado), `.github/CODEOWNERS`, `SECURITY.md` (reporte privado de vulnerabilidades de GitHub), `CONTRIBUTING.md` (enlaza a `docs/WORKFLOW.md`), `CHANGELOG.md`.
- Commitlint (Conventional Commits) en CI sobre los commits del PR.

**No entra:** lógica del mod (T-002 en adelante), configuración del repositorio en GitHub (protección de ramas, secret scanning: la hace el Maintainer, el PR debe listarla como checklist).

## Criterios de aceptación

- **CA1** — `npm ci && npm run check` pasa en local desde un clon limpio, y `npm run check:core` pasa sin la CLI instalada.
- **CA2** — `claude plugin validate --strict plugins/who-is-claude` y `claude plugin validate .` pasan; un error de tipos introducido a propósito en `register.tsx` hace fallar `npm run validate` (demostrado y revertido).
- **CA3** — `npm run capabilities` falla si se añade una llamada no permitida (demostrado con un test del script).
- **CA4** — Todos los workflows que se disparan en `pull_request` pasan; `actionlint` y `zizmor` sin hallazgos.
- **CA5** — Ninguna acción referenciada por tag o rama; todas por SHA.
- **CA6** — `npm ls --omit=dev` vacío (cero dependencias de runtime); `npm audit --audit-level=low` limpio.
- **CA7** — El PR incluye la checklist de ajustes de GitHub que debe aplicar el Maintainer (§6.1 del plan).

## Restricciones de seguridad

- Instalar con `npm ci --ignore-scripts` en CI; si la CLI `claude` necesita scripts de instalación, aislarlo en su job y documentarlo.
- Ningún secreto en workflows; el job de Scorecard usa solo `id-token: write` y `security-events: write` en su propio job.

## Evidencia requerida

Salidas (con rutas absolutas redactadas) de `npm run check`, `claude plugin validate`, `npm ls --omit=dev`, la demostración de CA3 y el enlace a la ejecución de CI.
