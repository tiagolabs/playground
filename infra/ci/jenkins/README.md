# Shared local Jenkins

The Docker Compose controller runs at http://127.0.0.1:15180 with its private home at `infra/.local/local/ci/jenkins/controller-home/`. A single-executor WSL agent has Java 25, Node 24, Docker, kubectl, and the isolated `k3d-tiagolabs-local` kubeconfig. Controller containers run no builds.

From `playground/`:

```bash
infra/ci/jenkins/setup-local.sh
docker compose -f infra/ci/jenkins/compose.yaml up --detach --build
infra/ci/jenkins/enroll-agent.sh
infra/ci/jenkins/install-agent-service.sh
```

The username is `admin`; its random password is in ignored `infra/.local/local/ci/jenkins/.env`. The enrollment secret, agent settings, and agent JAR live in that same private directory. Its `agent/` subdirectory holds the WSL workspace and archived evidence. The agent service is `tiagolabs-local-jenkins-agent.service`; it is started for this session and has automatic startup disabled.
Installation requires access to the WSL user systemd manager. Unrelated failed
user units do not prevent installing or starting this agent.

Project jobs are mounted read-only from:

- `infra/ci/jenkins/jobs/hero-association.groovy`: eight build-worktree, build-main, and deploy lanes.
- `infra/ci/jenkins/jobs/lab-identity.groovy`: manual candidate build, promotion with
  required `CANDIDATE_ID`, and rollback. Promotion never rebuilds the candidate.

See [Lab Identity delivery](../../pipelines/lab-identity/README.md) for retained
archives and recovery. Normal daily startup/shutdown after initial setup uses
`infra/scripts/lab.sh start` and `infra/scripts/lab.sh stop`; `check` verifies
controller availability and that the WSL agent is actually connected.

The shared CasC configuration owns authentication and agent configuration. Delivery runners are centralized under `infra/pipelines/<application>/`; job Groovy orchestrates those scripts. `LAB_SOURCE_REPO` points to `playground/`; `HERO_ASSOCIATION_SOURCE_REPO` remains a compatibility environment alias for existing test runners. The agent uses `infra/.local/local/kubeconfig` through `LAB_KUBECONFIG` and the Hero kubeconfig variable.

Restart only this controller after editing shared CasC or mounted job declarations:

```bash
docker compose -f infra/ci/jenkins/compose.yaml restart jenkins
systemctl --user status tiagolabs-local-jenkins-agent.service
```

Confirm newly added jobs appear in the UI after startup. If a new job is absent,
restart this controller once more after startup completes; its configuration and
history remain in the private controller home.

Hero's trusted-main jobs build committed source. Worktree jobs validate the
current working tree. Candidate promotion is an explicit, separate operation.
