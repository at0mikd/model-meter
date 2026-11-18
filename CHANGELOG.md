# Changelog

Todos los cambios relevantes de este proyecto se anotan aquí. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido

- Esqueleto del mod `model-meter` (sin hooks todavía) y marketplace `model-meter`.
- Núcleo puro del mod (`hooks/core/`): sanitización del texto, lectura del id de modelo (incluidos Bedrock y Vertex), niveles de esfuerzo como lista cerrada, cascada del esfuerzo a mostrar y encaje de la insignia según el ancho del pie. Sin `$` ni dependencias; sus tests viven en `test/core/`.
- Gates locales (`npm run check`, `npm run check:core`) y CI: matriz Node 22/24 × Linux/macOS/Windows, validación y tests del mod con la CLI fijada, comprobación de capacidades, CodeQL, revisión de dependencias, Scorecard, gitleaks, actionlint y zizmor.
- `npm run audit`: falla ante cualquier aviso de seguridad sin una excepción aprobada y vigente (`security/audit-exceptions.json`).
- `npm run audit` avisa 14 días antes de que caduque una excepción (también como anotación en GitHub Actions), y una auditoría semanal de solo lectura (`Scheduled audit`) la ejecuta sobre `main`.
- `SECURITY.md` (con las excepciones activas), `CONTRIBUTING.md`, `CODEOWNERS` y Dependabot.
