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

## Versiones soportadas

Solo la última versión publicada recibe correcciones.
