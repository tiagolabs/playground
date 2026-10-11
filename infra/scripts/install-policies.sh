#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
lab_context
kubectl apply -k "$infra_dir/platform/policies"
