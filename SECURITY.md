# Security policy

## Reporting a vulnerability

Please use **GitHub's private vulnerability reporting**: the repository's *Security* tab → *Report a vulnerability*. Do not open a public issue or pull request with the details.

If you can, include:

- the version of the mod (`model-meter`) and of Claude Code;
- what goes wrong and how to reproduce it;
- the impact you believe it has.

You will get an acknowledgement within a reasonable time and updates until the fix. If the report is confirmed, a GitHub Security Advisory is published, crediting you as you prefer.

## Supported versions

| Version | Supported |
| --- | --- |
| Latest release | ✅ |
| Earlier releases | ❌ (please upgrade) |

## Scope

- **In scope:** the mod (`plugins/model-meter/`) and this repository's scripts and workflows.
- **Out of scope:**
  - `spikes/`: throwaway code that is never published;
  - Claude Code itself: please report that to Anthropic.

## What counts as a security bug here

The mod must **only observe**.

- It may not rewrite or block engine events.
- It may not use files, processes, the network or environment variables.

Any way around that is a security bug. So is injecting control sequences into what it draws, or leaking session data. The allowed capabilities are listed in [`docs/PLAN.md`](docs/PLAN.md) §5–§6, and CI checks them on every pull request.

## Controls in place

- **Capabilities:**
  - a closed allowlist of engine calls (`npm run capabilities`);
  - `claude plugin validate --strict`;
  - pass-through checks on every hook that can gate an event.
- **Supply chain:**
  - no runtime dependencies, and exact development versions;
  - GitHub Actions pinned by SHA;
  - Dependabot, dependency review, CodeQL (`security-extended`), gitleaks, actionlint, zizmor and OpenSSF Scorecard.
- **Branch protection:** `main` only changes through pull requests, with 12 required checks, a linear history and signed commits. The settings are in [`docs/REPO-SETTINGS.md`](docs/REPO-SETTINGS.md).

## Active exceptions

These are security advisories accepted for a limited time, each with the Maintainer's approval and an expiry date.

- **Source of truth:** [`security/audit-exceptions.json`](security/audit-exceptions.json).
- **When `npm run audit` fails:**
  - any other advisory appears;
  - an exception expires or becomes stale;
  - an exception affects runtime code;
  - `allow-ghsas` in `dependency-review.yml` does not match.
- **Renewal:** renewing an exception requires a new approval from the Maintainer.

So that an expiry never comes as a surprise:

- **14-day warning.** From 14 days before an exception expires, `npm run audit` prints a warning with the GHSA, the date and the days left, without failing. On GitHub Actions it is also an annotation (`::warning`), visible in the run and PR summaries. The day after the expiry date, the audit fails.
- **Weekly audit.** The `Scheduled audit` workflow (`.github/workflows/audit-schedule.yml`) runs every Monday on `main`, even with no open pull requests, and can be run by hand.
  - It runs `npm run audit` and audits the pinned CLI's lockfile.
  - It only reads the repository. If it fails, GitHub notifies the Maintainer through their standard notification email.
- **Paused scheduled workflows.** GitHub disables scheduled workflows in a public repository after 60 days without activity, and the weekly audit then stops until it is re-enabled ([GitHub docs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)). Re-enable it from the *Actions* tab, under the `Scheduled audit` workflow.

None at the moment. The last one, [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) (`picomatch`, development only), was removed when GitHub withdrew the advisory on 2026-11-18.
