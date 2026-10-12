#!/usr/bin/env bash
set -euo pipefail
[[ $# -eq 1 ]] || { printf 'Usage: %s APPLICATION\n' "$0" >&2; exit 2; }
source "$(dirname -- "${BASH_SOURCE[0]}")/application.sh" "$1"
lab_context
umask 077
mkdir -p "$infra_dir/.local/local/deployers"
python3 - "$lab_application" "$infra_dir/.local/local/deployers/$lab_application.kubeconfig" <<'PY'
import json, subprocess, sys
from pathlib import Path

application, destination = sys.argv[1:]
operator = json.loads(subprocess.check_output(
    ['kubectl', 'config', 'view', '--minify', '--flatten', '--raw', '-o', 'json']))
token = subprocess.check_output(
    ['kubectl', '-n', application, 'create', 'token', 'lab-deployer', '--duration=1h'], text=True).strip()
cluster = {key: value for key, value in operator['clusters'][0]['cluster'].items()
           if key in ['server', 'certificate-authority-data', 'tls-server-name']}
if 'certificate-authority-data' not in cluster:
    raise SystemExit('Operator config must contain the trusted cluster CA')
config = {
    'apiVersion': 'v1', 'kind': 'Config', 'current-context': 'k3d-tiagolabs-local',
    'clusters': [{'name': 'tiagolabs-local', 'cluster': cluster}],
    'users': [{'name': application + '-deployer', 'user': {'token': token}}],
    'contexts': [{'name': 'k3d-tiagolabs-local', 'context': {
        'cluster': 'tiagolabs-local', 'user': application + '-deployer', 'namespace': application}}],
}
Path(destination).write_text(json.dumps(config, indent=2) + '\n')
Path(destination).chmod(0o600)
print('Created private namespace deployer kubeconfig (requested lifetime: one hour): ' + destination)
PY
