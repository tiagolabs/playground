# payment-integrations roadmap

> Status revised on 2026-10-14: this generic public demo is deferred. The current
> implementation milestone uses an authenticated private platform flow outside
> this repository. The proposal below is retained for a later simplified
> open-source example; it is not an active implementation commitment.

Track actual delivery progress here. The [specification](SPEC.md) defines scope
and invariants; the [integration guide](docs/how-to-use.md) defines the proposed
consumer workflow and required verification scenarios.

## Current progress

Planning documentation is complete. Technical decisions and application
implementation are pending. No implementation milestone is in progress.

MVP 1 covers milestones 1-7: Pix through Mercado Pago, reliable confirmation,
duplicate protection, the operations console, and the separate checkout-demo.
Stripe follows in phase 2, milestone 8, inside the same payment-integrations
application.

| Milestone | Status | Completion evidence |
| --- | --- | --- |
| 0. Project scope and documentation | Complete | Specification, integration guide, references, and separate example plan linked below |
| 1. Technical decisions and contracts | Next | Pending |
| 2. Backend and data foundations | Pending | Pending |
| 3. Mercado Pago Pix integration | Pending | Pending |
| 4. Reliable event delivery | Pending | Pending |
| 5. React console and application image | Pending | Pending |
| 6. Separate checkout example | Pending | Pending |
| 7. Lab delivery and acceptance verification | Pending | Pending |
| 8. Stripe provider, phase 2 | After MVP 1 | Pending |

## Tracking rules

- `[x]` means the stated deliverable exists and has been checked. Completed
  planning does not mean the corresponding runtime behavior is implemented.
- `[ ]` means pending. Mark a milestone in progress only when work on it starts.
- Complete implementation items only after their relevant checks pass; record
  the validation and supporting files in the milestone's completion evidence.
- Keep this roadmap, the specification, and supported-workflow documentation
  aligned as decisions are resolved and capabilities are implemented.
- Do not infer overall readiness from a checkbox percentage. The concurrency,
  replay, and crash protections remain required acceptance gates.

## Milestone 0: Project scope and documentation

- [x] Keep the canonical project name `payment-integrations` and the project
  folder inside `tiagolabs/playground`.
- [x] Document a modular monolith with a bundled React frontend that can be
  disabled, external PostgreSQL, and an existing Keycloak installation.
- [x] Define payment-service and consumer ownership boundaries in the
  [specification](SPEC.md).
- [x] Document required duplicate-payment and fulfillment protections, including
  unresolved outcomes, idempotency, outbox delivery, and receiver transactions.
- [x] Record [comparable solutions and naming rationale](docs/references.md).
- [x] Plan a generic, independent [checkout-demo](examples/checkout-demo/README.md)
  inside `examples/`, using one fictional product.
- [x] Add project instructions and this progress tracker to the documentation index.
- [x] Consolidate versioned namespace, identity, routing reservation, telemetry,
  and planned-app catalogue naming under payment-integrations. Live rollout is
  pending in milestone 7.

Completion evidence: [project documentation](README.md),
[integration guide](docs/how-to-use.md), and
[project instructions](AGENTS.md). Only documentation has been delivered.

## Milestone 1: Technical decisions and contracts

- [ ] Select the backend framework and runtime version.
- [ ] Define the payment and attempt lifecycle, including pending and unknown
  outcomes, allowed transitions, and when a replacement attempt is permitted.
- [ ] Finalize the OpenAPI contract, idempotency-key scope and parameter matching,
  consumer references, money representation, and ownership checks.
- [ ] Finalize the outgoing event schema, event identity, and compatibility rules.
- [ ] Select the initial event transport: signed HTTP webhooks or RabbitMQ, with
  the required outbox and receiver protections.
- [ ] Define console authentication, consumer service-account permissions, and
  access to individual checkout-demo orders.
- [ ] Verify supported Mercado Pago Orders API test fixtures, retry behavior, and
  reconciliation of ambiguous provider results.
- [ ] Finalize console and consumer service-account identities, provider egress,
  and the reachable HTTPS route for provider notifications.

