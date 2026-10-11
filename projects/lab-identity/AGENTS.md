# Lab Identity instructions

Follow `../../instructions/README.md`. Keep the Java backend and React frontend independently buildable. Update SPEC.md for behavior changes and README.md for workflows. Keycloak is the source of users and application grants; never store passwords or duplicate grants. Administrative APIs must allowlist clients/roles and require `identity-admin`. Keep browser tokens and service-account credentials server-side. Run relevant checks. Do not commit or push.
