#!/usr/bin/env bash
set -euo pipefail
infra_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
workspace_dir="$(cd -- "$infra_dir/.." && pwd)"
export KUBECONFIG="${LAB_KUBECONFIG:-${HERO_ASSOCIATION_K3D_KUBECONFIG:-$infra_dir/.local/kubeconfig}}"
export K3D_BIN="${K3D_BIN:-$infra_dir/.local/tools/k3d}"
if [[ ! -x "$K3D_BIN" ]]; then K3D_BIN=k3d; fi
lab_context() {
  [[ -f "$KUBECONFIG" ]] || { printf 'Run infra/scripts/create-cluster.sh first.\n' >&2; exit 1; }
  [[ "$(kubectl config current-context)" == k3d-cluster-lab ]] || { printf 'Refusing to operate outside k3d-cluster-lab.\n' >&2; exit 1; }
}
