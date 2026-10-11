# Hero lab operations

All cluster, deployment, identity, CI, and delivery configuration belongs to
[hands-on/infra](../../../README.md). Source, Dockerfiles, build definitions,
standalone backend Compose dependencies, and application tests stay in the project.

## Build and deploy the JVM backend

After shared bootstrap, run from `hands-on/` for a fresh lab:

```bash
infra/apps/hero-association/operations/build-backend-images.sh
infra/apps/hero-association/operations/build-backend-images.sh expedition
infra/apps/hero-association/operations/build-frontend-image.sh
infra/apps/hero-association/operations/deploy-backend.sh
infra/apps/hero-association/operations/stage-expedition.sh
infra/apps/hero-association/operations/enable-expedition-integration.sh
infra/apps/hero-association/operations/deploy-frontend.sh
```

Open https://heroassociation.test; shared login is https://auth.lab.test, realm
`lab`. Hero owns game data, caches, and its broker in namespace `hero-association`.
Shared bootstrap owns namespaces, budgets, network/RBAC rules, Keycloak, mesh,
gateway, TLS, and observability. Scripts select `infra/.local/kubeconfig` or
`LAB_KUBECONFIG` and guard the `k3d-cluster-lab` context.

`deploy-backend.sh` prepares credentials in
`infra/.local/apps/hero-association/secrets/`, copies the shared BFF client
secret, bootstraps only empty game databases, and validates existing schemas.
Use [verified archive promotion](../../../pipelines/hero-association/README.md)
for updates and deliberate schema/seed resets. Applying the base directly can
replace promoted images and bypass those gates.

## Hot reload and verification

Run from `hands-on/`:

```bash
infra/apps/hero-association/operations/hybrid.sh run frontend
infra/apps/hero-association/operations/hybrid.sh status frontend
infra/apps/hero-association/operations/hybrid.sh restore frontend
infra/tests/hero-association/test-isolated-components.sh all
infra/tests/hero-association/test-isolated-stack.sh EIGHT_IMAGE_ARCHIVE_DIRECTORY
infra/tests/hero-association/test-isolated-gateway.sh
infra/tests/test-application-isolation.sh
```

[Hybrid development](../../../../projects/hero-association/LOCAL_DEVELOPMENT.md) switches
one service to WSL behind its stable Kubernetes Service, then restores its saved
replica/HPA state. State is private under `infra/.local/apps/hero-association/`.
Restore all eight services before archive promotion. Disposable test runners
create and remove their own namespaces and private dependencies.

Workloads are in `../base/`; daily configuration is in `../overlays/lab/`;
the test overlay is in `../overlays/e2e/`. Identity clients are in
`../identity/clients.json`. Shared installers are in `infra/scripts/`.
Certificates and kubeconfig are in `infra/.local/`; project-local compatibility
paths have been removed. Capacity and outage runners are in `infra/tests/hero-association/`.

See [Lab Identity manual testing](../../../../projects/lab-identity/MANUAL_TEST.md)
for explicit Hero/Pix grants. A login without Hero access does not provision a game account.
