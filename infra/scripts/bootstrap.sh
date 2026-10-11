#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
for step in create-cluster install-policies install-mesh install-envoy-gateway install-gateway deploy-identity install-observability; do
  "$script_dir/$step.sh"
done
