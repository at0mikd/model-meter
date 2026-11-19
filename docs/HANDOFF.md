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
| #12 | T-003: insignia compacta en el pie de la terminal (`46fa489`); minúsculas con el nombre del modelo en mayúscula inicial (decisiones del Maintainer en CA7) |
| #13 | Excepción de picomatch retirada: GitHub retiró GHSA-fc5q-39xc-vjpf el 2026-11-18 (`a3f0723`) |

## En curso

- **T-003b** (Ready): el espacio a media pantalla junto a `sub-meter`. Primero se mide (P1–P4: qué pista ve el hook, orden de los hooks entre plugins, `permission_mode` y qué pasa al desbordar) y después se implementa. CA3 requiere capturas del Maintainer.
- **Revisión de alertas (Security / Scorecard 6,2):** análisis entregado al Maintainer. Pendiente de su decisión:
  - **Ruleset de `main`:** Branch-Protection 0 → 3 con Tier 1.
  - **Code-Review:** A) aceptar y documentar, o B) identidad propia para el Builder con aprobación humana en GitHub.
  - **Exportar las alertas** con `gh` (solo lectura).
  - **Picomatch:** Vulnerabilities debería pasar a 10 en la próxima ejecución.
  - **Fuzzing:** probablemente pase a 10 al detectar `fast-check`; está por verificar.

## Pendiente del Maintainer

1. ~~Dependency graph~~ ✅ activado. ~~Aprobar #6~~ ✅ fusionado.
2. Activar **Dependabot security updates** (Settings → Advanced Security). Buena práctica; ya no es urgente porque el aviso de picomatch se retiró.
3. En el ruleset de `main`, marcar como obligatorios `check:core` (6), `validate, test:mod, capabilities`, CodeQL, Gitleaks, Dependency review, actionlint y zizmor.
4. Ruleset de `main` (si no está): PR obligatorio, 0 aprobaciones, solo squash, commits firmados, sin force-push; secret scanning + push protection; private vulnerability reporting.
5. ~~Caducidad de picomatch~~: ya no aplica (aviso retirado, #13). El aviso a 14 días de T-007 sigue activo para futuras excepciones.

## Siguientes pasos del Reviewer

1. Revisar el PR de T-003b: primero los datos de la fase 1, después la implementación.
2. ✅ T-000, T-001, T-002, T-003 y T-007 fusionadas.
3. Redactar T-004 (banda 8-bit y modo `auto`) mientras el Builder hace T-003b. En la banda, el texto sigue la decisión de CA7: minúscula, con el nombre del modelo en mayúscula inicial (`Opus 5.5`). Nota pendiente para `SECURITY.md`: GitHub desactiva los workflows programados tras 60 días sin actividad.
4. Después: T-004 (banda 8-bit y modo `auto`), T-005 (config y persistencia), T-006 (hardening y release).

## Notas operativas

- El acceso a GitHub de la sesión cloud está configurado con el nombre antiguo `at0mikd/who-is-claude`; funciona por la redirección de GitHub. Una sesión nueva puede añadir `at0mikd/model-meter`.
- Canal con el Builder: mensajes entre sesiones (Remote Control) más GitHub. Solo vale la aprobación del Maintainer escrita en la conversación del Reviewer (`docs/WORKFLOW.md` §6).
- El clasificador de permisos bloquea ejecutar gitleaks en local, tanto en la sesión cloud como en la del Builder; gitleaks corre en la CI.
