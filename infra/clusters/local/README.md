# TiagoLabs local environment

Cluster name: `tiagolabs-local`. Kubernetes context: `k3d-tiagolabs-local`.
This is the shared local development platform for TiagoLabs applications.
`tiagolabs/playground` owns its infrastructure configuration; applications from
other repositories can use the platform through explicit delivery configuration.
The environment name is independent of Git branch names.

This directory contains versioned configuration:

- `k3d.yaml`: node topology, Kubernetes API binding, and browser port mappings.
- `platform/`: selected shared infrastructure composition.
- `apps/`: selected application overlays under `infra/apps/<application>/overlays/local/`.
- `identity.json`: applications whose identity declarations are registered.

Generated private state belongs in `infra/.local/local/`:

- `kubeconfig`, `deployers/`: operator and scoped deployment credentials.
- `identity/`, `tls/`, `apps/`: generated credentials and certificates.
- `pipelines/`: candidate records, image archives, and verification evidence.
- `ci/jenkins/`: controller settings, controller data, agent settings, and workspaces.
- `migrations/`: private source snapshots and checksummed rollback backups.

Shared CLI binaries are cached in `infra/.local/tools/`. Kubernetes persistent
volumes are managed by k3d/Docker; their migration backups belong in the private
state directory. Generated state is ignored by Git and excluded from CI source
snapshots. Keep it out of this versioned directory.

The browser binds to `127.0.0.2:80/443`, and the Kubernetes API binds to
`127.0.0.1:16552`.
Application namespaces and audiences remain independent, with explicit access grants.

Daily lifecycle commands live in `infra/scripts/lab.sh`: `start`, `stop`, `status`,
and read-only `check`. They target this environment and its configured Jenkins
services. Startup resumes stopped clusters without recreating data; platform
bootstrap remains a separate operation. See [the shared runbook](../../README.md).

## Migration from Cluster Lab

k3d has no in-place cluster rename operation. The migration captures the current
application image references, identity subjects, final database table counts,
resource configuration, CI history, and offline storage archives before creating
the new cluster. Restored claims bind to the matching new nodes with `Retain`
protection. Database reset and bootstrap jobs are excluded during restoration.
The original services are retired only after data and endpoint verification.

Existing application URLs, realm `lab`, identity subjects, client IDs, credentials,
and development CA are preserved. The retained CA may carry its original subject
name; its trust fingerprint remains valid. Historical archives retain their
original verification evidence. Run a fresh gate on this environment before
using an old archive for promotion; historical records are not rewritten.

Read [the shared runbook](../../README.md) for normal bootstrap and application operations.
