# Contributing to Earth Pulse

Thank you for your interest in improving Earth Pulse. Contributions that strengthen **accuracy, clarity, reproducibility, scientific integrity, and maintainability** are especially welcome.

## Before you start

- Read the [README](README.md), [docs/README.md](docs/README.md), and relevant technical docs (especially [docs/limitations.md](docs/limitations.md), [docs/data-sources.md](docs/data-sources.md), and [docs/architecture.md](docs/architecture.md)).
- Inspect the current implementation and existing conventions before proposing or making changes.
- Keep changes scoped and evidence-based. Avoid speculative refactors, unrelated cleanup, or dependency additions unless they are clearly justified.

## Ways to contribute

- **Documentation:** fix inaccuracies, broken links, unclear setup steps, or missing explanations (with evidence from the repo).
- **Bug fixes:** report or fix reproducible issues with clear steps and expected vs actual behavior.
- **Tests and verification:** improve test coverage, reproducibility, or developer workflows where appropriate.
- **Features:** propose features that align with the project’s investigation goals and evidence-first design. For significant changes, open an issue/discussion first when possible.

## Scientific and product integrity (important)

- **Do not fabricate data, metrics, screenshots, badges, endorsements, or claims.**
- Clearly distinguish **synthetic demo data** from **real observations/products**.
- Do not overstate temporal or spatial coverage (e.g. do not claim 40 years for variables/stores that do not support it).
- Present forecasts as **probabilistic (e.g. p10–p90)** and uncertain, not certain futures.
- Distinguish **trend direction** from **statistical significance**.
- Do not claim **causation** from correlation, anomalies, or opposite-trend contrasts.
- Keep the boundary explicit: **AI explains evidence; statistical/model components compute evidence.**

## Development workflow

### 1. Fork/branch

- Work on a dedicated branch for your change.
- Keep commits focused and descriptive.

### 2. Set up locally

Follow the project setup in the [README](README.md). Common local commands (from repo root):

```bash
# Python demo pipeline + tests
make sample-data engine test
python -m pytest tests/ -q

# API
make api

# Frontend (from web/)
npm ci
npm run typecheck
npm run build
```

Use the project’s existing package managers and scripts where possible.

### 3. Verify your changes

Run checks relevant to what you changed and report results clearly:

- **Python changes:** relevant `pytest` tests (and pipeline/engine steps if affected)
- **Frontend changes:** `npm run typecheck` and `npm run build` in `web/`
- **Docs/config changes:** validate links, paths, commands, and formatting; run `git diff --check`
- **Never claim a check passed unless it actually ran and passed.**

### 4. Open a pull request

When opening a PR (or preparing one), include:
- What changed and why
- How it was verified (exact commands and outcomes)
- Any limitations, follow-up work, or items not verified
- Screenshots only if they are genuine and relevant (do not fabricate)

## Repository conventions and safety

- Do not commit secrets, credentials, tokens, private keys, or `.env` contents.
- Do not add or modify dependencies unnecessarily.
- Preserve existing behavior unless a change is intentional, justified, and documented.
- If you find a potential security issue, follow [SECURITY.md](SECURITY.md).

## Questions

If you are unsure whether a change is in scope or how to verify a scientific/product claim, open an issue describing the evidence you have and what needs confirmation.
