# Planned Pix application configuration

Only `identity/clients.json` exists today. Platform policies reserve the
`pix-integration` namespace with its resource budget, network boundary, and
deployment role. The Keycloak clients are registered through
`infra/clusters/local/identity.json`; independent `app-user` grants are supported.

Application planning now lives under
[payment-integrations](../../../projects/payment-integrations/README.md), with a
separate [checkout-demo](../../../projects/payment-integrations/examples/checkout-demo/README.md)
consumer project. The existing `pix-integration` infrastructure identifiers are
a legacy reservation and have not been renamed.

Add workloads in `base/`, daily configuration in `overlays/local/`, and delivery
scripts under `infra/pipelines/` when application deployment names are finalized.
Enable an overlay in the cluster's apps composition only when there is a
deployable application.
