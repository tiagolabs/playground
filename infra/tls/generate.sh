#!/usr/bin/env bash
source "$(dirname -- "${BASH_SOURCE[0]}")/../scripts/common.sh"
umask 077
cert_dir="$infra_dir/.local/local/tls"
mkdir -p "$cert_dir"
if [[ ! -s "$cert_dir/local-ca.key" ]]; then
  openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 3650 -subj '/CN=TiagoLabs Local development CA' \
    -keyout "$cert_dir/local-ca.key" -out "$cert_dir/local-ca.crt" \
    -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign'
fi
if [[ ! -s "$cert_dir/local.crt" ]] || ! openssl x509 -in "$cert_dir/local.crt" -checkend 86400 -noout; then
  openssl req -new -newkey rsa:3072 -nodes -subj '/CN=identity.lab.test' -keyout "$cert_dir/local.key" -out "$cert_dir/local.csr"
  openssl x509 -req -in "$cert_dir/local.csr" -CA "$cert_dir/local-ca.crt" -CAkey "$cert_dir/local-ca.key" -CAcreateserial \
    -days 365 -sha256 -out "$cert_dir/local.crt" -extfile <(printf '%s\n' \
    'subjectAltName=DNS:heroassociation.test,DNS:identity.lab.test,DNS:auth.lab.test,DNS:pix.lab.test,DNS:app.e2e.heroassociation.test,DNS:auth.e2e.heroassociation.test' \
    'extendedKeyUsage=serverAuth' 'keyUsage=critical,digitalSignature,keyEncipherment')
  rm -f "$cert_dir/local.csr"
fi
for name in heroassociation.test identity.lab.test auth.lab.test pix.lab.test; do
  openssl verify -CAfile "$cert_dir/local-ca.crt" -verify_hostname "$name" "$cert_dir/local.crt"
done
