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
| #16 | Configuración de GitHub (`REPO-SETTINGS.md`) y reglas de fusión en `WORKFLOW.md` (`564e979`) |
| #17 | T-008 especificada y pendientes en orden (`1efc3ee`) |

## En curso

- **T-003b** (Ready): el espacio a media pantalla junto a `sub-meter`. Primero se mide (P1–P4: qué pista ve el hook, orden de los hooks entre plugins, `permission_mode` y qué pasa al desbordar) y después se implementa. CA3 requiere capturas del Maintainer.
- **T-008** (Ready): commitlint para Dependabot y nombre estable del job del mod. El Builder puede hacerla en paralelo a T-003b.
- **Revisión de alertas: cerrada** (exportación de solo lectura del 2026-11-19).
  - 0 abiertas de CodeQL, de Dependabot y de secret scanning; estas dos funciones están activas.
  - Scorecard ya cerró **Fuzzing** (detecta `fast-check`) y **Vulnerabilities** (aviso de picomatch retirado).
  - Quedan 6 alertas de Scorecard:
    - Branch-Protection (alta): ruleset;
    - Code-Review (alta): decisión A/B;
    - Maintained (alta): se resuelve con el tiempo;
    - SAST (media) y CI-Tests (baja): se resuelven solas al salir de la ventana los commits anteriores a la CI;
    - CII-Best-Practices (baja): para la release.
  - No se descarta ninguna a mano: se cierran solas al mejorar.

## Pendientes, en orden

| # | Qué | Quién | Depende de |
| --- | --- | --- | --- |
| 1 | ~~Fusionar #16 y #17~~ | — | ✅ |
| 2 | ~~**Ruleset de `main`, paso 1**~~ | Maintainer | ✅ aplicado y verificado (2026-11-19) |
| 3 | **T-003b** (espacio a media pantalla): medir y después implementar | Builder | En curso |
| 4 | **T-008** (commitlint para Dependabot y nombre estable del job del mod) | Builder | En curso o en paralelo |
| 5 | **Ruleset, paso 2:** los 12 checks obligatorios con el nombre nuevo del job del mod | Maintainer | T-008 |
| 6 | `@dependabot rebase` en #8; revisar y fusionar | Reviewer → Maintainer | T-008 |
| 7 | Activar Dependabot security updates, Secret Protection con push protection y Private vulnerability reporting (`REPO-SETTINGS.md` §3) | Maintainer | — |
| 8 | Decisión A/B sobre Code-Review (Scorecard) | Maintainer | — |
| 9 | ~~Exportar las alertas~~ | Builder | ✅ (ver «En curso») |
| 10 | Redactar T-004 (banda 8-bit y modo `auto`, con el texto en minúscula y el nombre del modelo en mayúscula inicial) | Reviewer | — |
| 11 | **Limpieza de ramas antiguas** (ver abajo) | Maintainer o Builder | Builder libre (decisión del Maintainer) |

**Limpieza de ramas.** Son 10 ramas ya fusionadas o sustituidas. En cada una, la cabeza coincide con la del PR, así que no se pierde nada:
- `spike/T-000-terminal` (#2), `chore/T-001-scaffold` (#6), `chore/T-007-audit-expiry-warning` (#9), `feat/T-002-pure-core` (#10), `feat/T-003-compact-footer` (#12), `chore/remove-picomatch-exception` (#13), `claude/docs-t003b` (#15), `claude/docs-repo-settings` (#16) y `claude/docs-t008` (#17);
- `claude/cool-euler-xg853i`: #14 cerrado, con el contenido idéntico al de #15.

Se borran desde la pestaña *Branches* o con `git push origin --delete <ramas>` desde la máquina del Maintainer. El proxy de la sesión en la nube deniega el borrado (HTTP 403). **No borrar** `dependabot/npm_and_yarn/dev-dependencies-ad441a7b4e`: el #8 sigue abierto. Las ramas nuevas se borran solas al fusionar (*Automatically delete head branches* está activado).

**Incidencia registrada:** #7 y #11 se fusionaron con `check:core` en rojo (commitlint) sin que el Reviewer revisara su CI. Corregido en el proceso (`WORKFLOW.md` §6–§7: comprobar todos los checks antes de fusionar, una rama por PR y asuntos en minúscula) y, de forma definitiva, con el ruleset.

## Notas operativas

- El acceso a GitHub de la sesión cloud está configurado con el nombre antiguo `at0mikd/who-is-claude`; funciona por la redirección de GitHub. Una sesión nueva puede añadir `at0mikd/model-meter`.
- Canal con el Builder: mensajes entre sesiones (Remote Control) más GitHub. Solo vale la aprobación del Maintainer escrita en la conversación del Reviewer (`docs/WORKFLOW.md` §6).
- El clasificador de permisos bloquea ejecutar gitleaks en local, tanto en la sesión cloud como en la del Builder; gitleaks corre en la CI.
