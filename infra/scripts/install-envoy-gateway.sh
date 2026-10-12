#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
lab_context
manifest_path="$(mktemp)"
trap 'rm -f -- "$manifest_path"' EXIT
curl --fail --location --silent --show-error \
  'https://github.com/envoyproxy/gateway/releases/download/v1.9.1/install.yaml' \
  --output "$manifest_path"
printf '%s  %s\n' \
  '72b3971364f172eb0b9636c7142cc84ff695467bc065897958bde85a3c06cfd5' \
  "$manifest_path" | sha256sum --check --status

kubectl apply --server-side --field-manager=tiagolabs-local-envoy-gateway \
  -f "$manifest_path"
kubectl -n envoy-gateway-system rollout status deployment/envoy-gateway --timeout=180s

kubectl apply -f "$infra_dir/platform/gateway/redis-gateway-ha.yaml"
kubectl -n envoy-gateway-system rollout status statefulset/redis-gateway-ha --timeout=180s
kubectl apply -f "$infra_dir/platform/gateway/envoy-gateway-config.yaml"
kubectl -n envoy-gateway-system rollout restart deployment/envoy-gateway
kubectl -n envoy-gateway-system rollout status deployment/envoy-gateway --timeout=180s
