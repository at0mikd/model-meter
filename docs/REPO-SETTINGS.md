# Configuración del repositorio en GitHub

> Lo que el Maintainer configura a mano en GitHub. Ningún agente cambia la configuración del repositorio (`docs/WORKFLOW.md` §7). Es el **control real** que respalda el flujo: sin él, GitHub permite fusionar con checks en rojo, hacer push directo a `main` o reescribir su historia.

**Estado a 2026-11-20: pasos 1 y 2 aplicados y verificados.**
- La verificación se hizo por la API de solo lectura, con `gh api` desde la sesión del Builder. La sesión en la nube no puede leer esa API.
- Ruleset `main` (id `27628705`), activo, con objetivo `~DEFAULT_BRANCH` y sin bypass. Reglas efectivas en `main`:
  - `deletion`, `non_fast_forward`, `required_linear_history` y `required_signatures`;
  - `pull_request` con 0 aprobaciones y solo `squash`;
  - `required_status_checks`: los 12 checks de la tabla, todos de GitHub Actions, con `strict_required_status_checks_policy: true` (la rama tiene que estar al día con `main`);
  - `code_scanning`: CodeQL, con alertas de seguridad `high_or_higher` y alertas `errors`.
- El primer PR fusionado con el paso 2 fue #19.

## 0. Orden de aplicación

1. ✅ (2026-11-19) El ruleset de la sección 1 **sin** la regla *Require status checks to pass*. Ya protegía contra borrado, force-push, push directo y fusiones que no fueran squash. Mientras tanto, que los checks estuvieran en verde lo garantizaba el Reviewer (`docs/WORKFLOW.md` §6).
2. ✅ (2026-11-20, tras T-008) *Require status checks to pass* con la lista de checks. T-008 dejó estable el nombre del job del mod e hizo que los PRs de Dependabot pasen commitlint. Exigirlos antes habría bloqueado a Dependabot y dejado el check del mod esperando un nombre que cambia.

## 1. Ruleset de `main`

**Settings → Rules → Rulesets → New ruleset → New branch ruleset**

| Campo | Valor |
| --- | --- |
| Ruleset name | `main` |
| Enforcement status | **Active** |
| Bypass list | **Vacía.** Cualquier actor con bypass hace que Scorecard considere que la regla no se aplica a administradores |
| Target branches | *Add target* → **Include default branch** |

Reglas que hay que marcar:

| Regla | Configuración | Por qué |
| --- | --- | --- |
| **Restrict deletions** | ✓ | Nadie borra `main` (Scorecard, Tier 1) |
| **Block force pushes** | ✓ | Nadie reescribe la historia publicada (Scorecard, Tier 1) |
| **Require linear history** | ✓ | Solo squash, sin merges en `main` |
| **Require signed commits** | ✓ | El squash lo firma GitHub (verificado) |
| **Require a pull request before merging** | ✓ · *Required approvals*: **0** · *Allowed merge methods*: **Squash** | Una sola cuenta humana: GitHub no deja aprobar un PR propio. La aprobación queda en la conversación con el Reviewer (`docs/WORKFLOW.md` §6) |
| **Require status checks to pass** | ✓ · **Require branches to be up to date before merging** ✓ · los 12 checks de la tabla siguiente | Evita fusionar en rojo, y que la CI pruebe una mezcla con un `main` antiguo |
| **Require code scanning results** (opcional) | Tool **CodeQL** · *Security alerts*: **High or higher** · *Alerts*: **Errors** | Bloquea alertas nuevas graves de CodeQL |

> **`require_extra_approval_for_unattributed_changes: true`.** GitHub lo activa por defecto en todos los rulesets, nuevos y existentes (regla [«Additional approval for unattributed Copilot pull requests»](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), en *public preview*; verificado en la documentación oficial el 2026-11-19). Solo exige una aprobación extra cuando el agente de Copilot abre un PR no atribuido a una persona. Nuestros PRs salen atribuidos al Maintainer y Dependabot no es Copilot, así que no nos afecta. Se deja activo, porque protege si algún día se usa Copilot, y se revisará cuando salga de *preview*.

