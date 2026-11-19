# Traspaso de sesión — 2026-11-18 (2.ª ventana)

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
| #13 | Excepción de picomatch retirada: GitHub retiró GHSA-fc5q-39xc-vjpf el 2026-11-18 (`a3f0723`) |

## En curso

**PR #12 — T-003 (modo compacto en el pie)**, cabeza `6b15fc8` (antes de integrar `main`).
- Rondas de revisión resueltas. Desviaciones aceptadas: `hintColumns` en el closure, `stored` en el contrato, huecos de ancho fijo, `unknown` frente a «sin leer». `$.state` acotado a `model-meter` (decisión del Maintainer).
- `6b15fc8`: todo en minúscula (`◆ opus 5.5 ▮▮▮▮▯ xhi`), decisión del Maintainer en CA7.
- **CA7 hecho por el Maintainer:** maximizada, todo correcto; a media pantalla con `sub-meter` la insignia no sale en reposo ni con shell, y sí sale (`modelOnly`) mientras se escribe.
- **Falta para el LGTM:** que el Builder integre `main` (para recoger el #13; un re-run no basta porque reutiliza el merge ref antiguo), la CI en verde con el SHA nuevo y las capturas en el #12 (incluida una maximizada en minúscula).

**T-003b (por redactar, Reviewer):** el espacio a media pantalla. Causas medidas en CA7:
1. el mod mide la pista original de `PromptHint` y no la que se dibuja (`sub-meter` oculta `(shift+tab to cycle)`): unas 23 columnas de más;
2. reserva 26 columnas para la etiqueta de modo más larga, cuando la de `auto mode on` mide unas 17.

Con las dos corregidas, en reposo cabe la insignia completa (hay unas 41 columnas libres y necesita 27).

**Revisión de alertas (Security / Scorecard 6,2):** análisis entregado al Maintainer. Pendiente de su decisión:
- **Ruleset de `main`:** Branch-Protection 0 → 3 con Tier 1.
- **Code-Review:** A) aceptar y documentar, o B) identidad propia para el Builder con aprobación humana en GitHub.
- **Exportar las alertas:** CodeQL, Dependabot y secretos, con `gh` (solo lectura).
- **Picomatch:** Vulnerabilities debería pasar a 10 en la próxima ejecución.
- **Fuzzing:** probablemente pase a 10 al detectar `fast-check`; está por verificar.

## Pendiente del Maintainer

1. ~~Dependency graph~~ ✅ activado. ~~Aprobar #6~~ ✅ fusionado.
2. Activar **Dependabot security updates** (Settings → Advanced Security). Buena práctica; ya no es urgente porque el aviso de picomatch se retiró.
3. En el ruleset de `main`, marcar como obligatorios `check:core` (6), `validate, test:mod, capabilities`, CodeQL, Gitleaks, Dependency review, actionlint y zizmor.
4. Ruleset de `main` (si no está): PR obligatorio, 0 aprobaciones, solo squash, commits firmados, sin force-push; secret scanning + push protection; private vulnerability reporting.
5. ~~Caducidad de picomatch~~: ya no aplica (aviso retirado, #13). El aviso a 14 días de T-007 sigue activo para futuras excepciones.

## Siguientes pasos del Reviewer

1. Con la CI en verde y las capturas de CA7, dar el LGTM de #12 (o pedir cambios) y fusionar con «apruebo #12». Según lo que muestren las capturas, proponer al Maintainer una de las tres opciones de espacio como tarea nueva (T-003b) antes de T-004.
2. ✅ T-002 y T-007 fusionadas; T-003 en `Ready` con la especificación completa.
3. Redactar T-004 (banda 8-bit y modo `auto`) mientras el Builder hace T-003. Nota pendiente para `SECURITY.md`: GitHub desactiva los workflows programados tras 60 días sin actividad.
4. Después: T-004 (banda 8-bit y modo `auto`), T-005 (config y persistencia), T-006 (hardening y release).

## Notas operativas

- El acceso a GitHub de la sesión cloud está configurado con el nombre antiguo `at0mikd/who-is-claude`; funciona por la redirección de GitHub. Una sesión nueva puede añadir `at0mikd/model-meter`.
- Canal con el Builder: mensajes entre sesiones (Remote Control) más GitHub. Solo vale la aprobación del Maintainer escrita en la conversación del Reviewer (`docs/WORKFLOW.md` §6).
- El clasificador de permisos bloquea ejecutar gitleaks en local, tanto en la sesión cloud como en la del Builder; gitleaks corre en la CI.
