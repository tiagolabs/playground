# Playground workspace instructions

- Shared instructions are in `instructions/README.md`.
- Shared cluster and platform infrastructure belongs in `infra/`.
- Versioned local cluster configuration belongs in `infra/clusters/local/`.
- Generated private infrastructure state belongs in ignored `infra/.local/local/`; shared CLI caches belong in `infra/.local/tools/`.
- Application source, Dockerfiles, build definitions, and application tests belong in `projects/<project>/`.
- Application deployment configuration belongs in `infra/apps/<application>/`; CI and delivery runners belong in `infra/ci/` and `infra/pipelines/`.
- Use English for source code, documentation, comments, and generated content.
- Keep each backend independently buildable and runnable.
- For behavior-changing work, read and update the affected project's `SPEC.md`.
- Keep project READMEs aligned with supported workflows.
- Run relevant checks and report their results.
- Do not commit, push, tag, or publish GitHub Releases.

## Data and collaboration conventions

- Name database tables after the singular form of their entities (for example,
  `hero`, not `heroes`).
- Until Flyway is introduced, local and pre-production schema changes do not
  require backwards-compatible data migrations. This product is in an early
  stage: change the schema and deterministic seed data directly, then reset
  and recreate local or pre-production data when that is the clearest option.
  Once Flyway is used, preserve existing data with explicit migrations.
- Ask for clarification when a requirement is materially ambiguous, and call
  out requests that are unsafe or conflict with sound engineering practice.
