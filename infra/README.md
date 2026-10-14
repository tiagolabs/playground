# TiagoLabs Local infrastructure

`infra/` owns all cluster, deployment, and CI configuration for the study applications. Source projects live in `projects/<project>/` and contain application source, Dockerfiles, build definitions, standalone development dependencies, and application tests. Applications have independent namespaces, data stores, secrets, identity grants, and delivery jobs.

```text
playground/
  instructions/              workspace conventions
  projects/
    lab-identity/            account and application-access management
    hero-association/        game source and application tests
    payment-integrations/    reusable payment service and separate checkout example
  infra/
    clusters/local/k3d.yaml    k3d configuration
    clusters/local/platform/  enabled platform composition
    clusters/local/apps/      enabled application overlays
    platform/gateway/        Envoy Gateway and shared HTTPS listeners
    platform/mesh/           Istio control plane
    platform/identity/       shared Keycloak, PostgreSQL, and Mailpit
    platform/observability/  collector, Grafana, Loki, Tempo, and Prometheus
    platform/policies/      namespaces, network rules, budgets, deployment roles
    apps/<application>/
      base/                 reusable application workloads
      overlays/local/         daily lab configuration
      identity/             application-specific Keycloak clients and roles
      operations/           deployment and development operations
    pipelines/shared/       reusable delivery helpers
    pipelines/<application>/ delivery runners and archive gates
    ci/jenkins/              shared controller, WSL agent, and job definitions
    scripts/                 guarded platform operations
    tests/                   cluster and disposable deployment checks
    .local/local/            ignored credentials, kubeconfig, certificates, CI state, artifacts
    .local/tools/            shared CLI cache
```

## Cluster and routing

Cluster name: `tiagolabs-local`; Kubernetes context: `k3d-tiagolabs-local`. One server and two agents use K3s `v1.34.7-k3s1`. Its Kubernetes API is `127.0.0.1:16552`; browser HTTP/HTTPS bindings are `127.0.0.2:80` and `127.0.0.2:443`. The other cluster retains `127.0.0.1:80/443`. No default Kubernetes context is switched.

| Namespace | Owner / purpose |
| --- | --- |
| `gateway-system` | shared Gateway `tiagolabs-local` and TLS certificate |
| `envoy-gateway-system` | Envoy controller, proxy, and rate-limit Redis |
| `istio-system` | shared mesh control plane |
| `identity` | Keycloak, its PostgreSQL, and local email inbox |
| `observability` | shared telemetry services |
| `lab-identity` | identity management backend/frontend and session Redis |
| `hero-association` | game services, databases, caches, and broker |
| `payment-integrations` | reserved future application namespace |

The payment-integrations reservation above describes versioned configuration.
Its canonical namespace, client, catalogue, and `payments.lab.test` hostname
require coordinated rollout to an existing lab; this naming change has not
applied that rollout. See [the reservation runbook](apps/payment-integrations/README.md).

Application HTTPRoutes reference `tiagolabs-local` in `gateway-system`. Namespaces must opt in with `lab.test/gateway: "true"`. Test-only listeners accept only namespaces with `heroassociation.test/e2e-gateway: "true"`. Kong is deferred.

## Bootstrap

Requirements: Docker Desktop WSL integration, k3d 5.9.0, kubectl, Java 25, Node 24, and Istio CLI 1.30.5. Cached CLIs live in ignored `infra/.local/tools/`.
The Linux runners also use `flock` to coordinate hot-reload restore and shared
E2E hostname ownership. Conflicting gateway tests stop before provisioning.

From `playground/`:

```bash
infra/scripts/bootstrap.sh
infra/scripts/configure-hosts.sh
```

Host setup updates only lab aliases in WSL and Windows and trusts the development CA. WSL uses its root-user interface if passwordless sudo is unavailable. Windows must run `infra/scripts/configure-windows.ps1` with administrator rights to edit its hosts file; it imports the CA into the current user's trusted roots. The hosts script disables WSL hosts regeneration without replacing unrelated WSL settings. No WSL restart is necessary for current mappings.

| URL | Service |
| --- | --- |
| https://identity.lab.test | Lab Identity |
| https://auth.lab.test | Keycloak |
| https://heroassociation.test | Hero Association |
| https://payments.lab.test | reserved, application not deployed |

The CA/key and leaf certificate live in `.local/local/tls/`. Application/test certificate paths link to that authority. Windows curl may require `--ssl-revoke-best-effort` because this development CA has no online revocation service.

