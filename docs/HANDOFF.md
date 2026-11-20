# Traspaso de sesión — 2026-11-20

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
| #18 | Paso 1 del ruleset aplicado, revisión de alertas y paso de limpieza de ramas (`a583959`) |
| #19 | T-003b: la pista se mide como se dibuja (`next.trace`) y la insignia sale completa a media pantalla junto a `sub-meter` (`872bfc8`; capturas del Maintainer en CA3) |
| #20 | T-008: commitlint deja fuera solo los bumps de Dependabot, y el job del mod pasa a llamarse `mod (validate, test:mod, capabilities)` (`826fd97`) |

## En curso

- **T-009** (Ready, Builder): deudas de las revisiones de #19 y #20.
  - Medir también las envolturas de la línea de pistas y las etiquetas de modo tal como se dibujan.
  - Un test para la guarda de tipo de commitlint.
- **T-004** (la redacta el Reviewer): banda 8-bit y modo `auto`.
- **Ruleset de `main` completo** desde el 2026-11-20 (pasos 1 y 2, `REPO-SETTINGS.md`). Cada PR necesita sus 12 checks en verde y estar al día con `main`.
- **Alertas de Scorecard:** quedan 6 de la revisión del 2026-11-19, y ninguna se descarta a mano.
  - Branch-Protection (alta) debería subir en la próxima ejecución, con el ruleset completo.
  - Code-Review (alta) depende de la decisión A/B.
  - Maintained (alta) se resuelve con el tiempo.
  - SAST (media) y CI-Tests (baja) se resuelven solas cuando salen de la ventana los commits anteriores a la CI.
  - CII-Best-Practices (baja) queda para la release.

## Pendientes, en orden

| # | Qué | Quién | Depende de |
| --- | --- | --- | --- |
| 1 | **T-009** | Builder | — |
| 2 | `@dependabot rebase` en #8; después, revisión y aprobación | Maintainer → Reviewer → Maintainer | — |
| 3 | **Firmar los commits del Builder** (firma SSH en el git local), para que «BLOCKED» no llegue a impedir un squash (`REPO-SETTINGS.md`) | Maintainer (decisión y clave) | — |
| 4 | Activar Dependabot security updates, Secret Protection con push protection y Private vulnerability reporting (`REPO-SETTINGS.md` §3) | Maintainer | — |
| 5 | Decisión A/B sobre Code-Review (Scorecard) | Maintainer | — |
| 6 | Redactar T-004 (banda 8-bit y modo `auto`, con el texto en minúscula y el nombre del modelo en mayúscula inicial) | Reviewer | — |
| 7 | **Limpieza de ramas antiguas** (ver abajo) | Maintainer | — |

**Limpieza de ramas.** Son 10 ramas ya fusionadas o sustituidas. En cada una, la cabeza coincide con la del PR, así que no se pierde nada:
- `spike/T-000-terminal` (#2), `chore/T-001-scaffold` (#6), `chore/T-007-audit-expiry-warning` (#9), `feat/T-002-pure-core` (#10), `feat/T-003-compact-footer` (#12), `chore/remove-picomatch-exception` (#13), `claude/docs-t003b` (#15), `claude/docs-repo-settings` (#16) y `claude/docs-t008` (#17);
- `claude/cool-euler-xg853i`: #14 cerrado, con el contenido idéntico al de #15.

**Cómo borrarlas:**
- Se borran desde la pestaña *Branches*, o con `git push origin --delete <ramas>` desde la máquina del Maintainer (también puede pedírselo él al Builder en su sesión).
- El proxy de la sesión en la nube deniega el borrado (HTTP 403).
- **No borrar** `dependabot/npm_and_yarn/dev-dependencies-ad441a7b4e`: el #8 sigue abierto.
- Las ramas nuevas se borran solas al fusionar (*Automatically delete head branches*).

**Incidencias registradas:**
- **#7 y #11 se fusionaron con `check:core` en rojo** (commitlint) sin que el Reviewer revisara su CI. Se corrigió en el proceso (`WORKFLOW.md` §6–§7: comprobar todos los checks antes de fusionar, una rama por PR y asuntos en minúscula) y, de forma definitiva, con el ruleset.
- **Comando a Dependabot alterado** (2026-11-20). El comentario `@dependabot rebase` del Reviewer en #8 quedó guardado con separadores (`·@·d·ependabot r·ebase`), y Dependabot no lo reconoció. Desde entonces, los comandos a bots los escribe el Maintainer (`WORKFLOW.md` §7).

## Notas operativas

- **Nombre antiguo del repo.** El acceso a GitHub de la sesión en la nube está configurado con `at0mikd/who-is-claude`. Funciona por la redirección de GitHub. Una sesión nueva puede añadir `at0mikd/model-meter`.
- **Límites del proxy en la nube.** La sesión en la nube no puede:
  - leer la API de rulesets, porque el proxy deniega la redirección del repo renombrado;
  - abrir los adjuntos de GitHub (`user-attachments`).

  Por eso el ruleset lo verifica el Builder con `gh api` de solo lectura, y las capturas las comprueba el Maintainer.
- **Canal con el Builder:** mensajes entre sesiones (Remote Control) más GitHub. Solo vale la aprobación del Maintainer escrita en la conversación del Reviewer (`docs/WORKFLOW.md` §6).
- **gitleaks:** el clasificador de permisos bloquea ejecutarlo en local, tanto en la sesión en la nube como en la del Builder. gitleaks corre en la CI.
