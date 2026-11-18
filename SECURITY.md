# Política de seguridad

## Cómo informar de una vulnerabilidad

Usa el **reporte privado de vulnerabilidades de GitHub**: pestaña *Security* del repositorio → *Report a vulnerability*. No abras un issue público ni un PR con los detalles.

Incluye, si puedes:

- versión del mod (`model-meter`) y de Claude Code;
- qué hace mal y cómo reproducirlo;
- el impacto que crees que tiene.

Recibirás acuse en un plazo razonable y te mantendremos al tanto hasta la corrección. Si el informe se confirma, se publicará un aviso de seguridad (GitHub Security Advisory) con el crédito que prefieras.

## Alcance

- El mod `plugins/model-meter/` y los scripts y workflows de este repositorio.
- **Fuera de alcance:** `spikes/` (código desechable que no se publica) y Claude Code en sí (repórtalo a Anthropic).

## Qué se considera un fallo de seguridad aquí

El mod debe **solo observar**: no puede reescribir ni bloquear eventos del motor, ni usar ficheros, procesos, red o variables de entorno. Cualquier forma de saltarse eso, de inyectar secuencias de control en lo que dibuja o de filtrar datos de la sesión es un fallo de seguridad. Las capacidades permitidas están en `docs/PLAN.md` §5–§6 y la CI las comprueba en cada PR.

## Excepciones activas

Avisos de seguridad que se aceptan temporalmente, con aprobación del Maintainer y fecha de caducidad. La fuente de verdad es [`security/audit-exceptions.json`](security/audit-exceptions.json); `npm run audit` falla si aparece cualquier otro aviso, si una excepción caduca o queda obsoleta, si afecta a código de runtime o si `allow-ghsas` en `dependency-review.yml` no coincide. Renovar una excepción exige una nueva aprobación del Maintainer.

Para que una caducidad no pille por sorpresa:

- **Aviso a 14 días.** Desde 14 días antes de que caduque una excepción, `npm run audit` imprime un aviso con el GHSA, la fecha y los días que quedan, sin fallar. En GitHub Actions sale además como anotación (`::warning`), visible en el resumen de la ejecución y del PR. Al día siguiente de la fecha de caducidad, la auditoría falla.
- **Auditoría semanal.** El workflow `Scheduled audit` (`.github/workflows/audit-schedule.yml`) ejecuta `npm run audit` y audita el lockfile de la CLI fijada todos los lunes sobre `main`, también sin PRs abiertos, y se puede lanzar a mano. Solo lee el repositorio: si falla, GitHub avisa al Maintainer por su correo estándar de notificaciones.

| Aviso | Paquete | Severidad | Alcance | Motivo | Caduca |
| --- | --- | --- | --- | --- | --- |
| [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) | `picomatch` (≤ 4.0.7) | alta (ReDoS) | solo desarrollo | No existe versión corregida. Llega por `typescript-eslint` → `typescript-estree` → `tinyglobby` y solo procesa los globs fijos de nuestra configuración. | 2026-12-18 |

## Versiones soportadas

Solo la última versión publicada recibe correcciones.
