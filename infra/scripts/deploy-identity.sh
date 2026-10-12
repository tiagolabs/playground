#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
lab_context
umask 077
node "$infra_dir/scripts/generate-realm.mjs"
kubectl apply -f "$infra_dir/platform/policies/namespaces.yaml"
secrets="$infra_dir/.local/local/identity"
kubectl -n identity create secret generic identity-credentials --from-file="$secrets/KEYCLOAK_DATABASE_PASSWORD" --from-file="$secrets/KEYCLOAK_ADMIN_PASSWORD" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n identity create secret generic lab-realm --from-file="$secrets/lab-realm.json" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f "$infra_dir/platform/identity/postgres.yaml" -f "$infra_dir/platform/identity/mailpit.yaml" -f "$infra_dir/platform/identity/network.yaml"
kubectl -n identity rollout status deployment/postgres-keycloak --timeout=300s
kubectl apply -f "$infra_dir/platform/identity/keycloak.yaml" -f "$infra_dir/platform/identity/route.yaml"
kubectl -n identity rollout status deployment/keycloak --timeout=600s
kubectl -n identity delete configmap lab-realm --ignore-not-found
node "$infra_dir/scripts/sync-identity.mjs"
