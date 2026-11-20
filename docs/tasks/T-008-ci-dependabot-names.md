# T-008 · CI: commits de Dependabot y nombre estable del job del mod

- **Estado:** In review
- **Rama:** `chore/T-008-ci-dependabot-names`
- **Plan:** `docs/PLAN.md` §6; `docs/REPO-SETTINGS.md` §0 (paso 2 del ruleset)

## Objetivo

Que los checks se puedan exigir en el ruleset de `main` (paso 2 de `docs/REPO-SETTINGS.md` §0) sin bloquear a Dependabot ni depender de la versión de la CLI.

## Datos de partida

- **Dependabot escribe siempre «Bump» con mayúscula**, y commitlint lo rechaza por `subject-case`. Verificado en `3b10c21` (PR #8): `chore(deps-dev): Bump @types/node` → «subject must not be sentence-case». Prefijos reales según `.github/dependabot.yml`: `chore(deps)` y `chore(deps-dev)` para npm, y `ci(deps)` para GitHub Actions y para `tools/claude-cli`. Los commits llevan el trailer `Signed-off-by: dependabot[bot] <support@github.com>`.
- **El job del mod se llama `validate, test:mod, capabilities (claude CLI 2.1.327)`.** Cuando Dependabot actualice la CLI cambiará el nombre, y un check obligatorio con el nombre antiguo no llegaría nunca.

## Alcance

**Entra:**

1. **`scripts/commitlint-ignores.mjs`** (nuevo, sin dependencias), con una función pura `isDependabotBump(message: string): boolean` que devuelve `true` **solo** si se cumplen las dos condiciones:
   - la primera línea casa con `^(chore|ci)\((deps|deps-dev)\): Bump \S` (anclada; sin cuantificadores anidados);
   - el mensaje contiene la línea exacta `Signed-off-by: dependabot[bot] <support@github.com>`.

   `commitlint.config.js` la usa en `ignores: [isDependabotBump]`. Las demás reglas no cambian: cualquier otro commit sigue pasando por `subject-case`.
2. **Tests** en `scripts/commitlint-ignores.test.mjs`. Cobertura de `scripts/` ≥ 95 %.
   - **Positivos:** bump suelto de npm (`deps-dev`), bump agrupado (`Bump the dev-dependencies group …`), GitHub Actions (`ci(deps)`) y `tools/claude-cli` (`ci(deps)`). Todos con el trailer.
   - **Negativos:**
     - el asunto de Dependabot sin el trailer;
     - el trailer con otro asunto (`docs: Update readme`);
     - otro tipo (`feat(deps): Bump x`);
     - otro scope (`chore(deps-prod): Bump x`);
     - `Bump` sin nada detrás;
     - el trailer con otro correo o con `dependabot` sin `[bot]`;
     - un mensaje vacío.
   - **Integración:** el mensaje real de `3b10c21` como fixture → `true`.
3. **`.github/workflows/ci.yml`:** el job del mod pasa a llamarse **`mod (validate, test:mod, capabilities)`**, sin versión. La versión sigue visible en el log (paso `claude --version`). No cambia nada más del workflow.
4. **`docs/REPO-SETTINGS.md`:** en la tabla de checks obligatorios, el nombre nuevo del job del mod, y se quita el aviso de la versión.
5. **`SECURITY.md`:** una línea en «Para que una caducidad no pille por sorpresa». GitHub desactiva los workflows programados de un repositorio público tras 60 días sin actividad, y se reactivan desde la pestaña Actions.

**No entra:** cambiar `dependabot.yml`, relajar `subject-case` para el resto de commits, ni tocar el ruleset (lo aplica el Maintainer).

## Criterios de aceptación

- **CA1** — `npx commitlint --from <padre de 3b10c21> --to 3b10c21` pasa con la configuración nueva (o, si la rama de Dependabot ya no existe, el test con el mensaje real como fixture).
- **CA2** — Todos los tests positivos y negativos pasan; cobertura de `scripts/` ≥ 95 %.
- **CA3** — En la CI del PR, el job del mod aparece como `mod (validate, test:mod, capabilities)`.
- **CA4** — `npm run check` en verde; actionlint y zizmor sin hallazgos.

## Después de fusionar (Reviewer y Maintainer)

1. El Maintainer aplica el **paso 2** del ruleset (checks obligatorios con el nombre nuevo).
2. El Reviewer pide `@dependabot rebase` en #8 para que su CI corra con la configuración nueva. Si pasa, se revisa y se fusiona como cualquier PR.

## Restricciones de seguridad

- commitlint es un control de estilo, no de seguridad: un humano podría copiar el trailer de Dependabot. Por eso la excepción exige **a la vez** el patrón exacto y el trailer, y se limita a `subject-case` de commits de bump.
- Sin dependencias nuevas; regex anclada y sin cuantificadores anidados.
