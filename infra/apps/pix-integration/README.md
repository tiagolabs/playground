# Planned Pix application configuration

Only `identity/clients.json` exists today. Platform policies reserve the
`pix-integration` namespace with its resource budget, network boundary, and
deployment role. The Keycloak clients are registered through
`infra/clusters/local/identity.json`; independent `app-user` grants are supported.

Add source in `playground/projects/pix-integration/`, workloads in `base/`, daily configuration
in `overlays/local/`, and delivery scripts in `infra/pipelines/pix-integration/`
when the application is defined. Enable its overlay in the cluster's apps
composition only when there is a deployable application.
