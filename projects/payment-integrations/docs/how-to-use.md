# How to use payment-integrations

This guide defines the proposed consumer integration. Its endpoints and event
examples are draft contracts, not implemented interfaces or runnable workflows.
The [checkout-demo](../examples/checkout-demo/README.md) will demonstrate this
contract as a separate project.

## Responsibilities

| Owner | Responsibility |
| --- | --- |
| Consuming application | Products, server-calculated prices, customers, orders, and fulfillment |
| payment-integrations | Payment attempts, provider credentials and calls, verified payment status, reconciliation, and event delivery |
| Keycloak | User and service authentication, token issuance, and configured roles |

The consuming backend authenticates to payment-integrations with a service
account, using client credentials. payment-integrations validates the token's
signature, issuer, expiration, audience, and permissions and restricts access
to the caller's payment records. A user's login to the consuming application
does not grant access to the payment management console.

Each deployment supplies its database connection, provider credentials, issuer
configuration, and event destination through private runtime configuration.
The React console is optional to use or enable; it is packaged in the same
application image. The consumer can supply its own checkout interface.

## Purchase flow

1. The consumer creates an order from its server-owned product and price data.
   It stores the expected amount, currency, and fulfillment details.
2. Its backend requests a payment with an order reference, payment method, and
   stable idempotency key for the logical attempt.
3. payment-integrations records the attempt and contacts the configured
   provider. It returns a payment identity and the available payment
   instructions, such as Pix instructions or a checkout URL.
4. The consumer displays those instructions. It remains responsible for
   controlling access to the customer's order.
5. payment-integrations verifies provider notifications, durably records their
   receipt, and retrieves authoritative provider state before confirming a
   payment.
6. It commits the confirmed payment and its outgoing event together, then
   delivers the event asynchronously.
7. The consumer validates the confirmation against its stored order and
   fulfills the purchase transactionally and idempotently.

For illustration, a proposed `POST /payments` request could use the following
body and an idempotency header:

```json
{
  "reference": "order_123",
  "amountMinor": 1000,
  "currency": "BRL",
  "method": "pix"
}
```

Here `1000` means BRL 10.00. This is an illustrative contract, not a Mercado Pago
sandbox fixture. The provider adapter translates amounts to the provider's
format. Customer-supplied prices must not replace the stored order price.

## Required duplicate-payment protections

These protections are requirements for enabling purchases, regardless of the
event delivery transport.

- **Stable checkout identity:** repeated submissions of the same checkout must
  resolve to the same consumer order. Preserve its identity across double
  clicks, retries, and page reloads. A deliberate new purchase has a new
  identity; equal amounts alone do not identify duplicate purchases.
- **Database enforcement:** uniquely identify requests within the consuming
  application and reserve attempts transactionally. Multiple workers or
  application replicas must not create concurrent unresolved payment attempts
  for the same order.
- **Immutable retry parameters:** payment-integrations persists the request
  identity and its parameters. Repeating a key with the same parameters returns
  the existing attempt; changing the order, amount, currency, or method under
  that key is rejected.
- **Provider operation identity:** store a stable provider idempotency key for
  each write operation before submitting it. Retries of that operation preserve
  the key and parameters and follow the provider's documented behavior.
- **Uncertain outcomes:** a timeout, server error, or idempotency conflict is
  not proof that a charge failed. Keep the attempt unresolved and reconcile it
  with the provider. Do not generate a replacement charge, regenerate the key,
  or switch providers while the previous attempt could still succeed.
- **Replacement attempts:** permit a new attempt only after establishing that
  the previous one cannot settle. A local timer expiring or a customer closing
  the checkout is insufficient evidence.
- **Provider payment identity:** prevent the same provider payment, scoped to
  its provider account, from being associated with multiple consumer orders.

Mercado Pago's Orders API requires `X-Idempotency-Key`. Its documented errors
include already-used and locked keys; the adapter must handle these outcomes
without blindly creating another charge. See [the create-order reference](https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api/create-order/post).

## Required fulfillment protections

The consumer must validate the event's origin and confirm that the payment
belongs to its application and matches the stored order reference, payment
identity, amount, and currency. Fulfillment details come from that order.

Use both event deduplication and a business constraint:

- A processed-event record identifies repeated deliveries by event ID.
- A unique fulfillment record prevents the same order from being fulfilled
  again, including when different event IDs describe the same successful
  payment.
- A successful payment must not fulfill a second order.

The database transaction must cover the deduplication record and fulfillment
effect. For a consumer that maintains an account balance, this means committing
the unique purchase-credit ledger entry and balance update together. If
fulfillment belongs to another service, pass a stable fulfillment identity to
that service; it must enforce the same uniqueness at the point where it applies
the effect.

PostgreSQL constraints enforce uniqueness across rows, including when requests
run concurrently. An application-level check followed by an unguarded update
does not provide the same protection. See [unique constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS)
and [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

If two distinct payments settle for one order, record both settlements, fulfill
the order once, and place the additional payment into refund or operator review.
Do not discard its payment record as though it were only a duplicate event.

## Event delivery

The following proposed event describes a confirmed payment:

```json
{
  "eventId": "evt_123",
  "type": "payment.succeeded",
  "version": 1,
  "data": {
    "paymentId": "pay_456",
    "reference": "order_123",
    "amountMinor": 1000,
    "currency": "BRL"
  }
}
```

`payment.succeeded` is a payment-integrations event name, not a provider event
name. The event ID remains stable across delivery retries.

Transport selection is still a design decision. Both options require a
transactional outbox: store the payment transition and outgoing event in one
PostgreSQL transaction, then let a background worker deliver committed events.
See [the transactional outbox pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

| Transport | Required delivery handling |
| --- | --- |
| HTTP webhook | Authenticated or signed requests to a configured endpoint; durable pending delivery records; retries; receiver acknowledgement only after committing processing or a durable inbox record |
| RabbitMQ | Durable queues and persistent messages; publisher confirmations; handling for unroutable messages; consumer acknowledgement only after committing processing or a durable inbox record |

A RabbitMQ publisher confirmation transfers responsibility to the broker; it
does not confirm consumer fulfillment. Use replication when broker-node failure
tolerance is required. Both transports can deliver duplicates and must support
safe retries and visible failed deliveries. See [RabbitMQ reliability](https://www.rabbitmq.com/docs/reliability)
and [publisher confirmations](https://www.rabbitmq.com/docs/confirms).

Mercado Pago notifications use provider-specific signature verification rather
than the consuming application's Keycloak token. Receipt must be durably stored
before acknowledging, with authoritative state fetched during processing. See
[Orders notifications](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications).

## Required verification before enabling purchases

| Scenario | Expected result |
| --- | --- |
| Concurrent submissions for one checkout | One consumer order and one unresolved provider attempt |
| Same key repeated with changed parameters | Rejected; no additional provider charge |
| Provider accepts a request but its response is lost | Existing attempt reconciled; no blind replacement charge |
| Repeated success notifications with the same or different event IDs | One fulfillment effect |
| Consumer crashes before its transaction commits | No partial fulfillment; retry can complete it |
| Consumer crashes after commit but before acknowledgement | Retry acknowledges the existing fulfillment without applying it again |
| Wrong caller, order, payment identity, amount, currency, or unverified notification | No fulfillment |
| Two distinct payments settle for one order | Both recorded; one fulfillment; extra settlement flagged for refund or review |
| Two deliberate purchases with distinct checkout identities | Two independent orders can each be fulfilled |

These are planned acceptance criteria, not test results. The separate example
will make the core integration and replay behavior observable without coupling
the reusable application to a consumer's private domain.