```bash
export KUBECONFIG="$PWD/infra/.local/local/kubeconfig"
kubectl get nodes
kubectl -n gateway-system get gateway tiagolabs-local
kubectl -n identity port-forward service/mailpit 18025:8025
kubectl -n observability port-forward service/otel-lgtm 13000:3000
```

Mailpit: http://localhost:18025. Grafana: http://localhost:13000, user `admin`; password is in the ignored `.local/local/grafana-admin-password`. Mail is captured locally, never sent externally.

## Identity contract

One shared realm, `lab`, gives users SSO. Explicit client-scoped `app-user` grants determine application entry. New users inherit only `lab-identity-api:app-user`. Hero Association and payment-integrations are independent grants; SSO alone gives neither. `lab-identity-api:identity-admin` controls user administration. Additional functional client roles can be introduced when application behavior needs them.

Application declarations live in `apps/<application>/identity/clients.json`. `clusters/local/identity.json` selects the registered applications, including planned payment-integrations. The shared generator combines them with bootstrap users and private secrets. The rendered realm contains credentials and is mounted from a Kubernetes Secret. Hero maps one logical application to its BFF and six resource-server clients. Its canonical `hero-association:app-user` role gates all user APIs. Tokens retain each resource server's audience and contain only client roles permitted by their login client's scope mappings. Lab Identity tokens target `lab-identity-api`.

Keycloak stores users, passwords, profile fields, and grants. Its built-in `account:manage-account` and `account:view-profile` roles are shared self-service defaults so members can open account security from their profile. Human bootstrap fixtures explicitly receive the realm default role; service accounts do not. Hero stores game accounts linked through the immutable Keycloak `sub`; it still provisions a game account and asks for a Manager name after access is granted. Lab Identity does not duplicate grants or credentials in another database.

`deploy-identity.sh` imports initial users only into a fresh database, then synchronizes declared clients and role scopes without replacing existing users or their grants. Re-run it to apply client configuration. Application deploys never reset the shared identity database. Recreating the whole lab resets its local state; game-only resets remain project operations.

Study fixtures: `lab-admin` / `lab-admin` manages accounts; `user1@mail.com` / `user1`, `user2@mail.com` / `user2`, and `user3@mail.com` / `user3` have Hero access. These are public local fixtures, not production credentials. The separate bootstrap administrator has a random private password in `.local/local/identity/KEYCLOAK_ADMIN_PASSWORD`; application code never uses it.

Lab Identity's server-only service account has `manage-users`, `query-users`, and `view-clients`, with bounded role scopes. Its API allowlists application clients and the `app-user` role. It cannot grant realm administration or change its own administrator role. Password reset uses Keycloak action emails. Session logout follows access changes; existing JWTs expire within 60 seconds.

## Shared CI

[Jenkins](ci/jenkins/README.md) runs outside Kubernetes, with its controller on http://127.0.0.1:15180 and a WSL agent. Raydow Jenkins keeps port 15190. All job declarations are in `ci/jenkins/jobs/`; application delivery scripts are in `pipelines/<application>/`.

```bash
infra/ci/jenkins/setup-local.sh
docker compose -f infra/ci/jenkins/compose.yaml up --detach --build
infra/ci/jenkins/enroll-agent.sh
infra/ci/jenkins/install-agent-service.sh
```

The private controller password is in `infra/.local/local/ci/jenkins/.env`. Controller data and the agent workspace are in the same private CI directory. The agent is started for the session; automatic startup is disabled. Stop the shared controller with its own Compose file and the agent with `systemctl --user stop tiagolabs-local-jenkins-agent.service`.

## Adding a project

Create a source project under `projects/<project>/` with its SPEC, Dockerfiles, build definitions, and tests. Add deployment configuration under `infra/apps/<application>/`, a namespace budget/network/RBAC policy under `platform/policies/`, and delivery runners under `pipelines/<application>/`. Add its enabled lab overlay to `clusters/local/apps/kustomization.yaml`, identity declaration to `clusters/local/identity.json`, and an allowlisted catalogue entry to Lab Identity. Source and infrastructure directories use the same project name. Shared path helpers accept existing application directories with lowercase names separated by hyphens. Declare its Jenkins jobs in `ci/jenkins/jobs/` and mount them in Compose/CasC. Keep application secrets, data stores, mesh rules, and service audiences separate. payment-integrations currently has only identity declarations and a reserved namespace; no payment workload is deployed.

Image imports use k3d's [direct mode](https://k3d.io/stable/usage/importing_images/), avoiding a tools-container download while preserving the same image digests.

## Application operations and isolation

Run from `playground/`:

