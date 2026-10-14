# Lab Identity specification

Lab Identity manages study accounts and explicit access to applications in TiagoLabs Local. It is a Quarkus Java 25 backend/BFF with a React frontend, deployed in namespace `lab-identity` at https://identity.lab.test. Shared infrastructure belongs to `../../infra/`.

## Identity and authorization

One Keycloak realm, `lab`, provides SSO and immutable user subjects. Logical applications are `lab-identity`, `hero-association`, and planned `payment-integrations`. Versioned catalogue metadata maps them to role clients `lab-identity-api`, `hero-association`, and `payment-integrations`. User credentials, profile fields, account status, and application grants are stored only in Keycloak.

New accounts receive `lab-identity-api:app-user` and Keycloak's built-in account self-service roles through the realm default role. Other applications require explicit client-scoped `app-user` grants. `lab-identity-api:identity-admin` permits administrative actions. Access to one application does not imply access to another. The profile's security link opens Keycloak's account console through SSO.

The confidential browser client `lab-identity` uses authorization code flow, PKCE, and secure HttpOnly SameSite cookies. Token state is held in a private Redis service. Access tokens must be signed by the shared issuer, target `lab-identity-api`, and have the appropriate scoped role. Every mutation requires the signed double-submit CSRF cookie and header. All API responses containing user data disable caching. The frontend never receives bearer, refresh, or service-account tokens.

The separate `lab-identity-admin` service account uses client credentials and bounded `manage-users`, `query-users`, and `view-clients` permissions. The API allowlists application IDs and changes only `app-user`. It does not expose arbitrary Keycloak admin paths or functional/administrator role assignment. Service-account users are hidden and cannot be managed. An administrator cannot disable their own account or revoke the default self-service entitlement.

Grant/revoke and disable operations end the affected user's Keycloak sessions. Already issued JWTs remain valid for at most the 60-second token lifetime. Fresh sessions/refreshes obtain new claims. Requests log action identifiers without credentials or tokens; upstream error bodies are never returned.

## Supported UI and API

- Public session and sign-in/out routes: `/api/v1/session`, `/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/post-logout`.
- Self-service profile GET/PUT `/api/v1/profile`; changing email clears verification.
- GET `/api/v1/applications`: catalogue, current access, available/planned state, and launch URLs.
- Administrator search/create at `/api/v1/admin/users`; search is bounded to 100 results per request.
- Administrator user details and profile/status updates at `/api/v1/admin/users/{subject}`.
- Independent grant/revoke at `/api/v1/admin/users/{subject}/applications/{application}`.
- Password reset at `/api/v1/admin/users/{subject}/password-reset`: Keycloak sends a 30-minute `UPDATE_PASSWORD` action email to local Mailpit. Passwords are set in Keycloak, never in Lab Identity.

A new account has no password and must complete the password action email. Creating it does not grant Hero Association or payment-integrations. The catalogue shows planned payment-integrations even if its access is assigned, but launch is disabled until the application exists.

## Isolation and delivery

Local frontend development binds Vite to `127.0.0.1:15174` with strict port
selection, separate from Raydow's Vite allocation. Its API/auth development
proxy targets the backend on `127.0.0.1:17280`. Full browser sign-in uses the
registered HTTPS origin; changing this Vite port does not change the issuer,
redirect allowlist or deployed gateway route.

Application source, build definitions, and tests live in
`playground/projects/lab-identity/`.

Lab Identity's backend/frontend/Redis deployments, routes, mesh policies, identity declarations, and operations are versioned in `../../infra/apps/lab-identity/`, with an independent lab overlay. Jenkins jobs are declared in `../../infra/ci/jenkins/jobs/`. Platform policies supply its namespace, resource budget, network boundary, and namespace-scoped deployment role. Redis requires mesh mTLS from the backend service account. User APIs require both role and audience validation. Shared Keycloak/PostgreSQL, Gateway, mesh control plane, and telemetry are outside the project. Ordinary app deployment never resets shared users.

`../../infra/pipelines/lab-identity/build.sh [candidate-id]` verifies backend tests,
creates readable frontend production assets, and builds uniquely tagged images.
Frontend asset/config readability is checked as the image's unprivileged user. Its source
digest covers application code, deployment configuration, delivery scripts, and
their shared helpers. Changes during validation reject the candidate. Each
successful candidate retains a checksummed image archive and rendered deployment
manifest under ignored `infra/.local/local/pipelines/lab-identity/candidates/`.
Candidate IDs cannot be reused; later builds preserve previous candidates.

`deploy.sh CANDIDATE_ID` promotes that tested archive without rebuilding or
depending on current source or local tags. Workloads pin backend/frontend images
by OCI digest. Preflight restricts manifests to the application namespace, and
successful promotion requires rollout readiness and actual pod image digest
verification. Credentials are loaded from current private state, never archived.
Builds and deployments share a lock and require the explicit local cluster context.

Deployment history preserves current and previous successful candidates and
records a pending rollout before application changes. `deploy.sh rollback`
restores the previous success, or the current success after a failed rollout.
An unfinished rollout with an existing success blocks another candidate until
retry or recovery succeeds. A failed first promotion can be replaced by a newly
validated corrected candidate because no prior success exists to restore.
The first success establishes the baseline. Application rollback does not roll
back shared Keycloak data or users. Jenkins separates manual build, promotion
with a required candidate ID, and rollback jobs. Backend Maven and frontend npm
builds remain independent of infra and a running cluster.
