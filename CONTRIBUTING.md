# Cómo contribuir

El proyecto sigue el flujo **Reviewer–Builder** descrito en [`docs/WORKFLOW.md`](docs/WORKFLOW.md): léelo antes de empezar. El plan y las decisiones de diseño están en [`docs/PLAN.md`](docs/PLAN.md) y el trabajo pendiente en [`docs/tasks/`](docs/tasks/).

## Requisitos

- Node.js 22 o posterior.
- Claude Code ≥ 2.1.327 (la CLI `claude`) para los gates del mod.

## Puesta en marcha

```bash
npm ci --ignore-scripts
npm run check        # todos los gates (necesita la CLI claude)
npm run check:core   # los que no necesitan la CLI
```

| Script | Qué comprueba |
| --- | --- |
| `typecheck` | Núcleo puro y scripts con TypeScript estricto |
| `lint` | ESLint (`strict-type-checked` + `eslint-plugin-security`), 0 avisos |
| `format:check` | Prettier |
| `test:node` | Tests `node --test` con cobertura ≥ 95 % (`c8`) |
| `commitlint` | Conventional Commits en los commits de la rama |
| `validate` | `claude plugin validate --strict` del mod y del marketplace |
| `test:mod` | `claude plugin test` del mod |
| `capabilities` | El mod solo usa las capacidades permitidas y sus hooks dejan pasar los eventos |

## Normas

- Un PR por tarea, contra `main`, con la plantilla completa y evidencia real.
- TDD: test que falla → implementación mínima → refactor.
- Commits en [Conventional Commits](https://www.conventionalcommits.org/).
- Sin dependencias en tiempo de ejecución; las de desarrollo, con versión exacta.
- Documentación en español; identificadores y comentarios del código en inglés.
- Nada de secretos, rutas personales ni datos privados en código, fixtures, logs o evidencia.

Para informar de una vulnerabilidad, sigue [`SECURITY.md`](SECURITY.md).
