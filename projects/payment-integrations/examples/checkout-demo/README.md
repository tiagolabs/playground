# checkout-demo

Planned separate example project for learning how to consume
[payment-integrations](../../README.md). It remains inside the
`payment-integrations` folder in `tiagolabs/playground` for now.

MVP 1 demonstrates Pix through Mercado Pago. When phase 2 adds Stripe to
payment-integrations, extend this same demo with a second payment flow using
its existing public API/event boundary and fulfillment safeguards.

This project currently contains documentation only. There is no runnable demo
or implemented checkout.

Track delivery in the shared
[checkout-demo milestone](../../ROADMAP.md#milestone-6-separate-checkout-example).

## Minimal example

The demo sells one fictional sample product at a server-defined test price.
Its interface shows the product, starts checkout, displays the available Pix
instructions, and shows the order's progress from pending to paid and fulfilled.
Fulfillment is one recorded completion for the order; no wallet, inventory,
shipping, or real digital-content delivery is needed.

The backend must use the provider's supported test fixture and documented
simulation flow. A simulated approval does not establish that a displayed code
can be paid through a real bank application. Details of the supported sandbox
flow must be documented when the demo is implemented.

## Separate application boundary

- The demo has its own backend, frontend, build, configuration, order database,
  and deployment.
- It consumes payment-integrations through its authenticated public API and
  confirmation events, without importing provider adapters or sharing payment
  tables.
- Its backend owns the sample product, expected price, checkout identity,
  order, and unique fulfillment record.
- It uses a dedicated service-account client with permission to manage only its
  payment records. Provider credentials stay in payment-integrations.
- Its frontend calls the demo backend. The backend keeps service credentials
  private and controls access to checkout and order status.
- Lab deployment will use its own namespace, secrets, access configuration, and
  delivery job under the shared infrastructure conventions.

The exact customer-session or login mechanism and event transport remain design
decisions. They must keep the initial example small while protecting access to
individual orders and preserving authenticated service communication.

## Demonstrated flow

1. Start a checkout for the sample product with a stable checkout identity.
2. Store the order and expected price in the demo database.
3. Request a payment from payment-integrations through the service account.
4. Display the payment instructions returned for that order.
5. Complete the provider's documented test flow.
6. Receive and verify the payment confirmation and match it to the stored order.
7. Commit the processed-event and unique fulfillment records together.
8. Show the order as paid and fulfilled through the demo backend.

The example should also demonstrate that repeated checkout submissions return
the same order and repeated payment confirmations do not fulfill it twice. A
timeout must show an unresolved attempt rather than silently create a new
charge. Any replay demonstration must be limited to test mode and must not
provide a public endpoint for marking orders paid.

Follow the required safeguards and planned verification scenarios in
[How to use payment-integrations](../../docs/how-to-use.md).
