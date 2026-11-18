# who-is-claude — Plan de implementación

> Mod para Claude Code que muestra **qué modelo y qué nivel de esfuerzo** usa la sesión, con estética **8-bit**.
> Estado: propuesta · Versión del motor analizada: Claude Code `2.1.327`

---

## 1. Resumen ejecutivo

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Tipo de extensión | **Mod** (plugin de *function hooks*, TSX) | Se dibuja en la UI nativa (terminal, desktop, móvil), sin ejecutar procesos externos. Mismo patrón que `sub-meter`. |
| Fuente del modelo | `$.session.model()` + `e.model` de `turn.step` | API oficial; `turn.step` refleja el modelo *realmente enviado* (incluye fallbacks). |
| Fuente del esfuerzo | `e.effort` de `turn.step` (solo hilo principal) | Es el nivel efectivo tras límites (`maxEffortLevel`, capacidades del modelo). |
| Ubicación en UI | **Compacto** en el pie (`SessionMode`) + **modo grande** opcional encima del prompt (`AbovePrompt`) | Convive con `sub-meter` (que ya usa `SessionMode`, ver captura). |
| Metodología | **Spec-driven + TDD** dentro de un **SSDF (NIST SP 800-218)** ligero | Calidad verificable y seguridad desde el diseño. |
| Superficie de ataque | **Cero capacidades**: sin `$.fs`, `$.process`, `$.model`, red ni tools | Un indicador visual no necesita más; se verifica en CI. |

---

## 2. Hallazgos de la investigación

### 2.1 Cómo está construido el ejemplo (`midudev/better-claude/plugins/sub-meter`)

- Estructura: `.claude-plugin/plugin.json`, `hooks/hooks.json` → `{ "modules": ["./register.tsx"] }`, `hooks/register.tsx`, `types/index.d.ts` (contrato de `$.state`), `hooks/register.test.tsx`, `tsconfig.json` que extiende `./.claude-plugin/types/tsconfig.json`.
- Opciones de usuario vía `userConfig` en `plugin.json` (aparecen en `/config`).
- Dibuja en `ui.render` sobre `{ component: 'SessionMode' }` (pie, abajo a la derecha), **componiendo** con lo que hay debajo (`next(e)`) y adaptándose al ancho (`e.viewport.columns`).
- Estado reactivo con `atom` / `read` / `update`; persistencia entre sesiones con `$.store`.
- CI (`.github/workflows/test.yml`): `claude plugin validate`, `claude plugin test`, matriz Node 22/24 × 3 SO.

Fuente: <https://github.com/midudev/better-claude/tree/main/plugins/sub-meter>

### 2.2 API relevante (tipos del motor, `claude-code.d.ts`)

| Necesidad | API | Notas |
| --- | --- | --- |
| Modelo actual | `$.session.model(): Promise<string>` | "the main loop's model, as `/model` shows it". |
| Modelo + esfuerzo efectivos | `on('turn.step', …)` → `e.model`, `e.effort` | `effort?: 'low'\|'medium'\|'high'\|'xhigh'\|'max'\|number`; ausente si el modelo no soporta esfuerzo o `CLAUDE_CODE_EFFORT_LEVEL=auto/unset`. Filtrar `e.agentId === undefined` (ignorar subagentes). Es *streaming*: **solo observar** y devolver `next(e)` sin modificarlo. |
| Inicio / fin de sesión | `session.start`, `session.end`, `classic.SessionStart` (`source: 'clear'`) | Igual que `sub-meter`. |
| Pie de la UI | `ui.render` `{ component: 'SessionMode' }` | Props `modes`; componer con `next(e)`. |
| Banda sobre el prompt | `ui.render` `{ component: 'AbovePrompt' }` | Para el modo "grande" (sprite 8-bit). |
| Superficie | `e.surface`: `terminal` \| `desktop` \| `vscode` \| `mobile` | Elementos vía `$.ui.resolve(e)`. |

### 2.3 Alternativa descartada: `statusLine` clásico

`settings.json → statusLine.command` recibe JSON con `model` y `effort.level` por stdin.
**Descartada** como vía principal: ejecuta un proceso de shell (mayor superficie de ataque), solo funciona en terminal y reemplaza la statusline que el usuario ya tenga. Se puede documentar como *fallback* para versiones antiguas.
Fuente: <https://code.claude.com/docs/en/statusline>

### 2.4 Incógnitas a resolver con *spikes* (Fase 0)

