# Traspaso de sesión — 2026-11-19

Estado del proyecto `model-meter` para retomar en una sesión nueva (Reviewer en la nube, Builder local).

## Hecho (en `main`)

| PR | Contenido |
| --- | --- |
| #1 | Plan, flujo Reviewer–Builder, backlog, spike |
| #2 | T-000: resultados del spike en terminal |
| #3 | Decisiones derivadas de T-000 (fuentes del esfuerzo, allowlist) |
| #4 | Nombre único `model-meter` (plugin, marketplace, repo) |
| #5 | Excepción acotada de picomatch (T-001) y ancho dinámico de `PromptHint` |
| #6 | T-001: scaffold, gates de calidad y seguridad, CI (`0500b52`) |
| #7 | T-002 Ready, T-003 Draft, T-007, traspaso |
| #9 | T-007: aviso de caducidad a 14 días y auditoría semanal (`f7bd95c`; ejecución manual en verde) |
| #10 | T-002: núcleo puro con 100 % de cobertura (`503db20`) |
| #11 | T-003 Ready con el estado «desactivado» 8-bit (`1094cf6`) |
| #12 | T-003: insignia compacta en el pie de la terminal (`46fa489`); minúsculas con el nombre del modelo en mayúscula inicial (decisiones del Maintainer en CA7) |
| #13 | Excepción de picomatch retirada: GitHub retiró GHSA-fc5q-39xc-vjpf el 2026-11-18 (`a3f0723`) |
| #15 | T-003 cerrada; T-003b especificada; traspaso (`90cd4bc`; sustituye a #14, que se cerró por commitlint) |

## En curso

- **T-003b** (Ready): el espacio a media pantalla junto a `sub-meter`. Primero se mide (P1–P4: qué pista ve el hook, orden de los hooks entre plugins, `permission_mode` y qué pasa al desbordar) y después se implementa. CA3 requiere capturas del Maintainer.
- **Revisión de alertas (Security / Scorecard 6,2):** análisis entregado al Maintainer. Pendiente de su decisión:
  - **Ruleset de `main`:** Branch-Protection 0 → 3 con Tier 1.
  - **Code-Review:** A) aceptar y documentar, o B) identidad propia para el Builder con aprobación humana en GitHub.
  - **Exportar las alertas** con `gh` (solo lectura).
  - **Picomatch:** Vulnerabilities debería pasar a 10 en la próxima ejecución.
  - **Fuzzing:** probablemente pase a 10 al detectar `fast-check`; está por verificar.

## Pendientes, en orden

| # | Qué | Quién | Depende de |
| --- | --- | --- | --- |
| 1 | Aprobar y fusionar **#16** (`docs/REPO-SETTINGS.md` y reglas de fusión en `WORKFLOW.md`) | Maintainer → Reviewer | CI en verde |
| 2 | **Ruleset de `main`, paso 1** (sin checks obligatorios): borrado, force-push, historial lineal, firma, PR + squash | Maintainer | #16 |
| 3 | **T-003b** (espacio a media pantalla): medir y después implementar | Builder | #15 ✅ |
| 4 | **T-008** (commitlint para Dependabot y nombre estable del job del mod) | Builder | #16 |
| 5 | **Ruleset, paso 2:** los 12 checks obligatorios con el nombre nuevo del job del mod | Maintainer | T-008 |
| 6 | `@dependabot rebase` en #8; revisar y fusionar | Reviewer → Maintainer | T-008 |
| 7 | Activar Dependabot security updates, Secret Protection con push protection y Private vulnerability reporting (`REPO-SETTINGS.md` §3) | Maintainer | — |
| 8 | Decisión A/B sobre Code-Review (Scorecard) | Maintainer | — |
| 9 | Exportar las alertas de CodeQL, Dependabot y secretos (solo lectura, con `gh`) | Builder | — |
| 10 | Redactar T-004 (banda 8-bit y modo `auto`, con el texto en minúscula y el nombre del modelo en mayúscula inicial) | Reviewer | — |

**Incidencia registrada:** #7 y #11 se fusionaron con `check:core` en rojo (commitlint) sin que el Reviewer revisara su CI. Corregido en el proceso (`WORKFLOW.md` §6–§7: comprobar todos los checks antes de fusionar, una rama por PR y asuntos en minúscula) y, de forma definitiva, con el ruleset.

## Notas operativas

- El acceso a GitHub de la sesión cloud está configurado con el nombre antiguo `at0mikd/who-is-claude`; funciona por la redirección de GitHub. Una sesión nueva puede añadir `at0mikd/model-meter`.
- Canal con el Builder: mensajes entre sesiones (Remote Control) más GitHub. Solo vale la aprobación del Maintainer escrita en la conversación del Reviewer (`docs/WORKFLOW.md` §6).
- El clasificador de permisos bloquea ejecutar gitleaks en local, tanto en la sesión cloud como en la del Builder; gitleaks corre en la CI.
