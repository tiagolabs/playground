# payment-integrations specification

## Status and purpose

This is a planned project in `tiagolabs/playground`. The directory currently
contains documentation; no application, provider adapter, API, Docker image, or
checkout example has been implemented.

The [roadmap](ROADMAP.md) tracks completed planning, implementation milestones,
and completion evidence. Use it for progress; this specification defines scope
and required behavior.

The goal is a reusable payment service that consuming applications can deploy
and integrate through a public contract. It owns payment operations and provider
communication while each consumer retains its products, prices, orders, and
fulfillment rules.

`payment-integrations` is the canonical project name. Its provider-neutral name
allows the project to cover Pix and other payment methods as integrations are
added. See [naming and references](docs/references.md).

## Agreed structure and packaging

- Keep the project in `projects/payment-integrations/` in this repository for now.
- Start with a modular monolith containing payment lifecycle, provider adapters,
  notification processing, reconciliation, and event delivery.
- Package the backend and compiled React frontend in one application image. The
  backend serves both API requests and frontend resources.
- Allow the frontend routes to be disabled through configuration while the API
  remains available. The frontend assets are part of the standard image.
- Use external PostgreSQL. An embedded standalone database is outside the
  initial scope.
- Integrate with an existing Keycloak installation. In the study cluster, use
  the shared identity platform with application-specific clients and permissions.
- Keep the generic consumer example in `examples/checkout-demo/` as a separate
  application with independent build, configuration, data, access, and deployment.
- Follow workspace ownership for operational configuration under `infra/`.

The versioned namespace and Keycloak role client use `payment-integrations`;
the reserved browser hostname is `payments.lab.test`. The planned Lab Identity
entry uses that same application identity. Applying these declarations to an
existing lab and retiring obsolete reservations is a coordinated rollout task
in the roadmap; the current change does not deploy payment workloads.

## Initial scope

MVP 1 is Pix through Mercado Pago. Complete the safe payment lifecycle and
separate checkout example before adding a second provider.

1. A Mercado Pago adapter for Pix using the documented Orders API integration
   and its supported test flow.
2. Authenticated creation and retrieval of payment records and attempts.
3. Provider payment instructions suitable for presentation by a consumer.
4. Verified provider notifications and reconciliation of unresolved outcomes.
5. Transactional outbox records for confirmed payment events and retryable
   delivery to consumers.
6. A React operations console for payment records, statuses, and delivery failures.
7. A separate checkout example demonstrating one fictional product and
   idempotent fulfillment.

Stripe is the next provider after MVP 1; it belongs to this same application.
Additional providers can follow concrete use cases. Provider-specific
capabilities and customer actions must remain explicit; a
common API does not imply every provider supports every payment method or
operation. Advanced routing, subscriptions, and card vaulting are outside the
initial scope.

## Phase 2: Stripe

Add a Stripe adapter after the Mercado Pago Pix flow and acceptance checks are
complete. The recommended first Stripe flow is card payments through a hosted
Checkout page, returning a checkout URL through the common payment contract.
Confirm that flow during phase-2 planning. See [Stripe Checkout](https://docs.stripe.com/payments/checkout).

Reuse payment identities, attempts, ownership checks, outbox delivery, and
consumer fulfillment safeguards. Verify Stripe notifications and authoritative
payment state; a browser return URL is not payment confirmation. Extend the
same checkout-demo with a second payment flow rather than create a Stripe-only
application. See [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted).

## Data and integration responsibilities

| Record or decision | Owner |
| --- | --- |
| Product, price, customer, and checkout identity | Consumer |
| Order and expected fulfillment effect | Consumer |
| Payment and its provider attempts | payment-integrations |
| Provider account credentials and operation idempotency keys | payment-integrations |
| Verified provider state and reconciliation | payment-integrations |
| Outgoing event identity and delivery history | payment-integrations |
| Received-event processing and unique fulfillment record | Consumer |

Consuming backends authenticate as service accounts. payment-integrations checks
token validity, intended audience, permissions, and payment ownership. A consumer
user's login does not automatically grant payment-console access.

Provider notifications use provider-specific authentication. Consumers validate
outgoing confirmations and match them to their stored orders before fulfillment.
The exact endpoint names and payloads in the [integration guide](docs/how-to-use.md)
remain draft contracts.

## Required safety invariants

- Repeated submissions of one checkout resolve to one consumer order.
- There is at most one unresolved payment attempt for an order, including under
  concurrent requests, workers, or application replicas.
- Retry identities and their request parameters are persisted. A key reused
  with incompatible parameters is rejected.
- A lost response or unresolved provider outcome cannot cause a blind replacement
  charge, key regeneration, or provider switch.
- A provider payment cannot fulfill multiple consumer orders.
- Verified payment state and its outgoing event are committed together.
- Event retries preserve event identity and tolerate duplicate delivery.
- A consumer records fulfillment and its effect transactionally, with a unique
  purchase fulfillment record. Event deduplication alone is insufficient.
- Receiver acknowledgement occurs only after durable acceptance or committed
  processing; asynchronous processing must retain durable pending work.
- Multiple real settlements for one order are all recorded. Fulfillment happens
  once and any additional settlement is routed to refund or operator review.

The integration guide defines the [required verification scenarios](docs/how-to-use.md#required-verification-before-enabling-purchases).
They are acceptance criteria to implement and test, not current test results.

## Decisions still open

- Backend framework and runtime version.
- Final OpenAPI and event schemas, including payment lifecycle states and
  compatibility/versioning rules.
- Initial outgoing event transport: signed HTTP webhooks or RabbitMQ. Either
  choice must implement the required outbox and receiver protections.
- React-console login/session integration and the example's customer access
  mechanism.
- Supported sandbox fixtures, provider reconciliation behavior, retry policy,
  and handling of settlements needing review.
- Final console and consumer service-account identities and the externally
  reachable HTTPS route required for provider notifications.

Resolve these during implementation planning without weakening the agreed
ownership boundaries or safety invariants.
