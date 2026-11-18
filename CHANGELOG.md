# Changelog

Todos los cambios relevantes de este proyecto se anotan aquí. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido

- Esqueleto del mod `model-meter` (sin hooks todavía) y marketplace `model-meter`.
- Gates locales (`npm run check`, `npm run check:core`) y CI: matriz Node 22/24 × Linux/macOS/Windows, validación y tests del mod con la CLI fijada, comprobación de capacidades, CodeQL, revisión de dependencias, Scorecard, gitleaks, actionlint y zizmor.
- `npm run audit`: falla ante cualquier aviso de seguridad sin una excepción aprobada y vigente (`security/audit-exceptions.json`).
- `SECURITY.md` (con las excepciones activas), `CONTRIBUTING.md`, `CODEOWNERS` y Dependabot.
