#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/../../scripts/application.sh" lab-identity
[[ $# == 1 ]] || { printf 'Usage: %s CANDIDATE_ID|rollback\n' "$0" >&2; exit 2; }
lab_context
umask 077
mkdir -p "$local_state_dir/pipelines/lab-identity"
exec 9>"$local_state_dir/pipelines/lab-identity/delivery.lock"
flock -n 9 || { printf 'Another Lab Identity build or deployment is running.\n' >&2; exit 1; }
node "$pipeline_dir/deploy.mjs" "$1"
