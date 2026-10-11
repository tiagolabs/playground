#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
lab_context
umask 077
password_path="$infra_dir/.local/grafana-admin-password"
[[ -s "$password_path" ]] || openssl rand -hex 20 > "$password_path"
kubectl apply -f "$infra_dir/platform/observability/namespace.yaml"
kubectl -n observability create secret generic grafana-admin --from-file=admin-password="$password_path" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -k "$infra_dir/platform/observability"
kubectl -n observability rollout status deployment/otel-lgtm --timeout=300s
kubectl -n observability rollout status daemonset/observability-agent --timeout=300s
