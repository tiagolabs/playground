# TiagoLabs Playground

Study applications share a local Kubernetes lab while keeping their deployments and access separate.
Source projects live in `projects/`; shared infrastructure, deployment configuration, and CI live in `infra/`.

- [Shared infrastructure](infra/README.md): `tiagolabs-local`, HTTPS, Gateway, Istio, Keycloak, observability, and Jenkins.
- [Lab Identity](projects/lab-identity/README.md): accounts, profiles, and explicit application access.
- [Hero Association](projects/hero-association/SPEC.md): agency management, heroes, dungeons, and markets.
- [payment-integrations](projects/payment-integrations/README.md): planned reusable payment application and integration safeguards.
- [checkout-demo](projects/payment-integrations/examples/checkout-demo/README.md): planned separate example consuming payment-integrations.
- [Workspace conventions](instructions/README.md).

The lab uses `127.0.0.2:443`. Raydow can continue running on `127.0.0.1:443`.

Videos: [YouTube](https://www.youtube.com/@TiagoVibesOn).
