#!/usr/bin/env bash
# Shared paths for the local controller and its WSL agent.
source "$(dirname -- "${BASH_SOURCE[0]}")/../../scripts/common.sh"
ci_state_dir="$local_state_dir/ci/jenkins"
