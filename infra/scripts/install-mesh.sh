#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
lab_context
istioctl="${ISTIOCTL_BIN:-$(command -v istioctl || true)}"
[[ -n "$istioctl" ]] || istioctl="$infra_dir/.local/tools/istioctl"
"$istioctl" install -f "$infra_dir/platform/mesh/istio-operator.yaml" --skip-confirmation
kubectl -n istio-system rollout status deployment/istiod --timeout=180s
