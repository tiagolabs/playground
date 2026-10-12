#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
umask 077
mkdir -p "$local_state_dir"
# Check before writing a kubeconfig supplied by the operator.
if [[ "$KUBECONFIG" != "$local_state_dir/kubeconfig" && ! -f "$KUBECONFIG" ]]; then
  printf 'The supplied kubeconfig does not exist: %s\n' "$KUBECONFIG" >&2
  exit 1
fi
if [[ -e "$KUBECONFIG" ]]; then lab_context; fi
cluster_state="$("$K3D_BIN" cluster list -o json | node "$infra_dir/scripts/cluster-state.mjs" state)"
if [[ "$cluster_state" == absent ]]; then
  "$K3D_BIN" cluster create --config "$infra_dir/clusters/local/k3d.yaml" --wait --timeout 180s
elif [[ "$cluster_state" != running ]]; then
  "$K3D_BIN" cluster start tiagolabs-local --wait --timeout 180s
fi
# Preserve explicit scoped credentials; only refresh the generated operator profile.
if [[ "$KUBECONFIG" == "$local_state_dir/kubeconfig" ]]; then
  temporary_kubeconfig="$(mktemp "$local_state_dir/kubeconfig.XXXXXX")"
  trap 'rm -f -- "$temporary_kubeconfig"' EXIT
  "$K3D_BIN" kubeconfig get tiagolabs-local > "$temporary_kubeconfig"
  chmod 600 "$temporary_kubeconfig"
  mv -- "$temporary_kubeconfig" "$KUBECONFIG"
elif [[ ! -f "$KUBECONFIG" ]]; then
  printf 'The supplied kubeconfig does not exist: %s\n' "$KUBECONFIG" >&2
  exit 1
fi
lab_context
kubectl wait --for=condition=Ready nodes --all --timeout=180s