Completion requires recorded decisions and contracts that preserve the
[required safety invariants](SPEC.md#required-safety-invariants). Unresolved
choices remain visible in the specification rather than implied by examples.

## Milestone 2: Backend and data foundations

- [ ] Add an independently buildable and runnable backend with external PostgreSQL.
- [ ] Implement singular-entity schemas for payment records, attempts, request
  identities, provider operation identities, and outgoing events.
- [ ] Enforce idempotency and one unresolved attempt per order through database
  constraints and transactions across concurrent requests and replicas.
- [ ] Implement authenticated payment creation and retrieval, token validation,
  permission checks, and consumer ownership boundaries.
- [ ] Prove concurrent retries return one attempt and incompatible reuse of a key
  cannot create another charge.

Completion requires meaningful database and API verification. A service starting
successfully is insufficient evidence for the concurrency guarantees.

## Milestone 3: Mercado Pago Pix integration

- [ ] Implement the Orders API adapter and supported Pix payment instructions.
- [ ] Persist provider operation keys before submission and safely handle retries,
  lost responses, locked keys, and ambiguous outcomes.
- [ ] Verify provider notification signatures and store receipt durably before
  acknowledging; process against authoritative provider state.
- [ ] Implement reconciliation without blindly creating replacement charges or
  switching providers while an earlier outcome remains unresolved.
- [ ] Record distinct settlements for one order and surface additional payments
  for refund or operator review.
- [ ] Verify the documented sandbox flow and simulated duplicate, timeout, and
  mismatch scenarios. Keep simulation distinct from real bank settlement.

Completion requires provider-adapter evidence and passing failure-path checks,
not only a successful sample payment request.

## Milestone 4: Reliable event delivery

- [ ] Commit verified payment transitions and their outbox events together.
- [ ] Deliver committed events asynchronously, retaining stable event identity
  across retries and restart recovery.
- [ ] Implement the selected transport's authentication and acknowledgement
  semantics, including unroutable-message handling if RabbitMQ is selected.
- [ ] Make pending and failed deliveries visible and provide a controlled retry
  path without discarding unsettled work.
- [ ] Verify receiver downtime, delivery duplication, and crashes around publishing
  and acknowledgement. Do not claim exactly-once delivery.

Completion requires evidence that accepted events survive the defined restart
and retry scenarios and that failed delivery can be recovered.

## Milestone 5: React console and application image

- [ ] Build the React console for payment records, statuses, and delivery failures.
- [ ] Enforce console access and API permissions through the agreed identity design.
- [ ] Package the backend and compiled frontend in one application image.
- [ ] Support disabling frontend routes while retaining the protected API.
- [ ] Verify startup with external PostgreSQL, private runtime configuration,
  and an existing identity server.

Completion requires checking the packaged application with the console enabled
and disabled, including that disabling the UI does not bypass API authorization.

## Milestone 6: Separate checkout example

- [ ] Build checkout-demo independently with its own configuration, order data,
  and consumer service account.
- [ ] Add one fictional product with server-owned pricing, stable checkout
  identity, payment instructions, and order-status display.
- [ ] Consume only the public payment API and event contract.
- [ ] Validate confirmations against the stored order and commit event processing
  with one unique fulfillment record.
- [ ] Demonstrate repeated checkout submissions, repeated confirmations with
  different event IDs, and consumer crashes before and after fulfillment commit.
- [ ] Document the supported test flow and the commands actually implemented.

Completion requires one simulated purchase being fulfilled once and the replay
and failure scenarios preserving that result. See the
[example plan](examples/checkout-demo/README.md).

## Milestone 7: Lab delivery and acceptance verification

- [ ] Add workload and consumer deployment/access configuration under `infra/`
  for payment-integrations and checkout-demo.
- [ ] Roll out the canonical namespace policies, telemetry, identity client,
  host/TLS configuration, and updated Lab Identity catalogue together; retire
  obsolete reservations and review existing grants after validation.
- [ ] Add CI and delivery runners under the existing infrastructure conventions,
  keeping each application's deployment and private state separate.
- [ ] Verify image builds, namespace boundaries, identity integration, database
  access, and provider notification reachability in the local cluster.
- [ ] Run the complete
  [required verification matrix](docs/how-to-use.md#required-verification-before-enabling-purchases)
  and record results and any unresolved limitations.
- [ ] Update the READMEs with supported manual-test and operational workflows.

Completion requires a reproducible simulated checkout through the separate
consumer and passing payment and fulfillment safety checks. Real-money testing
is not a prerequisite for completing the example.

## Milestone 8: Stripe provider, phase 2

Start after MVP 1 and its acceptance matrix pass. Keep Stripe inside the same
payment-integrations application.

- [ ] Confirm the first Stripe payment flow; hosted Checkout for cards is the
  recommended starting point.
- [ ] Add the Stripe adapter and private test credentials using the established
  payment and attempt model.
- [ ] Return the required checkout action through the common contract, with
  explicit provider and payment-method capabilities.
- [ ] Verify Stripe notification signatures and payment state; reuse the outbox
  and unresolved-attempt protections.
- [ ] Extend checkout-demo with a second payment flow using the same order and
  fulfillment boundary.
- [ ] Prove concurrent retries, duplicate notifications, lost responses, and
  recovery preserve one payment attempt and one fulfillment effect.

Completion requires the separate consumer to use both providers through the
public contract and pass the applicable safety matrix for each.

## Later scope

Providers beyond Mercado Pago and Stripe can follow concrete use cases once
the shared contract and safety checks are established. Advanced routing,
subscriptions, and card vaulting remain outside the initial scope. They are not
requirements for completing the milestones above.
