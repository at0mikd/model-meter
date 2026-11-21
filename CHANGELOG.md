# Changelog

Todos los cambios relevantes de este proyecto se anotan aquí. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido

- **Insignia compacta en el pie de la terminal** (`model-meter`): modelo y esfuerzo en vivo con `/model`, `/effort` y cada turno; el esfuerzo pendiente atenuado con `…`; lo que falta, «apagado» en 8-bit (`◇`, `░`, `---`) sin cambiar de ancho; degradación por ancho junto a las pistas y otros mods. Solo observa y guarda únicamente el último nivel de esfuerzo.
- **Banda 8-bit opcional encima del prompt** (`model-meter`): un sprite original por familia (corona, pluma, montaña, libro; un cartucho vacío para lo desconocido) y el rótulo `player Opus 5.5` / `power ▮▮▮▯▯ high`. Se ajusta al ancho de la banda y cede el sitio a las encuestas. Las opciones son `placement` (`footer` por defecto, `auto` o `band`) y `autoMinColumns` (140, de 80 a 400). Con `auto` usa histéresis: entra a 140 columnas y sale por debajo de 120. El pie no cambia.
- `check-capabilities` admite `$.state` solo para las claves propias de `model-meter` declaradas en su contrato.
- Esqueleto del mod `model-meter` (sin hooks todavía) y marketplace `model-meter`.
- Núcleo puro del mod (`hooks/core/`): sanitización del texto, lectura del id de modelo (incluidos Bedrock y Vertex), niveles de esfuerzo como lista cerrada, cascada del esfuerzo a mostrar y encaje de la insignia según el ancho del pie. Sin `$` ni dependencias; sus tests viven en `test/core/`.
- Gates locales (`npm run check`, `npm run check:core`) y CI: matriz Node 22/24 × Linux/macOS/Windows, validación y tests del mod con la CLI fijada, comprobación de capacidades, CodeQL, revisión de dependencias, Scorecard, gitleaks, actionlint y zizmor.
- `npm run audit`: falla ante cualquier aviso de seguridad sin una excepción aprobada y vigente (`security/audit-exceptions.json`).
- `npm run audit` avisa 14 días antes de que caduque una excepción (también como anotación en GitHub Actions), y una auditoría semanal de solo lectura (`Scheduled audit`) la ejecuta sobre `main`.
- `SECURITY.md` (con las excepciones activas), `CONTRIBUTING.md`, `CODEOWNERS` y Dependabot.

### Corregido

- La insignia de `model-meter` vuelve a aparecer a media pantalla junto a `sub-meter`: mide la pista del pie tal como se dibuja, no como le llega, y deja de reservar el texto que otro mod oculta.
- La insignia también cuenta con lo que un mod de debajo cambia en la fila: el texto con que envuelve la línea de pistas y las etiquetas de modo que quita o añade.

### Seguridad

- Se quita la excepción de auditoría de `picomatch` (GHSA-fc5q-39xc-vjpf): GitHub retiró el aviso el 2026-11-18 y `npm run audit` ya no la necesita.
