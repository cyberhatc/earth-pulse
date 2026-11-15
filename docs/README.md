# Earth Pulse Documentation Index

This index helps you navigate the documentation in the [`docs/`](.) directory and key project guides in the repository root.

## Start here

- **Project overview:** [../README.md](../README.md)
- **Comprehensive handbook:** [../HANDBOOK.md](../HANDBOOK.md)

## Architecture and product

- [architecture.md](architecture.md) — system architecture, layers, and data flow
- [ui-ux.md](ui-ux.md) — UI/UX notes and interaction expectations
- [earth-pulse-landing-redesign.md](earth-pulse-landing-redesign.md) — landing redesign notes (historical/design context)
- [EARTH_PULSE_DESIGN_REQUIREMENTS.md](EARTH_PULSE_DESIGN_REQUIREMENTS.md) — design requirements reference

## Data, methods, and scientific integrity

- [data-sources.md](data-sources.md) — data sources, access paths, and coverage guidance
- [real-data-ingestion.md](real-data-ingestion.md) — moving from synthetic demo to real ingestion workflows
- [power-real-store.md](power-real-store.md) — NASA POWER real-store build/run notes (includes date-specific run details)
- [highres-belgaum.md](highres-belgaum.md) — high-resolution point workflow and Belgaum case study
- [ml.md](ml.md) — statistical/ML methods, implementation status, and caveats
- [limitations.md](limitations.md) — honest limitations and interpretation guidance
- [scenario-images.md](scenario-images.md) — optional AI scenario-card workflow and safety/labeling rules
- [rag.md](rag.md) — facts-locked chat/RAG architecture, configuration, and operational notes

## API and integration

- [api-contract.md](api-contract.md) — backend endpoints and payload contract details
- [rag-corpus/](rag-corpus/) — curated corpus material used for RAG knowledge-base builds

## Deployment and operations

- [deploy.md](deploy.md) — deployment options (Render, Vercel, GitHub Pages, Docker, etc.) and configuration notes
- [colab-scenario.md](colab-scenario.md) — Colab/scenario workflow notes
- [parallel-prompts.md](parallel-prompts.md) — parallel work/session prompts and historical coordination notes

## Verification and project status

- [VERIFICATION.md](VERIFICATION.md) — date-specific implementation/verification report
- [submission-checklist.md](submission-checklist.md) — NASA Space Apps submission checklist
- [AUDIT_REPORT.md](AUDIT_REPORT.md) — audit report (present as an untracked/local working file in this workspace at audit time; preserve if you have local edits)

## Root-level operational files

- [../Makefile](../Makefile) — common local commands (`sample-data`, `engine`, `train`, `test`, `api`, etc.)
- [../docker-compose.yml](../docker-compose.yml), [../Dockerfile](../Dockerfile), [../render.yaml](../render.yaml), [../vercel.json](../vercel.json) — container and deployment configuration
- [../.github/workflows/ci.yml](../.github/workflows/ci.yml), [../.github/workflows/deploy-web.yml](../.github/workflows/deploy-web.yml) — CI and web deployment workflows

## Notes

- Documentation may include historical run results and environment-specific notes. Treat command outputs, metrics, and deployment states as valid for the recorded context unless re-verified.
- When documentation and implementation disagree, verify against the repository source and running behavior, then update docs with evidence.
