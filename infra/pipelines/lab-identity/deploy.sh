#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/../../scripts/application.sh" lab-identity
lab_context
node "$pipeline_dir/candidate.mjs" verify
"$K3D_BIN" image import --mode direct --cluster tiagolabs-local lab-identity-backend:local lab-identity-frontend:local
"$operations_dir/deploy.sh"
