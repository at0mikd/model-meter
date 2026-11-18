## Tarea

<!-- T-NNN y enlace al fichero en docs/tasks/ -->

## Qué cambia

<!-- Resumen breve. Qué NO cambia, si puede haber dudas. -->

## Criterios de aceptación

<!-- Uno por línea, cada uno con su evidencia (test, comando o salida). -->

- [ ] CA1 — evidencia:
- [ ] CA2 — evidencia:

## Evidencia

<!-- Salidas reales de los comandos, pegadas tal cual. Sin rutas personales, tokens ni datos privados. -->

<details><summary>npm run check</summary>

```text
```

</details>

<details><summary>claude plugin validate (capacidades del mod)</summary>

```text
```

</details>

## Checklist de seguridad

- [ ] El mod solo observa: ningún hook reescribe `model`/`effort` ni bloquea eventos
- [ ] Capacidades del mod dentro de la allowlist (`docs/PLAN.md` §5)
- [ ] Sin dependencias nuevas, o justificadas y permitidas por la tarea
- [ ] El texto que se muestra en pantalla pasa por la sanitización
- [ ] Sin secretos, datos personales ni rutas locales en código, fixtures o evidencia
- [ ] Workflows (si se tocan): permisos mínimos, acciones fijadas por SHA, sin `pull_request_target`

## Notas para la revisión

<!-- Decisiones, dudas o riesgos que el Reviewer debe mirar. -->
