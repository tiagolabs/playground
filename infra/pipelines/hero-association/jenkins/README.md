# Hero Jenkins delivery runners

The [shared controller and agent](../../../ci/jenkins/README.md) live under
`infra/ci/jenkins/`. Job definitions are in
`infra/ci/jenkins/jobs/hero-association.groovy`; this directory contains the
agent-side runners. Snapshot helpers are in `infra/pipelines/shared/`.

Core, BFF, Expedition, Market, Assets, World, Quest, and frontend each have:

- `hero-association-<service>-build-worktree`: snapshots tracked changes and
  non-ignored new files, builds one service, combines it with the seven running
  baseline images, and verifies that exact eight-image archive in a disposable namespace.
- `hero-association-<service>-build-main`: checks out trusted main and runs the
  same gate. New paths become available on main only after a separate authorized
  commit; this migration does not commit or push.
- `hero-association-<service>-deploy-local`: takes `ARTIFACT_ID`, requires the
  passing archive gate and unchanged baseline, promotes only that service, and
  runs browser/load checks. Failed promotion restores its previous image.

Builds do not deploy. Two legacy full-stack jobs remain disabled. All jobs
share the trusted WSL agent's single executor. The controller has no Docker
socket or kubeconfig; the agent needs Docker, Java 25, Node 24, kubectl,
k3d, and private operator credentials for disposable namespaces.

`LAB_SOURCE_REPO` is the workspace root. Source is in `hero-association/`;
operational code is in `infra/`. `LAB_KUBECONFIG` selects the operator's
kubeconfig. `HERO_ASSOCIATION_LOCAL_CA_CERTIFICATE` selects the shared CA
certificate when running from an isolated snapshot. Credentials stay outside snapshots.

Verified Jenkins artifacts stay in `JENKINS_AGENT_WORKDIR/artifacts/<id>/all/`.
The job archives their IDs, manifests, verification records, and promotion evidence.
CLI artifacts use ignored `infra/.local/local/pipelines/hero-association/`.
See the [pipeline runbook](../README.md) for checksums, image digests,
eight-image verification, reset audits, and recovery gates.