1. **Esfuerzo antes del primer turno**: `turn.step` no ha ocurrido aún. Probar `$.settings`/`settings.read` (clave `effortLevel`) y `$.store` (último valor conocido). Si no hay dato fiable → mostrar `?` en lugar de inventar.
2. **Cambios con `/model` o `/effort` entre turnos**: comprobar si algún evento (`config.set`, `command.run`, `prompt.submit`) permite refrescar sin esperar al siguiente turno.
3. **Ancho real** disponible junto a `sub-meter` en el pie (medir con `viewport.columns`).

---

## 3. Diseño funcional

### 3.1 Modo compacto (pie, por defecto)

```
◆ OPUS 5.5 ▮▮▯▯▯ MED · ⏵⏵ auto mode on
```

- Nombre del modelo normalizado: `claude-opus-5-5` → `OPUS 5.5`; sufijo `[1m]` → `1M`.
- Medidor de esfuerzo de 5 "píxeles": `low=1 … max=5`; numérico → escalado.
- Paleta retro por familia (tokens del tema: `claude`, `warning`, `success`…; nunca ANSI crudo).
- Degradación por ancho: completo → sin medidor → solo modelo → nada (como `sub-meter`).

### 3.2 Modo grande (opcional, `AbovePrompt`)

Sprite 8-bit con medios bloques (`▀ ▄ █`) por familia (Opus / Sonnet / Haiku / Fable / desconocido) + rótulo `PLAYER: OPUS 5.5  POWER: ▮▮▮▯▯`. Diseño original (no se replica ningún personaje ni arte existente).

### 3.3 `userConfig`

| Campo | Tipo | Default |
| --- | --- | --- |
| `placement` | `footer` \| `band` \| `both` | `footer` |
| `showEffortMeter` | boolean | `true` |
| `palette` | `classic` \| `gameboy` \| `mono` | `classic` |

---

## 4. Arquitectura

```
plugins/who-is-claude/
├── .claude-plugin/plugin.json
├── hooks/
│   ├── hooks.json
│   ├── register.tsx        # cableado de eventos y render (fino)
│   ├── model.ts            # PURO: normalizar id de modelo → { family, label }
│   ├── effort.ts           # PURO: nivel → { cells, label, color }
│   ├── sanitize.ts         # PURO: limpiar/acotar texto mostrado
│   ├── sprites.ts          # PURO: matrices de píxeles → filas de texto
│   └── *.test.ts(x)
├── types/index.d.ts        # contrato de $.state: { model, effort, seenAt }
├── tsconfig.json
└── README.md
.claude-plugin/marketplace.json   # el repo es un marketplace
```

Principios: **núcleo puro y testeable** (sin `$`), *hooks* finos, ninguna dependencia en tiempo de ejecución.

---

## 5. Seguridad (modelo de amenazas STRIDE resumido)

| Amenaza | Vector | Control |
| --- | --- | --- |
| *Tampering* | Un hook que reescriba `model`/`effort` | El mod **solo observa**: siempre `next(e)` intacto. Test que lo verifica. |
| *Spoofing / injection* en UI | Cadena de modelo con secuencias de control/ANSI o muy larga | `sanitize.ts`: allowlist `[A-Za-z0-9.\-\[\] ]`, longitud ≤ 32, tests de *fuzzing* con `fast-check`. |
| *Information disclosure* | Persistir datos sensibles | Solo se guarda `{ model, effort, seenAt }`. Sin rutas, prompts ni tokens. |
| *Elevation of privilege* | Uso de `$.fs`, `$.process`, `$.model`, red, `$.tool.register` | Prohibido. CI analiza la salida de `claude plugin validate` (lista lo que el módulo llama) contra una **allowlist**. |
| *DoS* | Timers o renders costosos | Sin `$.clock.every` salvo necesidad; cálculo O(1); cancelar en `session.end`. |
| Cadena de suministro | Dependencias / Actions comprometidas | Cero deps de runtime; devDeps fijadas con lockfile; Actions fijadas por **SHA**; Dependabot; `npm ci --ignore-scripts`. |

---

## 6. Controles de calidad y seguridad (*quality gates*)

Todo cambio entra por **PR** a `main` con *branch protection*; ningún gate es opcional.

