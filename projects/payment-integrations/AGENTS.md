# payment-integrations instructions

- Follow the workspace instructions in `../../AGENTS.md` and
  `../../instructions/README.md`.
- Use `payment-integrations` as the canonical project name in documentation and
  generated content. Use English for source, documentation, and comments.
- Read `SPEC.md` before behavior-changing work and update it with implemented
  behavior. Keep proposed contracts and planned capabilities clearly identified.
- Keep the backend independently buildable and runnable. The planned application
  image contains the backend and compiled React frontend; PostgreSQL and the
  identity server are external dependencies.
- Keep `examples/checkout-demo/` independently buildable, runnable, and deployable.
  It must consume the public API and events, without importing provider adapters
  or accessing the payment service's database.
- Use fictional, generic products and consumer data in examples and documentation.
  Do not introduce private projects, private currencies, or their business rules.
- Preserve the duplicate-payment and fulfillment invariants in
  `docs/how-to-use.md`. Database constraints and transactions must enforce them
  across concurrent requests and application replicas.
- Treat unresolved provider outcomes explicitly. Retrying with a new key or a
  different provider must not bypass reconciliation of a possible existing charge.
- Use singular database entity table names. Keep provider credentials, client
  secrets, tokens, and generated private state out of versioned files and logs.
- Application deployment, identity declarations, CI, and delivery runners belong
  under the workspace `infra/` conventions. Keep the example's deployment and
  access separate from those of payment-integrations.
- Run relevant checks for the actual change. For implementation, cover the
  concurrency, replay, and crash scenarios listed in the integration guide.
