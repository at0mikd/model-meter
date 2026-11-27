# Contributing

Thanks for your interest in model-meter. The project follows the **Reviewer–Builder** workflow described in [`docs/WORKFLOW.md`](docs/WORKFLOW.md); please read it before you start. The design and its decisions are in [`docs/PLAN.md`](docs/PLAN.md), and the work ahead is in [`docs/tasks/`](docs/tasks/).

## Ways to contribute

- **Report a bug or suggest an idea:** open an issue with one of the templates.
- **Report a vulnerability:** never in a public issue. Follow [`SECURITY.md`](SECURITY.md).
- **Code:**
  - every change starts from a task in `docs/tasks/` with the status `Ready`;
  - if you want to work on something that has no task yet, open an issue first, so it can be specified.

## Requirements

- Node.js 22.15 or later. The core tests use `module.registerHooks`; the mod itself runs inside Claude Code's engine.
- Claude Code 2.1.327 or later (the `claude` CLI) for the mod's gates.

## Getting started

```bash
npm ci --ignore-scripts
npm run check        # every gate (needs the claude CLI)
npm run check:core   # the gates that do not need the CLI
```

| Script | What it checks |
| --- | --- |
| `typecheck` | The pure core and the scripts, with strict TypeScript |
| `lint` | ESLint (`strict-type-checked` and `eslint-plugin-security`), zero warnings |
| `format:check` | Prettier |
| `test:node` | `node --test` tests (core in `test/`, scripts in `scripts/`), with coverage ≥ 95% (`c8`) |
| `commitlint` | Conventional Commits on the branch's commits |
| `validate` | `claude plugin validate --strict` of the mod and the marketplace |
| `test:mod` | `claude plugin test` of the mod |
| `audit` | `npm audit` with no advisories beyond the approved, unexpired exceptions in `security/audit-exceptions.json` |
| `capabilities` | The mod uses only the allowed capabilities, and its hooks let events through |

## Conventions

- **One task, one branch from `main`, one pull request.** Fill in the template with real evidence: command output, not summaries.
- **TDD:** a failing test first, then the minimal implementation, then the refactor.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/), with a lowercase subject after the type, e.g. `fix(core): measure the hint as drawn`.
- **Dependencies:** no runtime dependencies. Development dependencies use exact versions.
- **Language:**
  - documentation, comments and identifiers in English;
  - user-facing text in the terminal stays lowercase, except the model's name.
- **Never commit** secrets, personal paths or private data, in code, fixtures, logs or evidence.
- **Signed commits** are recommended on branches. `main` only receives squash merges, which GitHub signs.

## Review and merge

- **Review:** every pull request is reviewed against its task's acceptance criteria.
- **Merge:** only once all 12 required checks are green and the Maintainer has approved that exact commit, named by its full 40-hex SHA.
- **Details:** severity labels and the merge rules are in [`docs/WORKFLOW.md`](docs/WORKFLOW.md) §6.

By contributing, you agree that your work is released under the [MIT License](LICENSE) and that you will follow the [Code of Conduct](CODE_OF_CONDUCT.md).
