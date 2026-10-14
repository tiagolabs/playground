# payment-integrations

A reusable payment service with provider adapters, verified payment
confirmations, and reliable event delivery.

The project is in planning and remains in `tiagolabs/playground` for now.
Mercado Pago is the first proposed provider; additional providers can be added
behind the same payment API when their capabilities are needed.

This directory currently contains design and integration documentation. There
is no runnable payment application, Docker image, or implemented API yet.

## Application design

- A modular monolith owns payment records, provider adapters, notifications,
  reconciliation, and event delivery.
- One application image packages the backend and compiled React frontend. A
  configuration setting will allow serving the frontend to be disabled while
  keeping the API available.
- PostgreSQL runs externally. An embedded standalone database is outside the
  initial scope.
- Authentication uses an existing Keycloak installation. The backend validates
  callers and enforces application permissions; the image does not start an
  identity server.
- Consuming applications own their products, prices, orders, and fulfillment.
  They integrate through the public API and event contract.

Future backend and frontend source will belong in this project. Application
deployment configuration, CI, and delivery runners follow the workspace
conventions under `infra/`.

## Documentation and example

- [Project specification](SPEC.md): agreed scope, ownership, safety requirements,
  and decisions still open before implementation.
- [How to use payment-integrations](docs/how-to-use.md): proposed integration
  flow and required protections against duplicate payments and fulfillment.
- [Naming and design references](docs/references.md): project naming rationale
  and lessons from comparable payment solutions.
- [checkout-demo](examples/checkout-demo/README.md): a separate consumer project
  demonstrating a purchase of one fictional product.
- [Project instructions](AGENTS.md): conventions for future work in this directory.

```text
projects/payment-integrations/
  AGENTS.md
  README.md
  SPEC.md
  docs/
    how-to-use.md
    references.md
  examples/
    checkout-demo/
      README.md
```

The example is nested here for convenience but remains an independent
application. It will have its own build, configuration, database, and deployment
and must use the public integration contract rather than backend internals.

Use `payment-integrations` as the canonical project name in documentation and
generated content. The name covers providers and payment methods beyond the
initial Pix integration.

The existing `pix-integration` namespace and Keycloak client are a legacy lab
reservation, documented in [the infrastructure placeholder](../../infra/apps/pix-integration/README.md).
No infrastructure identifiers have been renamed by this documentation work.
