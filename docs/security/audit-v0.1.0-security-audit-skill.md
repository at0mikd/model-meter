# Security audit of v0.1.0 with Cloudflare's `security-audit` skill

- **Task:** T-013.
- **Skill:** [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) at commit `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (MIT). It was installed at user level, outside this repository.
- **Mode:** full audit, all six phases, profile `standard`, whole repository in scope, no budget.
- **Reviewed source:** `main` at `488052e` (v0.1.0 is `e844730`, an ancestor), clean worktree.
- **Result:** **0 confirmed** findings, **9 `needs_validation`** leads, **3 rejected** candidates. No lead is an exploitable vulnerability in the published v0.1.0.

The full run (ledger, records, agent outputs, local artifacts) stays outside the repository. This file is its sanitized summary.

## How the audit ran

1. **Reconnaissance** (4 agents): the product, principals, entry surfaces, sinks and what can run offline. It produced an architecture summary and a coverage ledger of attack-class units.
2. **Hunting** (4 waves, 12 hunters), each wave followed by a coverage critic. Critics added 5 units, plus 2 surfaces the hunters reported. Two distinct final-clean critics ran. The last one, after wave 4, accepted no further work.
3. **Candidate validation:** one fresh verifier per candidate (12). None of them had hunted it.
4. **Structured output:** `findings.json`, checked with the skill's validators.
5. **Final record verification:** one fresh verifier per retained record (9). Results: 7 verified, 2 non-material replacements (a validation plan moved from `local` to `deployment`; a wording made narrower, with one more preventing layer and blocker). Neither changed a verdict, fingerprint, trace or impact.
6. **Reports**, derived from the final records.

### Execution (sandbox)

Target code ran only inside an OS-enforced sandbox:

- **bubblewrap:** new user, pid, ipc, uts, cgroup and network namespaces, so there was no external network.
- **Environment:** cleared, plus an explicit allowlist.
- **Read-only:** the root, `/usr`, the target, and a local `node_modules`. The only writable path was a 64 MiB tmpfs scratch.
- **Limits:** systemd scope with `TasksMax=64`, `MemoryMax=1G`, no swap and `CPUQuota=100%`; rlimits on file size, open files and core; a wall-clock timeout of 300 s at most.
- **Artifacts:** written only by the trusted runner, created exclusively and capped in size.

What ran there: the core and script tests (`node --test`), small harnesses over `hooks/core`, the scripts, the release packaging (against dummy repositories), and git experiments on throwaway local repositories.

These could not run in the sandbox, so their checks stayed source-only or became `needs_validation`:

- the `claude` CLI (`validate`, `test:mod`, `capabilities` end to end, `register.test.tsx`);
- the npm registry (`npm audit`, `npm ci`);
- the repository's git directory (`package.test.mjs`, commitlint).

No external service, release, or live session was probed.

Some deployment facts were observed by the Maintainer while cutting v0.1.0, outside the audit. Verifiers could use them as context:

- the repository's release-immutability setting;
- the `v*` tag ruleset;
- the v0.1.0 attestation, which `gh attestation verify` showed bound to `release.yml@refs/tags/v0.1.0` and to commit `e844730`.

### Validators

```text
$ node validate-findings.cjs findings.json
PASS: 12 findings valid
$ node validate-coverage-ledger.cjs coverage-ledger.json
PASS: 34 coverage units valid
```

## Summary

The published mod came out clean. Every unit for the mod's runtime closed as covered, most with bounded local checks:

- terminal-escape injection through host values;
- options;
- stored state;
- the state contract;
- persisted data;
- render composition with other mods.

CI and release also show strong controls in source:

- `pull_request` triggers only, a read-only token, no secrets, `persist-credentials: false`;
- actions pinned by SHA, tool downloads checked against a sha256;
- environment-only interpolation in run steps;
- a signed-tag gate with manifest, ancestry and signature checks;
- empty top-level permissions with per-job grants.

What remains are **leads**. Each one depends on a fact that source cannot show: Claude Code engine behaviour, GitHub-hosted behaviour, or the agents' process. They have **no severity**: the skill gives severity only to confirmed records.

## Needs-validation leads: product gates and release

### N1. The capability gate ignores package-level components in the validate report

- **Fingerprint:** `scripts/check-capabilities.mjs:findViolations:provides-unchecked`
- **Trace:**
  - `plugins/model-meter/hooks/hooks.json:2`
  - `scripts/check-capabilities.mjs:227-270`: `findViolations` checks only the hook module's `$` calls, env and `$.state`, and the gating hook's `.catch`.
  - `scripts/check-capabilities.mjs:353`: prints `capabilities: ok`.
- **Evidence:** the gate never reads the report's `provides` block (classic command hooks, `mcpServers`, `lspServers`, `bin`, …). The sandboxed harness (`main()` fed the real validate fixture) exited 0 with `capabilities: ok` when a classic command hook, `mcpServers` or `bin` were added. Control: a `$.process.spawn` call exited 1. `hooks.json` and `plugin.json` are already in the published file list, so the list check does not flag either change. SECURITY.md (lines 34-36) and PLAN §5 rely on this gate.
- **Blockers:**
  - whether the pinned CLI 2.1.327 lists such additions in its report;
  - whether `validate --strict` or `plugin test` would reject them on their own.

  The pinned CLI was not available.
- **Next step:** in a throwaway clone with the pinned CLI, add a classic `SessionStart` command hook to `hooks.json`, then `mcpServers` to `plugin.json`. Run `validate`, `test:mod` and `capabilities`, and record their exit codes.
- **Fix direction if it holds:** in `findViolations`, require every `provides` list other than `modules` to be empty, and `modules` to be exactly `hooks/register.tsx`. Add a regression fixture for each addition.

### N2. The capability gates check a hard-coded plugin folder, not what `marketplace.json` tells installers to load

- **Fingerprint:** `marketplace-entries-outside-capability-gate:.claude-plugin/marketplace.json:scripts/check-capabilities.mjs:PLUGIN_DIR`
- **Trace:**
  - `.claude-plugin/marketplace.json:13`
  - `scripts/check-capabilities.mjs`: `PLUGIN_DIR = 'plugins/model-meter'`.
  - `package.json`: `validate` and `test:mod` run on that same folder.
  - `README.md:36`: the user's `/plugin install`.
- **Evidence:** no required gate ties the marketplace entries to the folder the gates check: the entry's `source`, extra entries, entry-level `hooks`/`mcpServers`, `metadata.pluginRoot` and `strict`. In a sandboxed harness (with a stubbed CLI), five variants of `marketplace.json` left every repository gate's output identical to the baseline:
  - the source pointing to `./spikes/wic-spike`;
  - inline hooks and MCP;
  - a second entry;
  - a GitHub source;
  - a `pluginRoot` shadow.
- **Blockers:**
  - whether `claude plugin validate .` (pinned 2.1.327) fails for those variants;
  - how the 2.1.327 installer applies those fields;
  - the required-check list on `main`, which is a hosted fact.
- **Next step:** in a throwaway clone with the pinned CLI, run the five variants through `validate`, `test:mod` and `capabilities`. Then use a disposable config dir to see what the installer loads.
- **Fix direction if it holds:** add a gate that requires exactly one marketplace entry, named `model-meter`, with `source: ./plugins/model-meter`, no entry-level components and no `pluginRoot`.

### N3. The release attests and publishes the package artifact by name, with no digest bound to the package job

- **Fingerprint:** `release.yml/package-artifact/consumed-by-name-without-package-job-digest`
- **Trace:**
  - `.github/workflows/ci.yml:57`: install scripts run in the release run's CI jobs.
  - `release.yml:105-106`: an in-job `sha256sum --check` against a `SHA256SUMS` written beside the archive, then upload as `package`.
  - `release.yml:121, 144`: download by name.
  - `release.yml:157`: `gh release create`.
- **Evidence:** the only integrity check is self-referential. No digest leaves the `package` job as an output for `attest` (`subject-digest`) or `release` to compare. A sandboxed fixture swapped the archive and regenerated `SHA256SUMS`, as a post-upload substitution would: the documented check still passed, and a check against the package-job digest failed. The published v0.1.0 archive itself was observed attested by `release.yml` at the tag's commit.
- **Blockers** (all are GitHub-hosted behaviour or a missing prerequisite):
  - whether a CI job's runtime token can still replace an artifact after that job ends;
  - whether one job may overwrite another job's artifact;
  - how a step's child process would get that token;
  - the prerequisite itself: hostile code in a CI job of the release run (a compromised CLI or devDependency).
- **Next step:** in a throwaway private repository with the same action SHAs, test whether a finished job's token can replace another job's artifact.
- **Fix direction if it holds:** emit the archive's sha256 as a `package` job output. Then verify it after each download, and pass it as `subject-digest` to the attestation.

### N4. The documented release check pins only the repository, and takes its checksum from the same release assets

- **Fingerprint:** `docs/RELEASING.md/verify:repo-scoped-attestation-same-release-checksums-mutable-assets`
- **Trace:** `docs/REPO-SETTINGS.md:125` → `release.yml:119-127` → `docs/RELEASING.md:85-86`.
- **Evidence:** `gh attestation verify --repo` without `--signer-workflow` / `--source-ref` / `--source-digest` ties the archive only to the repository. The binding to `release.yml` and to the tag exists only as prose at line 89. Also, `SHA256SUMS` sits beside the archive it checks.
- **Blockers:**
  - whether the release-immutability setting, enabled after v0.1.0 was published, covers v0.1.0 (it showed `immutable: false` before the setting was enabled);
  - the default policy of the `gh` version in use;
  - whether a same-repository branch workflow can get `id-token: write`;
  - whether anyone relies on §5's exit status alone.
- **Next step** (owner-observed, read only):
  - check `isImmutable` on v0.1.0;
  - run the pinned form: `gh attestation verify model-meter-0.1.0.tar.gz --repo at0mikd/model-meter --signer-workflow at0mikd/model-meter/.github/workflows/release.yml --source-ref refs/tags/v0.1.0 --source-digest <tag commit>`.
- **Fix direction if it holds:** document the pinned form in RELEASING.md §5, and treat `SHA256SUMS` as a convenience, not as the trust root.

## Needs-validation leads: repository agent workflow

These five concern how the Builder and Reviewer agents and the Maintainer work, not the published mod. As the Maintainer decided, their traces, blockers and validation steps stay in the private audit run and go to the Reviewer, and only titles and fix directions are public here.

| # | Lead | Fix direction |
| --- | --- | --- |
| N5 | The Builder's allow rules pre-approve broader effects than intended | Replace argument-unbounded allow prefixes with exact commands, so these effects need a prompt |
| N6 | The merge approval is bound to an abbreviated head SHA | Require the full 40-hex SHA in the approval and the record, and compare it exactly |
| N7 | The "update keeps the approval" check can run against a stale base | Fetch and pin the current `main` SHA before the check, and require exact parents |
| N8 | The cloud Reviewer's checks on lower-trust PR heads run beside its push credential | Judge fork and Dependabot heads from the diff and CI, or run them only without credentials |
| N9 | The Reviewer's non-merge GitHub writes have no deterministic scope | Record and narrow the session credential's permissions, and add deterministic deny rules for write APIs |

## Rejected candidates

3 candidates were disproved during validation. They are kept in the run so later runs do not repeat them without new evidence:

- **Cross-session messages as an instruction channel:** refuted by `docs/WORKFLOW.md:105`, which is an exclusive list, and by lines 24-26.
- **`/build` taking a task from any checked-out ref:** no lower-trust principal can write that context.
- **The marketplace serving `main` outside the signed tag:** by design. The approved merge to `main` is the gate on what users run, and the tag snapshots a commit that already passed it.

## Coverage

The ledger has 34 units: 21 covered and 13 with candidates (a unit can link one candidate). None are deferred, blocked or out of scope. The final-clean critic accepted no further work.

| Attack class (block) | Units | Result |
| --- | --- | --- |
| Injection (terminal escapes, release notes, arguments) | 2 | covered |
| Business logic (options, stored state, audit gate, capability gate parsing, commitlint skip) | 5 | 4 covered, 1 candidate (N1) |
| Access control (state contract) | 1 | covered |
| Feature abuse and data leakage (what the mod persists) | 1 | covered |
| Chained trust (render composition with other mods) | 1 | covered |
| Resource and file handling (package paths) | 1 | covered |
| Cryptography and secrets; obvious things; wildcard | 3 | covered |
| Supply chain: untrusted code in workflows, workflow commands, mutable inputs, identity overreach, dependency sources, build-context inclusion | 6 | covered |
| Supply chain: release authorization (tag, distribution path) | 2 | 1 covered, 1 candidate (rejected) |
| Supply chain: build-to-promotion, cache/artifact mixing | 3 | candidates (N3, N4) |
| Supply chain: plugin trust expansion (mod package, marketplace entries) | 2 | candidates (N1, N2) |
| AI/agents: sensitive context extraction (spike) | 1 | covered |
| AI/agents: agency, approval binding, ingested content, standing instructions, session messages | 6 | candidates (N5-N9; 2 rejected) |

Domains not selected, and why:

- **Web/auth:** no HTTP or identity code.
- **Client-side:** the mod renders terminal nodes, not a DOM.
- **Cloud:** only GitHub-hosted CI, covered as supply chain.
- **Protocols:** none.
- **Data isolation:** a single allowlisted value per user.
- **Desktop/IPC:** the mod runs in the host's plugin runtime.
- **Memory safety:** TypeScript/JavaScript only.
- **Resource exhaustion:** no shared service, and render cost falls on the same user.

The run produced 42 hardening notes, which are not findings. Examples:

- escape manifest and advisory strings before printing them in Actions;
- pin `zizmor`'s build;
- check the remote tag still points to the run's commit before publishing;
- give `package.mjs` its own version regex and exclusive output files;
- check that the `.catch` on gating hooks passes the event through.

They are listed in the run's report.
