#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
umask 077
mkdir -p "$infra_dir/.local"
if ! "$K3D_BIN" cluster list -o json | node -e 'let s="";process.stdin.on("data",x=>s+=x).on("end",()=>process.exit(JSON.parse(s).some(c=>c.name==="cluster-lab")?0:1))'; then
  "$K3D_BIN" cluster create --config "$infra_dir/clusters/lab/k3d.yaml" --wait --timeout 180s
fi
"$K3D_BIN" kubeconfig get cluster-lab > "$KUBECONFIG"
lab_context
kubectl wait --for=condition=Ready nodes --all --timeout=180s