| Gate | Herramienta | Umbral |
| --- | --- | --- |
| Validación del mod | `claude plugin validate` (CLI fijada a versión) | 0 errores |
| Allowlist de capacidades | script que parsea `validate` | Solo `session.model`, `store`, `ui.*`, `clock.now` |
| Tipos | `tsc --strict` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | 0 errores |
| Lint | ESLint + `typescript-eslint` *strict-type-checked* + `eslint-plugin-security` | 0 avisos |
| Formato | Prettier (o Biome) | `--check` |
| Tests lógicos | `node --test` + `c8` | Cobertura ≥ 95 % líneas/ramas del núcleo puro |
| Tests del mod | `claude plugin test` en `terminal` y `desktop` | 100 % verdes |
| Property-based | `fast-check` sobre `sanitize`/`model` | 1 000 casos |
| SAST | CodeQL (JS/TS) | 0 alertas ≥ medium |
| Secretos | GitHub secret scanning + `gitleaks` | 0 hallazgos |
| Dependencias | `npm audit --audit-level=low`, Dependabot, *dependency-review-action* | 0 vulnerabilidades |
| Workflows | `zizmor` / `actionlint`; `permissions: contents: read` | 0 hallazgos |
| Postura | OpenSSF Scorecard | ≥ 8/10 |
| Commits | Conventional Commits (commitlint) + commits firmados | Obligatorio |
| Releases | SemVer, `CHANGELOG.md`, *build provenance* (GitHub attestations) | Por tag |

Archivos de gobierno: `SECURITY.md`, `CODEOWNERS`, `CONTRIBUTING.md`, plantilla de PR con checklist de seguridad, `.editorconfig`.

---

## 7. Metodología

**Spec-driven + TDD (red → green → refactor)** en iteraciones cortas, enmarcado en NIST SSDF:

- **PO (Prepare)**: este plan, gates y CI antes del primer código de producto.
- **PS (Protect)**: protección de rama, firmas, Actions por SHA, mínimo privilegio.
- **PW (Produce)**: diseño puro/testeable, threat model, revisión (`/code-review`, `/security-review`) en cada PR.
- **RV (Respond)**: `SECURITY.md`, Dependabot, Scorecard periódico.

Cada historia: especificación (criterios de aceptación) → test que falla → implementación mínima → refactor → gates verdes → PR.

---

## 8. Plan por fases

| Fase | Entregable | Criterio de salida |
| --- | --- | --- |
| **0. Spikes** (½ día) | Prototipo desechable que registra `session.model()` y `turn.step` | Respuestas documentadas a las 3 incógnitas de §2.4 |
| **1. Andamiaje seguro** | `package.json` sin deps de runtime, tsconfig estricto, ESLint, Prettier, CI con todos los gates, `SECURITY.md`, `CODEOWNERS`, Dependabot, CodeQL, Scorecard | CI verde sobre un mod vacío que valida |
| **2. Núcleo puro (TDD)** | `model.ts`, `effort.ts`, `sanitize.ts`, `sprites.ts` + tests y property tests | Cobertura ≥ 95 % |
| **3. Modo compacto** | `register.tsx`: `turn.step` (observador), `session.*`, render `SessionMode` componiendo con lo de debajo | Tests de mod en `terminal` y `desktop`; convive con `sub-meter` |
| **4. Modo grande 8-bit** | Banda `AbovePrompt` con sprites y paletas | Tests de render y de ancho |
| **5. Config y persistencia** | `userConfig`, `$.store` del último valor conocido | Tests con `test(name, { options })` |
| **6. Hardening y release** | Revisión de seguridad, README con capturas, `marketplace.json`, tag `v0.1.0` con provenance | Todos los gates verdes; instalación con `/plugin install who-is-claude --marketplace at0mikd/who-is-claude` |

---

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La API de mods cambia entre versiones del CLI | Fijar versión de `claude` en CI; job semanal contra `latest`. |
| Esfuerzo desconocido hasta el primer turno | Mostrar `?` y último valor del `$.store` marcado como "previo". |
| Conflicto de espacio con otros mods del pie | Componer con `next(e)` y degradar por ancho; modo `band` como alternativa. |
| Fuentes sin soporte de bloques Unicode | Paleta/glifos `mono` ASCII de reserva. |

---

## 10. Referencias

- Ejemplo: <https://github.com/midudev/better-claude/tree/main/plugins/sub-meter>
- Plugins de Claude Code: <https://code.claude.com/docs/en/plugins>
- Statusline clásica: <https://code.claude.com/docs/en/statusline>
- Tipos del motor (local, v2.1.327): `claude-code.d.ts` — `session.model` (l. 3256), `TurnStepInput.effort` (l. 17465), `SessionMode`/`AbovePrompt` (l. 12659–12730)
- NIST SSDF SP 800-218: <https://csrc.nist.gov/pubs/sp/800/218/final>
- Hardening de GitHub Actions: <https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions>
- OpenSSF Scorecard: <https://github.com/ossf/scorecard>
- SLSA / provenance: <https://slsa.dev>
