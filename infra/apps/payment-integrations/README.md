# Planned payment-integrations configuration

Versioned identity declarations and platform policies reserve the
`payment-integrations` namespace, Keycloak role client, resource budget, network
boundary, and deployment role. Clients are selected through
`infra/clusters/local/identity.json`; application access requires an explicit
`app-user` grant.

Source and planning live under
[payment-integrations](../../../projects/payment-integrations/README.md), with a
separate [checkout-demo](../../../projects/payment-integrations/examples/checkout-demo/README.md).
Pix through Mercado Pago is MVP 1; Stripe is phase 2 of the same application.

These are versioned reservations, not deployed payment workloads. Applying the
canonical naming to an existing lab requires coordinated rollout of namespace
policies, telemetry, identity, host/TLS configuration, and the Lab Identity
catalogue. Retire obsolete reservations and review any old grants only after
validating the replacement. Live rollout remains tracked in the
[application roadmap](../../../projects/payment-integrations/ROADMAP.md).

The reserved browser hostname is `payments.lab.test`; provider callbacks also
need an externally reachable HTTPS endpoint. The current namespace policy does
not permit external provider traffic yet; define provider egress during MVP
implementation.

Add workloads in `base/`, lab configuration in `overlays/local/`, and delivery
scripts under `infra/pipelines/payment-integrations/` when the application
exists. Enable its cluster overlay only when a deployable application exists.
