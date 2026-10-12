# Lab Identity delivery

Run from the workspace root. Choose an unused candidate ID, or omit the build
argument to generate one; the successful build prints its promotion command.

```bash
infra/pipelines/lab-identity/build.sh study-001
node infra/pipelines/lab-identity/candidate.mjs list
infra/pipelines/lab-identity/deploy.sh study-001
```

Build verifies the backend tests and frontend production build, creates uniquely
tagged images, checks frontend asset/config readability as the image's
unprivileged user, and archives them with the rendered local deployment manifest.
The source digest includes backend/frontend inputs, application configuration,
delivery scripts, and shared helpers. Source changes during validation reject
the build. The backend and frontend still build independently without a cluster;
candidate assembly needs Docker, kubectl's offline Kustomize renderer, and tar.

Candidates are retained in ignored
`infra/.local/local/pipelines/lab-identity/candidates/<id>/`. Each contains
`candidate.json`, `images.tar`, `deployment.yaml`, and the configuration snapshot.
The metadata records passing validation, source identity, checksums, and OCI
image digests. A candidate ID cannot be reused. The legacy single
`candidate.json` is historical evidence; build a fresh candidate for this workflow.

Promotion requires an explicit ID and verifies both checksums and the archive's
image metadata. It uses the archived manifest even if current source, configuration,
or Docker tags have since changed. Backend/frontend workloads use digest references
and `imagePullPolicy: Never`; the archive is imported to this cluster's nodes.
Deployment preflight rejects other namespaces, platform resources, and mutable
application image references. Ordinary promotion supports the namespace-scoped
deployer kubeconfig described in [the infra runbook](../../README.md).

The deploy job does not build or run Maven/npm. It applies the existing private
credentials without archiving their values, waits for all three deployments,
and verifies ready backend/frontend pod image IDs against the archive. Builds
and deployments share a lock. All operations target `k3d-tiagolabs-local`.

## Rollback and recovery

```bash
infra/pipelines/lab-identity/deploy.sh rollback
```

`deployment.json` records current, previous, and pending candidates atomically.
The first successful promotion establishes a baseline; normal rollback becomes
available after the second distinct successful promotion. Re-promoting the same
candidate preserves the previous baseline. Rollback imports the retained images
and applies the previous candidate's manifest, then checks actual pod digests.
After success, the candidate that was replaced becomes the previous candidate.

A pending record is written before application changes. If rollout fails, the
current successful candidate remains recorded. Retry the same candidate, or run
rollback to restore that success. Promotion of a different candidate is blocked
while recovery is pending and a prior success is available. Failure of the first
promotion has no recorded prior success; retry it or explicitly select a newly
built corrected candidate to establish the first baseline. Manual runtime image drift
blocks normal promotion until a retained candidate is restored with rollback.

This workflow restores application images and applies stored manifests using
current private credentials. It does not restore shared Keycloak data or users,
change other applications, or prune additional resources. Keep current and
previous archives; there is no automatic candidate cleanup.

Jenkins jobs on the shared controller:

- `lab-identity-worktree`: validate, build, and retain a candidate; no deployment.
- `lab-identity-deploy`: required `CANDIDATE_ID`; promote without rebuilding.
- `lab-identity-rollback`: explicit restoration using deployment history.

The retained archive and explicit promotion pattern can be used for Pix's future
delivery scripts. Application configuration remains under `infra/apps/`, source
under `projects/`, and generated artifacts under `infra/.local/local/`.
