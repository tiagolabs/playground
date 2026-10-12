#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
lab_context
"$infra_dir/tls/generate.sh"
kubectl apply -f "$infra_dir/platform/policies/namespaces.yaml"
kubectl -n gateway-system create secret tls tiagolabs-local-tls --cert="$infra_dir/.local/local/tls/local.crt" --key="$infra_dir/.local/local/tls/local.key" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f "$infra_dir/platform/gateway/gateway.yaml"
kubectl -n gateway-system wait --for=condition=Programmed gateway/tiagolabs-local --timeout=180s
