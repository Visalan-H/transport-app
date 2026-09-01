#!/bin/sh
# Generates a throwaway self-signed certificate when none has been mounted.
#
# Production bind-mounts the real Cloudflare Origin CA pair over /etc/nginx/certs, so this does
# nothing there. It exists so that `docker compose up --build` on a laptop -- where no certificate
# exists and none should -- still starts, instead of nginx aborting on a missing ssl_certificate.
#
# The generated pair is deliberately worthless: self-signed, CN=localhost, regenerated on every
# start. Nothing should ever trust it, and Cloudflare's Full (strict) mode explicitly will not.
set -e

CERT_DIR=/etc/nginx/certs
CERT="$CERT_DIR/origin.pem"
KEY="$CERT_DIR/origin.key"

if [ -f "$CERT" ] && [ -f "$KEY" ]; then
    echo "[tls] using mounted certificate"
    exit 0
fi

echo "[tls] no certificate mounted -- generating a self-signed placeholder (NOT for production)"
mkdir -p "$CERT_DIR"
openssl req -x509 -nodes -newkey rsa:2048 -days 365     -keyout "$KEY" -out "$CERT" -subj "/CN=localhost" >/dev/null 2>&1
