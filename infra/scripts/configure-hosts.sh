#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
"$infra_dir/tls/generate.sh"
if sudo -n true 2>/dev/null; then
  sudo -n python3 "$infra_dir/scripts/configure-wsl-hosts.py"
  sudo -n cp "$infra_dir/.local/tls/local-ca.crt" /usr/local/share/ca-certificates/cluster-lab.crt
  sudo -n update-ca-certificates
else
  wsl=/mnt/c/WINDOWS/system32/wsl.exe
  "$wsl" -d "$WSL_DISTRO_NAME" -u root -- python3 "$infra_dir/scripts/configure-wsl-hosts.py"
  "$wsl" -d "$WSL_DISTRO_NAME" -u root -- cp "$infra_dir/.local/tls/local-ca.crt" /usr/local/share/ca-certificates/cluster-lab.crt
  "$wsl" -d "$WSL_DISTRO_NAME" -u root -- update-ca-certificates
fi
powershell=/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe
"$powershell" -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w "$infra_dir/scripts/configure-windows.ps1")" -CertificatePath "$(wslpath -w "$infra_dir/.local/tls/local-ca.crt")"
