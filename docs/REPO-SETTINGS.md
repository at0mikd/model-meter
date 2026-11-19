# Configuración del repositorio en GitHub

> Lo que el Maintainer configura a mano en GitHub. Ningún agente cambia la configuración del repositorio (`docs/WORKFLOW.md` §7). Es el **control real** que respalda el flujo: sin él, GitHub permite fusionar con checks en rojo, hacer push directo a `main` o reescribir su historia.

**Estado a 2026-11-19:** `main` **no tiene protección**. La API responde «Branch not protected», no hay rulesets, y Scorecard lo confirma (Branch-Protection 0).

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

Checks obligatorios. Los nombres son exactos y al añadirlos se elige *GitHub Actions* como origen:

| Check | Workflow |
| --- | --- |
| `check:core (Node 22, ubuntu-latest)` | CI |
| `check:core (Node 22, macos-latest)` | CI |
| `check:core (Node 22, windows-latest)` | CI |
| `check:core (Node 24, ubuntu-latest)` | CI |
| `check:core (Node 24, macos-latest)` | CI |
| `check:core (Node 24, windows-latest)` | CI |
| `validate, test:mod, capabilities (claude CLI 2.1.327)` | CI |
| `Analyze (javascript-typescript)` | CodeQL |
| `Review dependency changes` | Dependency review |
| `Scan the full history` | Gitleaks |
| `actionlint` | Workflow lint |
| `zizmor` | Workflow lint |

> **Ojo:** el nombre del job del mod lleva la versión de la CLI. Cuando Dependabot la actualice, el nombre cambiará y GitHub esperará un check que nunca llega. Hasta que una tarea le dé un nombre estable, al actualizar la CLI hay que actualizar también este check en el ruleset.

Scorecard no va en la lista: solo se ejecuta en `main`, no en los PRs.

## 2. Pull requests

**Settings → General → Pull Requests**

- **Allow squash merging** ✓. *Allow merge commits* y *Allow rebase merging* ✗.
- **Always suggest updating pull request branches** ✓.
- **Automatically delete head branches** ✓. Encaja con una rama por PR (`docs/WORKFLOW.md` §7).

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
