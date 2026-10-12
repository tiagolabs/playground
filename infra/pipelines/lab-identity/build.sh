#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/../../scripts/application.sh" lab-identity
[[ $# -le 1 ]] || { printf 'Usage: %s [candidate-id]\n' "$0" >&2; exit 2; }
umask 077
state_dir="$local_state_dir/pipelines/lab-identity"
mkdir -p "$state_dir/candidates"
exec 9>"$state_dir/delivery.lock"
flock -n 9 || { printf 'Another Lab Identity build or deployment is running.\n' >&2; exit 1; }
source_digest="$(node "$pipeline_dir/candidate.mjs" digest)"
candidate_id="${1:-local-$(date -u +%Y%m%dT%H%M%S | tr '[:upper:]' '[:lower:]')-${source_digest:0:12}-$(openssl rand -hex 4)}"
node "$pipeline_dir/candidate.mjs" preflight "$candidate_id"
temporary="$(mktemp -d "$state_dir/candidates/.building.XXXXXX")"
trap 'rm -rf -- "$temporary"' EXIT
(umask 022; cd "$project_dir/backend"; ./mvnw --batch-mode verify)
# Private archives use 077; public assets must remain readable by nginx's user.
(umask 022; cd "$project_dir/frontend"; npm ci --no-audit --no-fund; npm run build; chmod -R a+rX dist)
for component in backend frontend; do
  docker build --label "io.tiagolabs.source-digest=$source_digest" --label "io.tiagolabs.candidate=$candidate_id" \
    -t "lab-identity-$component:$candidate_id" "$project_dir/$component"
done
# Check access as the image's default unprivileged user before retaining it.
docker run --rm --network none --read-only --entrypoint sh "lab-identity-frontend:$candidate_id" \
  -c 'test -r /usr/share/nginx/html/index.html && test -r /etc/nginx/conf.d/default.conf'
docker image save --output "$temporary/images.tar" "lab-identity-backend:$candidate_id" "lab-identity-frontend:$candidate_id"
node "$pipeline_dir/candidate.mjs" record "$source_digest" "$candidate_id" "$temporary"
