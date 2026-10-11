# Shared local Jenkins

The Docker Compose controller runs at http://127.0.0.1:15180 with its own volume. A single-executor WSL agent has Java 25, Node 24, Docker, kubectl, and the isolated `k3d-cluster-lab` kubeconfig. Controller containers run no builds.

From `hands-on/`:

```bash
infra/ci/jenkins/setup-local.sh
docker compose -f infra/ci/jenkins/compose.yaml up --detach --build
infra/ci/jenkins/enroll-agent.sh
infra/ci/jenkins/install-agent-service.sh
```

The username is `admin`; its random password is in ignored `infra/ci/jenkins/.env`. The enrollment secret, agent settings, and agent JAR are also ignored. The agent service is `cluster-lab-jenkins-agent.service`; it is started for this session and has automatic startup disabled.

Project jobs are mounted read-only from:

- `infra/ci/jenkins/jobs/hero-association.groovy`: eight build-worktree, build-main, and deploy lanes.
- `infra/ci/jenkins/jobs/lab-identity.groovy`: manual validation and explicit deployment.

The shared CasC configuration owns authentication and agent configuration. Delivery runners are centralized under `infra/pipelines/<application>/`; job Groovy orchestrates those scripts. `LAB_SOURCE_REPO` points to `hands-on/`; `HERO_ASSOCIATION_SOURCE_REPO` remains a compatibility environment alias for existing test runners. The agent uses `infra/.local/kubeconfig` through `LAB_KUBECONFIG` and the Hero kubeconfig variable.

Restart only this controller after editing shared CasC or mounted job declarations:

```bash
docker compose -f infra/ci/jenkins/compose.yaml restart jenkins
systemctl --user status cluster-lab-jenkins-agent.service
```

Hero's trusted-main jobs build the committed source and therefore will include this infrastructure change only after it is committed outside this task. Worktree jobs validate the current uncommitted implementation. No commits or pushes are performed by this migration.
