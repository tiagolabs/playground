# Naming and design references

## Project name

Use `payment-integrations` as the canonical name in documentation and generated
content. Keep the project in `tiagolabs/playground` for now, including its
separate `examples/checkout-demo/` project.

The name is descriptive and provider-neutral. It covers multiple payment
methods and adapters while allowing example applications to demonstrate the
public integration contract. A separate product brand is not needed for the
current scope.

To distinguish the reusable application from a collection of samples, describe
it as:

> A reusable payment service with provider adapters, verified payment
> confirmations, and reliable event delivery.

## Comparable solutions

These are architectural references, not dependencies or provider compatibility
claims. Support for a particular provider, payment method, API version, or
sandbox flow must be verified separately.

| Reference | Approach | Relevant lessons |
| --- | --- | --- |
| [Hyperswitch](https://github.com/juspay/hyperswitch) | Open-source modular payment platform with provider connectors, routing, reconciliation, and an operations dashboard | Public payment API, connector boundaries, and explicit payment lifecycle |
| [Kill Bill](https://docs.killbill.io/latest/userguide_platform) | Payment and billing platform with gateway plugins, persistent events, auditing, and access controls; direct payment APIs can run independently of subscription billing | Provider plugins, transaction identities, retries, and unresolved outcomes |
| [Gr4vy](https://docs.gr4vy.com/guides/get-started) | Payment orchestration platform connecting processors through one integration, with routing and checkout components | Consumer integration and notification contracts |
| [Omnipay](https://github.com/thephpleague/omnipay) | PHP library with a common gateway interface, provider packages, and an example application | Adapter design and examples; the library is embedded in its consumer rather than deployed as a separate payment service |

Hyperswitch is the closest architectural reference to the proposed reusable
payment service. Its backend, dashboard, and supporting services are separate
components. payment-integrations starts with a narrower modular application
and one image containing its API and compiled React frontend.

Kill Bill explicitly describes pending and unknown payment transaction outcomes
in its [event documentation](https://docs.killbill.io/latest/kill_bill_events).
These states are useful references for modeling uncertain results without
creating duplicate charges.

Gr4vy documents [signed webhook delivery](https://docs.gr4vy.com/guides/features/webhooks/signatures)
with a stable identifier across retries. This illustrates how event identity
and authentication form part of a consumer-facing integration contract.

## Design lessons for this project

- Model a payment separately from its provider attempts and preserve their
  identities across retries.
- Make pending and uncertain outcomes explicit, with provider reconciliation
  before allowing an incompatible replacement attempt.
- Describe provider capabilities and required customer actions instead of
  treating all payment methods as interchangeable.
- Publish an authenticated, versioned event contract with stable retry identity,
  durable delivery records, and clear acknowledgement rules.
- Keep fulfillment in the consumer. Provider integration does not replace the
  consumer's unique fulfillment record and transactional side effects.
- Demonstrate the public contract through an independent example application.

The initial scope remains Mercado Pago, Pix, payment records and attempts,
verified confirmations, duplicate-payment protection, reliable event delivery,
and the separate checkout example. These references do not expand the initial
scope to advanced routing, subscriptions, or card vaulting.
