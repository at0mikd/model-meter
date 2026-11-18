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

## En curso

**PR #12 — T-003 (modo compacto en el pie)**, cabeza `c6700b588b5e3d898f9cc5445cb129495829e40e`.
- Revisión del Reviewer: los 3 puntos de la primera ronda están resueltos (reserva de la etiqueta de modo de la izquierda, `$.store` solo cuando cambia, comentario corregido). Desviaciones aceptadas: `hintColumns` en el closure, `stored` en el contrato, huecos de ancho fijo, `unknown` frente a «sin leer».
- `$.state` acotado a `model-meter` (decisión del Maintainer); `check-capabilities` rechaza estado ajeno y claves no declaradas (verificado con una mutación).
- **Falta para el LGTM:** CI completa de `c6700b5` y las **capturas de CA7** del Maintainer (el Builder lo guía).
- **Riesgo de producto que decidirán las capturas:** con la reserva pesimista de 26 columnas para la etiqueta de modo, a media pantalla (~95 columnas) junto a `sub-meter` la insignia probablemente **no cabe**. Opciones, para una tarea posterior:
  1. medir la etiqueta real con `permission_mode` de los eventos clásicos (en `default` se recuperan 26 columnas);
  2. una variante mínima de unas 6 columnas;
  3. recurso a la banda `AbovePrompt` (T-004).

## Pendiente del Maintainer

1. ~~Dependency graph~~ ✅ activado. ~~Aprobar #6~~ ✅ fusionado.
2. Activar **Dependabot security updates** (Settings → Advanced Security): abre el PR solo cuando salga el arreglo de picomatch, aunque sea una dependencia transitiva.
3. En el ruleset de `main`, marcar como obligatorios `check:core` (6), `validate, test:mod, capabilities`, CodeQL, Gitleaks, Dependency review, actionlint y zizmor.
4. Ruleset de `main` (si no está): PR obligatorio, 0 aprobaciones, solo squash, commits firmados, sin force-push; secret scanning + push protection; private vulnerability reporting.
5. Aviso de caducidad de picomatch (**2026-12-18**): decidido, **opción 3** → T-007.

## Siguientes pasos del Reviewer

1. Con la CI en verde y las capturas de CA7, dar el LGTM de #12 (o pedir cambios) y fusionar con «apruebo #12». Según lo que muestren las capturas, proponer al Maintainer una de las tres opciones de espacio como tarea nueva (T-003b) antes de T-004.
2. ✅ T-002 y T-007 fusionadas; T-003 en `Ready` con la especificación completa.
3. Redactar T-004 (banda 8-bit y modo `auto`) mientras el Builder hace T-003. Nota pendiente para `SECURITY.md`: GitHub desactiva los workflows programados tras 60 días sin actividad.
4. Después: T-004 (banda 8-bit y modo `auto`), T-005 (config y persistencia), T-006 (hardening y release).

## Notas operativas

- El acceso a GitHub de la sesión cloud está configurado con el nombre antiguo `at0mikd/who-is-claude`; funciona por la redirección de GitHub. Una sesión nueva puede añadir `at0mikd/model-meter`.
- Canal con el Builder: mensajes entre sesiones (Remote Control) más GitHub. Solo vale la aprobación del Maintainer escrita en la conversación del Reviewer (`docs/WORKFLOW.md` §6).
- El clasificador de permisos bloquea ejecutar gitleaks en local, tanto en la sesión cloud como en la del Builder; gitleaks corre en la CI.
