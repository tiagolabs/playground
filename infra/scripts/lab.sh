#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
[[ $# == 1 ]] || { printf 'Usage: %s start|stop|status|check\n' "$0" >&2; exit 2; }
ci_dir="$infra_dir/ci/jenkins"
agent_unit=tiagolabs-local-jenkins-agent.service

agent_installed() {
  [[ "$(systemctl --user show "$agent_unit" --property=LoadState --value 2>/dev/null || true)" == loaded ]]
}

case "$1" in
  start|stop)
    umask 077
    mkdir -p "$local_state_dir"
    exec 9>"$local_state_dir/lifecycle.lock"
    flock -n 9 || { printf 'Another lab lifecycle command is running.\n' >&2; exit 1; }
    if [[ -f "$KUBECONFIG" ]]; then lab_context; fi
    if [[ "$1" == start ]]; then
      "$infra_dir/scripts/create-cluster.sh"
      if [[ -f "$local_state_dir/ci/jenkins/.env" ]]; then
        docker compose -f "$ci_dir/compose.yaml" up --detach --no-build jenkins
        if agent_installed; then
          systemctl --user start "$agent_unit"
        else
          printf 'Jenkins agent is not installed; follow infra/ci/jenkins/README.md.\n'
        fi
      else
        printf 'Jenkins is not configured; follow infra/ci/jenkins/README.md.\n'
      fi
      printf 'Lab started. Run infra/scripts/lab.sh check after services become ready.\n'
    else
      if agent_installed; then systemctl --user stop "$agent_unit"; fi
      if [[ -f "$local_state_dir/ci/jenkins/.env" ]]; then
        docker compose -f "$ci_dir/compose.yaml" stop jenkins
      fi
      cluster_state="$("$K3D_BIN" cluster list -o json | node "$infra_dir/scripts/cluster-state.mjs" state)"
      if [[ "$cluster_state" != absent && "$cluster_state" != stopped ]]; then
        "$K3D_BIN" cluster stop tiagolabs-local
      fi
      printf 'Lab stopped; cluster volumes and private state are retained.\n'
    fi
    ;;
  status|check) node "$infra_dir/scripts/lab-health.mjs" "$1" ;;
  *) printf 'Usage: %s start|stop|status|check\n' "$0" >&2; exit 2 ;;
esac