Checks obligatorios. Los nombres son exactos y al añadirlos se elige *GitHub Actions* como origen:

| Check | Workflow |
| --- | --- |
| `check:core (Node 22, ubuntu-latest)` | CI |
| `check:core (Node 22, macos-latest)` | CI |
| `check:core (Node 22, windows-latest)` | CI |
| `check:core (Node 24, ubuntu-latest)` | CI |
| `check:core (Node 24, macos-latest)` | CI |
| `check:core (Node 24, windows-latest)` | CI |
| `mod (validate, test:mod, capabilities)` | CI |
| `Analyze (javascript-typescript)` | CodeQL |
| `Review dependency changes` | Dependency review |
| `Scan the full history` | Gitleaks |
| `actionlint` | Workflow lint |
| `zizmor` | Workflow lint |

Scorecard no va en la lista: solo se ejecuta en `main`, no en los PRs.

> **Dependabot y commitlint.** Dependabot escribe siempre «Bump» con mayúscula (`chore(deps-dev): Bump @types/node`), que `subject-case` rechaza. Desde T-008, commitlint deja fuera solo los commits con el asunto exacto de Dependabot (`chore(deps)`, `chore(deps-dev)` o `ci(deps)`, seguido de `: Bump …`) **y** su línea `Signed-off-by: dependabot[bot] <support@github.com>` (`scripts/commitlint-ignores.mjs`, con tests). Cualquier otro commit pasa por todas las reglas.

> **«BLOCKED» y commits sin firmar.** GitHub muestra los PRs como bloqueados (`mergeable_state: blocked`) aunque cumplan todo lo demás. La causa es `required_signatures`: al evaluar un PR, GitHub comprueba también los commits de la rama, y *«unsigned commits on the head branch can block a squash merge, even though GitHub would sign the final squash commit. This restriction can also apply to the author of the pull request»* ([documentación oficial](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), verificado el 2026-11-20).
>
> - Hasta ahora el squash por API ha funcionado (#18, #19 y #20), pero GitHub no lo garantiza.
> - Los commits de la sesión en la nube llevan firma SSH; los del Builder no llevan ninguna.
> - Mitigación pendiente de decisión del Maintainer: firmar los commits del Builder con firma SSH en el git local, con la clave registrada en GitHub como *signing key*.

> **«Require branches to be up to date».** Tras cada fusión en `main`, el resto de PRs abiertos necesita «Update branch», lo que les da un SHA nuevo. Para no tener que aprobarlo todo otra vez, `docs/WORKFLOW.md` §6 define cuándo una actualización conserva la aprobación.

## 2. Pull requests

**Settings → General → Pull Requests**

- **Allow squash merging** ✓. *Allow merge commits* y *Allow rebase merging* ✗.
- **Always suggest updating pull request branches** ✓.
- **Automatically delete head branches** ✓ (activado el 2026-11-19). Encaja con una rama por PR (`docs/WORKFLOW.md` §7).

## 3. Seguridad del código

**Settings → Advanced Security**

- **Dependency graph** ✓ (ya activado).
- **Dependabot alerts** ✓ y **Dependabot security updates** ✓.
- **Secret Protection** ✓ con **Push protection** ✓.
- **Private vulnerability reporting** ✓ (`SECURITY.md`).
- **CodeQL:** sin *default setup*. Lo ejecuta nuestro workflow avanzado (`.github/workflows/codeql.yml`).

## 4. Cómo comprobarlo

1. Un PR con un check en rojo muestra **Merging is blocked** y el botón de fusión deshabilitado.
2. La siguiente ejecución de Scorecard en `main` sube Branch-Protection a 3/10 (Tier 1). Pasar de ahí exige al menos una aprobación de otra identidad (`docs/HANDOFF.md`, decisión A/B pendiente).
