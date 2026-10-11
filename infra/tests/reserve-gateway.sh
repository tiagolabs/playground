#!/usr/bin/env bash
# Source before provisioning tests that share an application's E2E hostnames.
test_application="${1:?Application name is required}"
[[ "$test_application" =~ ^[a-z][a-z0-9-]*$ ]] || return 2
umask 077
exec {gateway_test_lock}>"${TMPDIR:-/tmp}/cluster-lab-${UID}-${test_application}-gateway.lock"
flock -n "$gateway_test_lock" ||
  { printf 'Another %s gateway test is running; wait for it to finish.\n' "$test_application" >&2; return 1; }
