#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/../../../scripts/application.sh" lab-identity
lab_context
private_dir="$infra_dir/.local/identity"
for key in LAB_IDENTITY_OIDC_CLIENT_SECRET LAB_IDENTITY_ADMIN_CLIENT_SECRET LAB_IDENTITY_STATE_SECRET LAB_IDENTITY_CSRF_SECRET; do
  [[ -s "$private_dir/$key" ]] || { printf 'Deploy shared identity first.\n' >&2; exit 1; }
done
kubectl -n lab-identity create secret generic lab-identity-credentials \
  --from-file="$private_dir/LAB_IDENTITY_OIDC_CLIENT_SECRET" --from-file="$private_dir/LAB_IDENTITY_ADMIN_CLIENT_SECRET" \
  --from-file="$private_dir/LAB_IDENTITY_STATE_SECRET" --from-file="$private_dir/LAB_IDENTITY_CSRF_SECRET" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -k "$app_dir/overlays/lab"
kubectl -n lab-identity rollout restart deployment/backend deployment/frontend
for service in redis backend frontend; do kubectl -n lab-identity rollout status "deployment/$service" --timeout=300s; done
