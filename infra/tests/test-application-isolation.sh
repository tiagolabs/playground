#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/../scripts/common.sh"
lab_context
test_directory="$(mktemp -d)"
probe="lab-isolation-$$"
cleanup() {
  for app in hero-association lab-identity; do
    kubectl -n "$app" delete pod "$probe" --ignore-not-found --wait=true --timeout=60s >/dev/null || true
  done
  rm -rf -- "$test_directory"
}
trap cleanup EXIT

for app in hero-association lab-identity payment-integrations; do
  kubectl -n "$app" get resourcequota/application-budget limitrange/container-defaults networkpolicy/application-boundary >/dev/null
  principal="system:serviceaccount:$app:lab-deployer"
  [[ "$(kubectl auth can-i patch deployments -n "$app" --as="$principal")" == yes ]]
  [[ "$(kubectl auth can-i patch deployments -n identity --as="$principal" || true)" == no ]]
  [[ "$(kubectl auth can-i create namespaces --as="$principal" 2>/dev/null || true)" == no ]]
  [[ "$(kubectl auth can-i get secrets -n identity --as="$principal" || true)" == no ]]
  other=hero-association
  if [[ "$app" == hero-association ]]; then other=lab-identity; fi
  [[ "$(kubectl auth can-i patch deployments -n "$other" --as="$principal" || true)" == no ]]
done

for app in hero-association lab-identity; do
  kubectl -n "$app" run "$probe" --image=busybox:1.37.0 --restart=Never \
    --annotations=sidecar.istio.io/inject=false \
    --overrides='{"spec":{"automountServiceAccountToken":false}}' --command -- sleep 180 >/dev/null
  kubectl -n "$app" wait --for=condition=Ready "pod/$probe" --timeout=120s >/dev/null
  kubectl -n "$app" exec "$probe" -- nslookup keycloak.identity.svc.cluster.local >/dev/null
  kubectl -n "$app" exec "$probe" -- wget -q -T 10 -O /dev/null \
    http://keycloak.identity.svc.cluster.local:8080/realms/lab/.well-known/openid-configuration
  own_port=80; other_port=8080; other=lab-identity
  if [[ "$app" == lab-identity ]]; then own_port=8080; other_port=80; other=hero-association; fi
  kubectl -n "$app" exec "$probe" -- wget -q -T 10 -O /dev/null "http://frontend:$own_port/"
  other_ip="$(kubectl -n "$other" get service frontend -o jsonpath='{.spec.clusterIP}')"
  if kubectl -n "$app" exec "$probe" -- wget -q -T 3 -O /dev/null "http://$other_ip:$other_port/" >"$test_directory/cross-app.log" 2>&1; then
    printf 'Unexpected cross-application network access from %s to %s.\n' "$app" "$other" >&2
    exit 1
  fi
  printf 'Verified %s: DNS, shared login, own frontend, and cross-app denial.\n' "$app"
done

if kubectl -n lab-identity run "$probe-quota" --image=busybox:1.37.0 --restart=Never --dry-run=server \
  --annotations=sidecar.istio.io/inject=false \
  --overrides='{"spec":{"containers":[{"name":"quota","image":"busybox:1.37.0","resources":{"requests":{"cpu":"99","memory":"64Mi"},"limits":{"memory":"64Mi"}}}]}}' \
  >"$test_directory/quota.log" 2>&1; then
  printf 'Resource quota unexpectedly admitted an excessive CPU request.\n' >&2
  exit 1
fi
rg -q 'exceeded quota' "$test_directory/quota.log"
printf 'Verified namespace deployment permissions and resource quota enforcement.\n'
