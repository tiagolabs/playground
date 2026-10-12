# Lab Identity deployment

Application source and tests are in `../../../projects/lab-identity/`. `base/` contains
backend, frontend, Redis, routes, and mesh rules; `overlays/local/` selects the
daily namespace. `identity/clients.json` declares its Keycloak clients and roles.
Namespace policies belong to `../../platform/policies/lab-identity/`.

From `playground/`, run `infra/pipelines/lab-identity/build.sh [candidate-id]`, then
`infra/pipelines/lab-identity/deploy.sh CANDIDATE_ID`. Promotion verifies a retained
image archive and applies its stored manifest with immutable application image
references. Current source and mutable local tags do not affect promotion.
`operations/deploy.sh` delegates to that same guarded delivery workflow.
Private candidates and deployment history live under
`infra/.local/local/pipelines/lab-identity/`; successful previous candidates are
available through `deploy.sh rollback`. See the [delivery runbook](../../pipelines/lab-identity/README.md).
Deploying this app never resets shared Keycloak users or another application's data.
