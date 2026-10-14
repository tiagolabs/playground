# Shared project conventions

The `tiagolabs-local` k3d cluster is a local study platform. Shared infrastructure
belongs in `infra/`. Study projects live in `projects/<project>/` and contain
source, Dockerfiles, build definitions, and application tests. All operational
configuration is centralized:
`infra/apps/<application>/` contains workloads, routes, identity declarations,
mesh policies, overlays, and operations; `infra/pipelines/<application>/`
contains delivery runners; `infra/ci/jenkins/` owns controller and job definitions.
Applications retain separate namespaces, data stores, secrets, and delivery jobs.
`infra/clusters/local/` selects the platform and application overlays for this lab.
Versioned configuration stays in that directory. Generated kubeconfigs, credentials,
certificates, delivery artifacts, CI homes, and migration backups belong in ignored
`infra/.local/local/`. Shared CLI binaries are cached in `infra/.local/tools/`.

The lab uses `127.0.0.2:443`. The independent Raydow cluster uses
`127.0.0.1:443`. Always select the explicit `k3d-tiagolabs-local` context for lab
mutations. Never operate on another cluster as a side effect of lab commands.

Keycloak belongs to the shared `identity` namespace. The `lab` realm owns
users and credentials. Applications have client-scoped `app-user` roles;
additional roles describe responsibilities, such as `identity-admin`.
Grant Hero Association and payment-integrations access explicitly. Application APIs enforce their audience
and roles; a shared login does not grant access to every application.

Project deployment/reset commands must not reset shared identity or platform
services. Keep generated secrets, kubeconfigs, certificates, and artifacts
ignored. Never log passwords or tokens. Use English and singular database
table names. Update the affected SPEC and workflow documentation with behavior
changes, and run relevant checks. Do not commit, push, tag, or publish releases.

Namespace policies under `infra/platform/policies/` own resource budgets,
network boundaries, and namespace-scoped deployment roles. Allow only declared
shared dependencies. Application deployment/reset must stay within its namespace;
cluster bootstrap and disposable test namespaces require the platform operator.
Keep CI job definitions small and call tested scripts from `infra/pipelines/`.
Do not introduce a deployment controller just to adopt this directory structure.
