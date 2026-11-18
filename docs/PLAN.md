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
| Ubicación en UI | **Compacto** en el pie (`SessionMode`) por defecto; **modo grande** (`AbovePrompt`) opcional y modo **`auto`** según el ancho | Pensado para usar Claude Code a media pantalla; convive con `sub-meter` (ver §3.4). |
| Visibilidad del repo | **Público** | Controles adicionales en §6.1. |
| Nombre del plugin | **`model-meter`** (repo y marketplace siguen como `who-is-claude`) | Claude Code 2.1.327 rechaza en `validate --strict` el nombre `who-is-claude` («reads as one of Anthropic's own»), y `--strict` es la barrera de tipos de los hooks. Decisión del Maintainer; coherente con `sub-meter`, `context-meter`, `token-meter`. |
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

Fuentes candidatas para el punto 1 ya identificadas en los tipos: `$.settings.read({ key: 'effortLevel' })` y `$.env.get('CLAUDE_CODE_EFFORT_LEVEL')` (ambas aparecen en el informe de `claude plugin validate`, por lo que entran en la allowlist de forma auditable).

**Resultados del spike (2026-11-18, sesión cloud, CLI 2.1.327):**

| Fuente | Resultado |
| --- | --- |
| `$.session.model()` en `session.start` | `claude-opus-5-5` ✅ disponible desde el arranque |
| `turn.step` (hilo principal) | `model: claude-opus-5-5`, `effort: "medium"` ✅ coincide con la UI |
| `$.settings.read({ key: 'effortLevel' })` | `undefined` (no configurado en esta sesión) |
| `CLAUDE_CODE_EFFORT_LEVEL` / `CLAUDE_EFFORT` | `undefined` (no definidas en el proceso del motor) |
| Renders `SessionMode` / `AbovePrompt` | No se dispararon: la sesión cloud vista desde la app no dibuja ese pie → validar en terminal local |

~~Decisión inicial: cascada `settings.effortLevel` → `CLAUDE_CODE_EFFORT_LEVEL` → `$.store` → `?`.~~ **Sustituida tras T-000** (ver abajo).

**Resultados de T-000 en terminal** (`docs/spikes/T-000-results.md`, Fedora + Ghostty, CLI 2.1.327):

| Pregunta | Resultado |
| --- | --- |
| `/model` entre turnos | `command.run` + `config.set { key: "model", value: <alias>, previous }` **antes** del siguiente `turn.step`; `$.session.model()` ya devuelve el id nuevo |
| `/effort` entre turnos | Solo `command.run`; sin `config.set`. El nivel nuevo se conoce en el siguiente `turn.step` |
| `settings.effortLevel` | **No fiable**: vale `medium` mientras el esfuerzo efectivo es `xhigh`/`high`; `/effort` guarda su valor en otro sitio |
| Variables de entorno | `CLAUDE_CODE_EFFORT_LEVEL` y `CLAUDE_EFFORT` vacías |
| Viewport | 95×47 a media pantalla, 191×47 maximizada; `bodyColumns = columns − 5`; `maxRows` 18 en uso |
| `isFullscreen` | `true` con el renderer fullscreen (a cualquier ancho), `false` con el clásico |

**Decisiones (vigentes):**

1. **Esfuerzo antes del primer `turn.step`:** último valor de `$.store`, atenuado y marcado como previo; si no hay, `?`. No se leen settings ni variables de entorno: `$.settings.read` y `$.env.get` **salen de la allowlist**.
2. **`/model`:** un hook `config.set` (solo observa) con `key === "model"` refresca con `$.session.model()` al momento.
3. **`/effort`:** `on('command.run', { command: 'effort' }, …)` (solo observa; `command` llega sin barra y con alias resueltos, `args` es lo escrito tras el nombre, y el evento llega **antes** de que el comando se ejecute):
   - `args` vacío (selector interactivo) → **pendiente** con el último valor conocido.
   - `args` que es un nivel válido (`/effort high`) → **pendiente** mostrando ese nivel.
   - En ambos casos lo confirma o corrige el siguiente `turn.step`: el comando puede fallar o el modelo puede limitar el nivel.
   - `args` pasa por la sanitización y una allowlist de niveles; cualquier otro valor se ignora.
4. **Ancho propio de `sub-meter`:** se mide en el producto, sobre el nodo que devuelve `next(e)` en `SessionMode`, con tests de degradación por ancho.
5. **Probar el mod con `/model` o `/effort` cambia el valor por defecto del usuario:** se avisa en el README («Cómo probar»).
6. **Hooks en puntos que pueden bloquear un evento** (`config.set`, `command.run`, `prompt.submit`): son observadores y deben **dejar pasar siempre**. Un hook que lanza una excepción ahí se salta y el evento sigue, pero un hook que devuelve **sin** llamar a `next(e)` se queda con el evento y anularía el `/model` o el `/effort` del usuario. Por eso:
   - el cuerpo va en `try/catch` y siempre termina en `return next(e)`;
   - cada uno lleva un `.catch` explícito que deja pasar (`($, e, next) => next(e)`; si `next` ya se llamó, eso repite su resultado sin volver a ejecutar nada), para que el fallo hacia «dejar pasar» sea una decisión escrita;
   - tests que prueban que el comando llega intacto a lo que hay debajo, incluso si la lógica interna lanza;
   - `check-capabilities` falla si `validate --json` lista algún `gatingHooks` sin `.catch`.


El *spike* `wic-spike` (fuera del repositorio) registra `session.start`, `prompt.submit`, `turn.step`, `config.set`, `command.run` y los renders `SessionMode`/`AbovePrompt`, y expone lo observado mediante una herramienta de solo lectura.

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
| `placement` | `footer` \| `auto` \| `band` | `footer` |
| `autoMinColumns` | number | `140` |
| `showEffortMeter` | boolean | `true` |
| `palette` | `classic` \| `gameboy` \| `mono` | `classic` |

### 3.4 Evaluación: modo `auto` (compacto a media pantalla, grande a pantalla completa)

**Viable.** Cada `ui.render` recibe `e.viewport = { columns, rows, isFullscreen? }` y, en la terminal, un cambio de ancho redibuja todos los sitios enganchados al asentarse el redimensionado. No hacen falta timers ni sondeos.

| Señal | ¿Sirve? | Motivo |
| --- | --- | --- |
| `viewport.columns` | **Sí, señal principal** | Refleja el ancho real de la terminal y dispara redibujado. |
| `viewport.rows` | Secundaria | Informativa: un cambio *solo* de alto no redibuja. |
| `viewport.isFullscreen` | **No** como criterio | Indica el modo de pantalla alternativa de Claude Code (fijo por sesión), no si la ventana está maximizada. |
| `AbovePrompt.props.bodyColumns` / `maxRows` | Sí, para dimensionar el sprite | Ancho útil real de la banda (descuenta un `Pane` acoplado). |

Regla propuesta para `placement: auto`:

- Pie compacto **siempre** (es la información esencial).
- Se añade la banda grande si `columns ≥ autoMinColumns` (140 por defecto) **y** `maxRows` permite el sprite (≥ 6 filas). Confirmado en T-000: 95 columnas a media pantalla y 191 maximizada; `maxRows` = 18 en uso.
- **Histéresis** para evitar parpadeo al redimensionar: entra con ≥ 140 y sale con < 120.
- `mobile` → siempre compacto; `desktop` → según el viewport que informe el cliente.

Referencia orientativa: un monitor de 1920 px con fuente de 14 px da ~200 columnas a pantalla completa y ~95–110 a media pantalla, por lo que 140 separa bien ambos casos. Se ajustará con los datos del spike.

**Coste:** la banda ocupa filas verticales encima del prompt en cada turno (comparte espacio con las encuestas del motor y el usuario puede plegarla con `[-]`). Por eso el default es `footer` y `auto` es *opt-in*; se reevaluará como default tras usarlo.

---

## 4. Arquitectura

```
plugins/model-meter/
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
| Allowlist de capacidades | script que parsea `claude plugin validate --json` | Solo `$.session.model`, `$.store.*`, `$.ui.*`, `$.clock.now`; **ninguna** variable de entorno |
| Tipos | Núcleo puro: `tsc --strict` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Hooks: `claude plugin validate --strict` (comprueba los tipos del motor sin incluirlos en el repo) | 0 errores |
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
| Commits | Conventional Commits (commitlint); `main` solo por squash merge firmado por GitHub | Obligatorio |
| Releases | SemVer, `CHANGELOG.md`, *build provenance* (GitHub attestations) | Por tag |

### 6.1 Controles adicionales por ser repositorio público

- *Secret scanning* con **push protection** y **private vulnerability reporting** activados.
- *Ruleset* en `main`: PR obligatorio con **0 aprobaciones requeridas**, checks de estado requeridos (desde T-001), solo squash merge, historial lineal, commits firmados, sin *force-push* ni borrado. No se exige revisión de `CODEOWNERS`: los PRs los abre la cuenta del Maintainer (vía `gh` del Builder) y GitHub no permite aprobar un PR propio, así que bloquearía toda fusión. La aprobación humana queda registrada como se describe en `docs/WORKFLOW.md` §6.
- Workflows activados por `pull_request` (nunca `pull_request_target` con checkout del PR); `GITHUB_TOKEN` de solo lectura por defecto; aprobación manual para workflows de forks de primeros contribuidores.
- Publicación del resultado de OpenSSF Scorecard (badge) y licencia MIT ya presente.
- Sin datos personales en el código, los fixtures ni el historial (revisión con `gitleaks` también sobre el historial completo).

Archivos de gobierno: `SECURITY.md`, `CODEOWNERS`, `CONTRIBUTING.md`, plantilla de PR con checklist de seguridad, `.editorconfig`.

---

## 7. Metodología

**Spec-driven + TDD (red → green → refactor)** en iteraciones cortas, enmarcado en NIST SSDF:

- **PO (Prepare)**: este plan, gates y CI antes del primer código de producto.
- **PS (Protect)**: protección de rama, firmas, Actions por SHA, mínimo privilegio.
- **PW (Produce)**: diseño puro/testeable, threat model, revisión (`/code-review`, `/security-review`) en cada PR.
- **RV (Respond)**: `SECURITY.md`, Dependabot, Scorecard periódico.

Cada historia: especificación (criterios de aceptación) → test que falla → implementación mínima → refactor → gates verdes → PR.

**Patrón Reviewer–Builder** (detalle en `docs/WORKFLOW.md`): una sesión Claude Code en la nube diseña, planifica y revisa; una sesión Claude Code local del mantenedor implementa y prueba en el entorno real (terminal, CLI `claude`); la persona aprueba y fusiona. Las tareas viven en `docs/tasks/` con criterios de aceptación verificables, y GitHub (ramas y PRs) es el canal y el registro auditable.

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
| **6. Hardening y release** | Revisión de seguridad, README con capturas, `marketplace.json`, tag `v0.1.0` con provenance | Todos los gates verdes; instalación con `/plugin install model-meter --marketplace at0mikd/who-is-claude` |

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
