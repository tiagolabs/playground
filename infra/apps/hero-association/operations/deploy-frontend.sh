#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/../../../scripts/application.sh" hero-association
kubeconfig_path="$KUBECONFIG"

if [[ ! -f "$kubeconfig_path" ]]; then
  printf 'Missing %s. Create the k3d cluster first.\n' "$kubeconfig_path" >&2
  exit 1
fi
export KUBECONFIG="$kubeconfig_path"
if [[ "$(kubectl config current-context)" != 'k3d-cluster-lab' ]]; then
  printf 'Refusing to deploy outside the hero-association k3d context.\n' >&2
  exit 1
fi

kubectl -n hero-association rollout status deployment/bff --timeout=5m
kubectl apply -k "$k8s_dir/frontend"
kubectl -n hero-association rollout restart deployment/frontend
kubectl -n hero-association rollout status deployment/frontend --timeout=5m
