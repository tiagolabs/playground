# Lab Identity deployment

Application source and tests are in `../../../projects/lab-identity/`. `base/` contains
backend, frontend, Redis, routes, and mesh rules; `overlays/local/` selects the
daily namespace. `identity/clients.json` declares its Keycloak clients and roles.
Namespace policies belong to `../../platform/policies/lab-identity/`.

From `playground/`, run `infra/pipelines/lab-identity/build.sh`, then
`infra/pipelines/lab-identity/deploy.sh`. Promotion requires unchanged source
and configuration plus the recorded Docker image IDs. Private candidate records
are under `infra/.local/local/pipelines/lab-identity/`. Deploying this app never resets
shared Keycloak users or another application's data.
