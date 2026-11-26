# Tasks

The backlog of the Reviewer–Builder workflow (`docs/WORKFLOW.md`). The Reviewer writes each task and sets it to `Ready`; the Builder carries it out with `/build T-NNN`.

| ID | Title | Plan phase | Status |
| --- | --- | --- | --- |
| [T-000](T-000-spike-terminal.md) | Terminal spike: `/model`, `/effort` and the footer's width | 0 | Done |
| [T-001](T-001-scaffold.md) | Repository layout, local gates and CI | 1 | Done |
| [T-002](T-002-pure-core.md) | Pure core: model, effort, sanitization and fit by width | 2 | Done |
| [T-003](T-003-compact-footer.md) | Compact footer badge | 3 | Done |
| [T-003b](T-003b-footer-room.md) | Real room in the footer: the badge at half screen next to `sub-meter` | 3 | Done |
| [T-004](T-004-band-auto.md) | 8-bit band above the prompt and `auto` placement | 4 | Done |
| [T-007](T-007-audit-expiry-warning.md) | Early warning on expiring exceptions, and a weekly audit | 1 | Done |
| [T-008](T-008-ci-dependabot-names.md) | CI: Dependabot commits and a stable name for the mod job | 1 | Done |
| [T-009](T-009-review-debts.md) | Review debts: measure what is drawn across the row, test the commitlint guard | 3 | Done |
| [T-010](T-010-sprites-mythos.md) | High-quality 8-bit sprites (12×12, three colors) and the Mythos family | 4 | Done |
| T-011 | Palettes (`classic`, `gameboy`, `mono`) and `showEffortMeter` | 5 | Optional, later (not specified yet) |
| [T-012](T-012-hardening-release.md) | Hardening and the v0.1.0 release | 6 | Done |
| [T-013](T-013-security-audit.md) | Full security audit with Cloudflare's `security-audit` skill | 6 | In review |

## Task format

A header with `Status`, `Branch` and `Plan`; then Goal, Scope (in / out), Acceptance criteria (AC), Security constraints and Required evidence.
