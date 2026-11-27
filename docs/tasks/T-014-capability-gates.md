# T-014 · Capability gates cover everything the plugin and the marketplace declare

- **Status:** In progress
- **Branch:** `fix/T-014-capability-gates`
- **Plan:** `docs/PLAN.md` §5–§6; T-013 audit, leads N1 and N2 (`docs/security/audit-v0.1.0-security-audit-skill.md`)

## Goal

Close two gaps in the capability gates that the T-013 audit left as `needs_validation`:

- **N1.** `scripts/check-capabilities.mjs` checks only the hook module's `$` calls, env and `$.state`. It never reads the rest of what `claude plugin validate --json` reports the plugin provides: classic command hooks, MCP or LSP servers, `bin`, and so on.
- **N2.** The gates check the hard-coded folder `plugins/model-meter`. Nothing ties `.claude-plugin/marketplace.json`, which is what installers actually read, to that folder.

The fix is applied **whether or not** the pinned CLI already rejects these cases. The gates must fail closed on their own, and the validation step only records whether the gap was real.

## Scope

**In:**

1. **Validate N1 and N2 first** (evidence only, no fix depends on it). In a throwaway clone with the pinned CLI (≥ 2.1.327), record the exit codes of `npm run validate`, `npm run test:mod` and `npm run capabilities` for:
   - a classic `SessionStart` command hook added to `hooks/hooks.json`;
   - `mcpServers` added to `plugin.json`;
   - the five `marketplace.json` variants of the report: the source pointing to `./spikes/wic-spike`, inline hooks and MCP on the entry, a second entry, a GitHub source, and a `metadata.pluginRoot` shadow.
2. **N1, `findViolations`:**
   - read the report's `provides` block (or its real name in the pinned CLI's report, taken from a real fixture);
   - every list in it must be empty, except `modules`, which must be exactly `hooks/register.tsx`;
   - if the block is missing or has an unexpected shape, fail closed, as the function already does for `contents`.
3. **N2, a marketplace gate,** pure, with no CLI: a new `scripts/check-marketplace.mjs` run inside `npm run check` (so it is part of the required `check:core` checks):
   - exactly one entry in `plugins`, with `name: "model-meter"` and `source: "./plugins/model-meter"`;
   - each entry and the top level take only an **allowlist** of keys (today: `name`, `source`, `description`, `version`, `category` on the entry; `name`, `owner`, `metadata` at the top), so any entry-level component (`hooks`, `mcpServers`, `lspServers`, `commands`, `agents`, …) fails;
   - no `metadata.pluginRoot`, and no `strict: false`;
   - its `version` equals `plugin.json`'s (already checked at release time; checking it here too costs nothing).
4. **Docs:** `SECURITY.md` and PLAN §5 say the gates cover the plugin's declared components and the marketplace entry, not only the hooks module.

**Out:**

- Any change to the mod's runtime code.
- Testing what the installer loads in a live profile; record it only if the validation step makes it necessary, as a new lead.

## Acceptance criteria

- **AC1** — The validation table of scope item 1, with the exit code of each gate per variant, in the pull request.
- **AC2** — `check-capabilities.test.mjs`: one regression fixture per addition (classic hook, `mcpServers`, `lspServers`, `bin`, an extra module, a missing `provides` block), each failing with a clear message; the real fixture still passes.
- **AC3** — `check-marketplace.test.mjs`: the five variants of the report, an unknown key on the entry, an unknown top-level key, a version mismatch, and the real file passing.
- **AC4** — `npm run check` green; the new script runs inside it; no new dependencies.
- **AC5** — The mutation check: removing the new conditions one at a time makes a test fail (the Reviewer runs it on the pull request).

## Security constraints

- Allowlists, not denylists: a key or component the gates do not know fails.
- No network, no CLI calls in the marketplace gate.
- No change to the `$` allowlist.

## Required evidence

- The validation table (AC1).
- `npm run check` output.
- The new tests' names and results.
