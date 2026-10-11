#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $# -eq 1 ]] || { printf 'Usage: %s SIX_IMAGE_ARCHIVE_DIRECTORY\n' "$0" >&2; exit 2; }
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/../../../scripts/application.sh" hero-association
export KUBECONFIG="${HERO_ASSOCIATION_K3D_KUBECONFIG:-$KUBECONFIG}"
[[ "$(kubectl config current-context)" == k3d-cluster-lab ]] || exit 1
assets_image="$(node --input-type=module - "$pipeline_dir" "$1" <<'JS'
import { pathToFileURL } from 'node:url'
const { inspectArchive, requirePassingK3dE2EVerification } = await import(pathToFileURL(process.argv[2] + '/archive-images.js'))
const archive = await inspectArchive(process.argv[3])
await requirePassingK3dE2EVerification(archive)
if (archive.promoteComponent) throw new Error('Initial Assets staging requires a complete six-service extraction archive')
process.stdout.write(archive.images.assets.ref)
JS
)"
if kubectl -n hero-association get deployment/assets >/dev/null 2>&1; then
  printf 'Assets already exists; use the normal verified promotion workflow.\n' >&2
  exit 1
fi
secret_dir="$private_dir/secrets"
mkdir -p "$secret_dir"
for key in ASSETS_DATABASE_PASSWORD HERO_ASSOCIATION_ASSETS_CORE_SERVICE_KEY; do
  if [[ ! -s "$secret_dir/$key" ]]; then
    openssl rand -hex -out "$secret_dir/$key" 32
    perl -pi -e 'chomp' "$secret_dir/$key"
  fi
done
kubectl -n hero-association create secret generic hero-association-assets-credentials \
  --from-file="$secret_dir/ASSETS_DATABASE_PASSWORD" \
  --from-file="$secret_dir/HERO_ASSOCIATION_ASSETS_CORE_SERVICE_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f "$k8s_dir/backend/service-accounts.yaml"
kubectl apply -f "$k8s_dir/backend/postgres-assets.yaml"
kubectl -n hero-association rollout status deployment/postgres-assets --timeout=5m
schema_exists="$(kubectl -n hero-association exec deployment/postgres-assets -c postgres -- \
  psql -U hero_association_assets -d hero_association_assets -At \
  -c "SELECT to_regclass('public.asset_wallet') IS NOT NULL")"
if [[ "$schema_exists" != f ]]; then
  printf 'Refusing initial staging over an existing Assets schema. Inspect the interrupted cutover.\n' >&2
  exit 1
fi
"${K3D_BIN:-$infra_dir/.local/tools/k3d}" image import --mode direct "$assets_image" --cluster cluster-lab
job="$(sed "s#hero-association-assets:k3d#$assets_image#g" \
  "$k8s_dir/backend/assets-db-bootstrap.yaml" | kubectl create -f - -o jsonpath='{.metadata.name}')"
kubectl -n hero-association wait --for=condition=complete "job/$job" --timeout=5m
node "$operations_dir/sync-assets-realm.mjs"
kubectl apply -f "$k8s_dir/mesh/assets-authorization.yaml"
sed "s#hero-association-assets:k3d#$assets_image#g" \
  "$k8s_dir/backend/assets.yaml" | kubectl apply -f -
kubectl -n hero-association rollout status deployment/assets --timeout=5m
printf 'Assets staged. Promote the same verified archive with --reset-game-db to cut over Core, Assets and Market together.\n'
