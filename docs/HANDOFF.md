# Traspaso de sesión — 2026-11-18

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

## En curso

- **T-003** (Ready): modo compacto en el pie. Siguiente tarea del Builder (`/build T-003`). CA7 requiere capturas del Maintainer en su terminal.

## Pendiente del Maintainer

1. ~~Dependency graph~~ ✅ activado. ~~Aprobar #6~~ ✅ fusionado.
2. Activar **Dependabot security updates** (Settings → Advanced Security): abre el PR solo cuando salga el arreglo de picomatch, aunque sea una dependencia transitiva.
3. En el ruleset de `main`, marcar como obligatorios `check:core` (6), `validate, test:mod, capabilities`, CodeQL, Gitleaks, Dependency review, actionlint y zizmor.
4. Ruleset de `main` (si no está): PR obligatorio, 0 aprobaciones, solo squash, commits firmados, sin force-push; secret scanning + push protection; private vulnerability reporting.
5. Aviso de caducidad de picomatch (**2026-12-18**): decidido, **opción 3** → T-007.

## Siguientes pasos del Reviewer

1. Revisar el PR de T-003 cuando el Builder lo abra (incluye las capturas de CA7).
2. ✅ T-002 y T-007 fusionadas; T-003 en `Ready` con la especificación completa.
3. Redactar T-004 (banda 8-bit y modo `auto`) mientras el Builder hace T-003. Nota pendiente para `SECURITY.md`: GitHub desactiva los workflows programados tras 60 días sin actividad.
4. Después: T-004 (banda 8-bit y modo `auto`), T-005 (config y persistencia), T-006 (hardening y release).

## Notas operativas

- El acceso a GitHub de la sesión cloud está configurado con el nombre antiguo `at0mikd/who-is-claude`; funciona por la redirección de GitHub. Una sesión nueva puede añadir `at0mikd/model-meter`.
- Canal con el Builder: mensajes entre sesiones (Remote Control) más GitHub. Solo vale la aprobación del Maintainer escrita en la conversación del Reviewer (`docs/WORKFLOW.md` §6).
- El clasificador de permisos bloquea ejecutar gitleaks en local, tanto en la sesión cloud como en la del Builder; gitleaks corre en la CI.