```bash
infra/scripts/install-policies.sh
infra/pipelines/lab-identity/build.sh study-001
infra/pipelines/lab-identity/deploy.sh study-001
infra/apps/hero-association/operations/hybrid.sh run frontend
infra/tests/hero-association/test-isolated-components.sh all
infra/tests/hero-association/test-isolated-stack.sh
infra/tests/test-application-isolation.sh
```

Hero's [operations](apps/hero-association/operations/README.md) and [delivery runbook](pipelines/hero-association/README.md) preserve its build-once eight-image archive, checksum, baseline, recovery, and explicit promotion gates. [Lab Identity delivery](pipelines/lab-identity/README.md) retains tested candidates with image archives and rendered manifests; promotion selects an explicit candidate without rebuilding, pins its image digests, and records a previous success for rollback. Choose an unused candidate ID or omit the build argument to generate one. Generated artifacts and application credentials are in `.local/local/`; existing archived artifacts were retained during the move.

Kustomize bases contain workloads; overlays select environment behavior; cluster compositions list the enabled configurations. Render with `kubectl kustomize infra/clusters/local/apps` or `infra/clusters/local/platform`. Use the guarded bootstrap and app runners for application: they prepare private Secrets and bootstrap fresh game databases in the required order. Applying the whole composition directly can overwrite promoted image references and omits these delivery gates.

Application NetworkPolicies allow their own namespace, the Envoy dataplane, DNS, Keycloak, Istio, and telemetry. Other application namespaces and the shared Keycloak database are denied. Hero additionally permits documented hybrid WSL ports on private addresses, excluding the Kubernetes Pod/Service ranges. K3s's network-policy controller enforces these rules. Quotas and memory/request defaults bound each application's resource use, including sidecars and temporary rollout replicas.

Each namespace has a `lab-deployer` service account and `application-deployer` Role. These profiles cannot deploy in another namespace, change platform resources, or manage RBAC. The local Jenkins operator still needs the lab operator kubeconfig to create/delete disposable test namespaces; it is a trusted study agent, with a single executor. `LAB_KUBECONFIG` selects an explicit kubeconfig and every mutating runner checks `k3d-tiagolabs-local`. Keep operator credentials private and use bounded namespace credentials for ordinary app deployment when separating operators.

For a namespace-scoped Lab Identity deployment, issue a short-lived kubeconfig
with the operator, then deploy the verified candidate using that profile:

```bash
infra/scripts/create-deployer-kubeconfig.sh lab-identity
LAB_KUBECONFIG="$PWD/infra/.local/local/deployers/lab-identity.kubeconfig" infra/pipelines/lab-identity/deploy.sh study-001
```

The generated file contains only the scoped service-account token and cluster
connection/CA data, with a requested one-hour lifetime. Reissue it after expiry.
Hero's archive promotion also reads node platform/image information, so its
current promotion runner uses the trusted operator profile. Fresh-lab bootstrap,
shared identity configuration, and disposable test provisioning require the operator.

## Validation and lifecycle

```bash
npm --prefix infra test
infra/pipelines/shared/snapshot-worktree.test.sh
infra/tests/test-application-isolation.sh
infra/scripts/lab.sh status
infra/scripts/lab.sh check
infra/scripts/lab.sh stop
infra/scripts/lab.sh start
```

`start` creates a missing cluster or resumes an existing stopped/partial cluster,
refreshes only the canonical private operator kubeconfig, and waits for Ready
nodes. It then starts an already configured Jenkins controller without building
its image and starts the installed WSL agent. Initial platform bootstrap, host/CA
setup, and Jenkins enrollment still use their dedicated setup commands. Startup
does not deploy applications or rerun shared identity setup; run `check` once
services have recovered. Repeating start/stop is safe and preserves stored data.

`status` reports only this cluster's container counts and Jenkins state without
printing k3d metadata or secrets. `check` is read-only and returns nonzero for
failed readiness checks: explicit kubeconfig context, all three nodes, Gateway
programming, identity/Lab Identity workloads, host DNS and OS-trusted HTTPS,
Keycloak issuer, Jenkins controller, and connected WSL agent. It does not check
Hero gameplay or the planned payment-integrations application. `stop` stops this agent, controller,
and cluster while retaining Docker volumes and private state. Lifecycle commands
share a lock and always name this cluster; they never use `--all`.

Platform scripts operate only on `tiagolabs-local`. Deleting it with `k3d cluster delete tiagolabs-local` destroys lab state and must be an explicit reset. Never stop/delete the Raydow cluster to free browser ports. The retired `hero-association` cluster was removed after migration verification.
