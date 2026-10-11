#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/../../scripts/application.sh" lab-identity
source_digest="$(node "$pipeline_dir/candidate.mjs" digest)"
(cd "$project_dir/backend" && ./mvnw --batch-mode verify)
(cd "$project_dir/frontend" && npm ci --no-audit --no-fund && npm run build)
docker build -t lab-identity-backend:local "$project_dir/backend"
docker build -t lab-identity-frontend:local "$project_dir/frontend"
node "$pipeline_dir/candidate.mjs" record "$source_digest"
