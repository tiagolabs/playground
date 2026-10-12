#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/../../../scripts/application.sh" hero-association
export KUBECONFIG="$KUBECONFIG"
namespace=hero-association
patch_dir="$app_dir/overlays/local"

if [[ $# -ne 0 ]]; then
  printf 'Usage: %s\n' "$0" >&2
  exit 2
fi
if [[ ! -f "$KUBECONFIG" || "$(kubectl config current-context)" != 'k3d-tiagolabs-local' ]]; then
  printf 'Refusing to enable Expedition outside the isolated hero-association k3d context.\n' >&2
  exit 1
fi
kubectl -n "$namespace" get secret hero-association-expedition-credentials >/dev/null
for service in core bff expedition; do
  kubectl -n "$namespace" rollout status "deployment/$service" --timeout=5m
done
reservation_table="$(kubectl -n "$namespace" exec deployment/postgres-core -c postgres -- \
  psql -U hero_association -d hero_association -At \
  -c "SELECT to_regclass('public.expedition_reservation') IS NOT NULL")"
if [[ "$reservation_table" != 't' ]]; then
  printf 'Core lacks the Expedition reservation table. Build/import the new Core image and run ./deploy-backend.sh --reset-core-db first.\n' >&2
  exit 1
fi

node "$operations_dir/sync-expedition-realm.mjs"
kubectl apply -f "$k8s_dir/mesh/core-expedition-authorization.yaml"
for service in core bff expedition; do
  kubectl -n "$namespace" patch deployment "$service" --type=strategic \
    --patch-file "$patch_dir/$service.yaml"
  kubectl -n "$namespace" rollout status "deployment/$service" --timeout=5m
done
printf 'Private k3d Expedition integration is enabled; deploy a Map-enabled frontend to expose combat.\n'
