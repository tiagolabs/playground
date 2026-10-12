#!/usr/bin/env bash
# Source with an application name to locate its source and infrastructure.
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
lab_application="${1:?Application name is required}"
[[ "$lab_application" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ && -d "$infra_dir/apps/$lab_application" ]] ||
  { printf 'Unknown lab application: %s\n' "$lab_application" >&2; return 2; }
project_dir="$workspace_dir/projects/$lab_application"
app_dir="$infra_dir/apps/$lab_application"
k8s_dir="$app_dir/base"
operations_dir="$app_dir/operations"
tests_dir="$infra_dir/tests/$lab_application"
pipeline_dir="$infra_dir/pipelines/$lab_application"
private_dir="$local_state_dir/apps/$lab_application"
artifact_root="$local_state_dir/pipelines/$lab_application/artifacts"
