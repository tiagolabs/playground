# Lab Identity

Manage accounts, your profile, and explicit access to Hero Association and planned payment-integrations. Open https://identity.lab.test. The administrator is `lab-admin` / `lab-admin`.

The planned payment-integrations catalogue entry uses role client
`payment-integrations` and keeps launch disabled. Synchronize the canonical
shared identity client before promoting the updated Lab Identity catalogue;
coordinated live rollout is tracked in the [payment-integrations roadmap](../payment-integrations/ROADMAP.md).

Shared cluster bootstrap: [infra runbook](../../infra/README.md). Behavior: [SPEC](SPEC.md). Try the full account/access journey in [manual testing](MANUAL_TEST.md).

## Build and deploy

From `playground/` after shared bootstrap:

```bash
infra/pipelines/lab-identity/build.sh build-001
infra/pipelines/lab-identity/deploy.sh build-001
infra/pipelines/lab-identity/deploy.sh rollback
```

Choose an unused candidate ID; omit it from build to generate one. Promotion
selects a retained tested archive and does not rebuild. Rollback requires a
previous successful candidate. See the [delivery runbook](../../infra/pipelines/lab-identity/README.md)
for candidate listing, verification, scoped deployment, and recovery.

Backend only, with Java 25:

```bash
cd projects/lab-identity/backend
./mvnw --batch-mode verify
```

Frontend only, with Node 24:

```bash
cd projects/lab-identity/frontend
npm ci
npm run build
```

Backend tests use a private mock Keycloak and OIDC test identities; they need no running cluster. Actual sign-in, cookies, SSO, and mail use the browser test against the deployed lab. The backend uses server-side Redis sessions and a restricted server-only Keycloak client. No application account database is required.

For development, port-forward shared Keycloak to 17180 and project Redis to 16380, then export the four ignored `LAB_IDENTITY_*` secret files under `infra/.local/local/identity/`. Start `./mvnw quarkus:dev` on 17280 and `npm run dev` on 15174. The Vite server binds to `127.0.0.1` with strict port selection. Browser login remains on the registered HTTPS URL; use the deployed frontend for the full OIDC flow.

Jenkins jobs `lab-identity-worktree`, `lab-identity-deploy`, and
`lab-identity-rollback` run on the [shared local controller](../../infra/ci/jenkins/README.md).
Build records a retained candidate. Deploy requires `CANDIDATE_ID` and promotes
that archive without rebuilding; rollback restores a recorded successful candidate.

## Browser verification

After deploying both applications:

```bash
cd projects/lab-identity/e2e
npm ci
npm test
```

The tests use the public fixtures and validate real SSO, profile/catalogue access, admin denial, and mandatory CSRF. Browser automation accepts the development certificate; verify OS trust separately with curl. The manual guide includes account creation and password action emails.
