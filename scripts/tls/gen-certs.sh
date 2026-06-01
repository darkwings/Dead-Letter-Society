#!/usr/bin/env bash
# Generates a local CA + server certs for the TLS test stack.
#
# Output: docker/tls-test/certs/
#   ca.crt / ca.key                — local CA (never leave this machine)
#   broker.crt / broker.key        — Kafka broker cert (SAN: kafka, localhost, 127.0.0.1)
#   broker.keystore.p12            — PKCS12 keystore for Kafka (cert + key)
#   truststore.p12                 — PKCS12 truststore (CA cert only) — shared by broker + clients
#   sr.crt / sr.key                — Schema Registry cert (SAN: schema-registry, localhost, 127.0.0.1)
#   sr.keystore.p12                — PKCS12 keystore for Schema Registry
#
# Usage: ./scripts/tls/gen-certs.sh [--force]
#   --force  — regenerate even if certs already exist
#
# Requires: openssl (no keytool — PKCS12 only)

set -euo pipefail

FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT="$REPO_ROOT/docker/tls-test/certs"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

PASS="changeit"
DAYS=3650

if [[ -f "$OUT/ca.crt" && "$FORCE" == "false" ]]; then
  echo -e "${YELLOW}Certs already exist at $OUT${NC}"
  echo "Use --force to regenerate."
  exit 0
fi

mkdir -p "$OUT"

# ── CA ────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}Generating CA...${NC}"
openssl genrsa -out "$OUT/ca.key" 4096 2>/dev/null
openssl req -x509 -new -nodes \
  -key "$OUT/ca.key" \
  -sha256 -days "$DAYS" \
  -out "$OUT/ca.crt" \
  -subj "/C=IT/O=Dead-Letter-Society/CN=DLS-Local-CA"

# ── Kafka broker cert ─────────────────────────────────────────────────────────
echo -e "${YELLOW}Generating broker cert...${NC}"
openssl genrsa -out "$OUT/broker.key" 2048 2>/dev/null
openssl req -new \
  -key "$OUT/broker.key" \
  -out "$OUT/broker.csr" \
  -subj "/C=IT/O=Dead-Letter-Society/CN=kafka"
openssl x509 -req \
  -in "$OUT/broker.csr" \
  -CA "$OUT/ca.crt" -CAkey "$OUT/ca.key" -CAcreateserial \
  -out "$OUT/broker.crt" \
  -days "$DAYS" -sha256 \
  -extfile <(printf 'subjectAltName=DNS:kafka,DNS:localhost,IP:127.0.0.1\n')

# Broker PKCS12 keystore
openssl pkcs12 -export \
  -in "$OUT/broker.crt" -inkey "$OUT/broker.key" \
  -name broker \
  -out "$OUT/broker.keystore.p12" \
  -passout "pass:$PASS"

# Shared truststore (CA cert only) — used by broker + all clients
openssl pkcs12 -export \
  -nokeys \
  -in "$OUT/ca.crt" \
  -out "$OUT/truststore.p12" \
  -passout "pass:$PASS"

# ── Schema Registry cert ──────────────────────────────────────────────────────
echo -e "${YELLOW}Generating Schema Registry cert...${NC}"
openssl genrsa -out "$OUT/sr.key" 2048 2>/dev/null
openssl req -new \
  -key "$OUT/sr.key" \
  -out "$OUT/sr.csr" \
  -subj "/C=IT/O=Dead-Letter-Society/CN=schema-registry"
openssl x509 -req \
  -in "$OUT/sr.csr" \
  -CA "$OUT/ca.crt" -CAkey "$OUT/ca.key" -CAcreateserial \
  -out "$OUT/sr.crt" \
  -days "$DAYS" -sha256 \
  -extfile <(printf 'subjectAltName=DNS:schema-registry,DNS:localhost,IP:127.0.0.1\n')

# SR PKCS12 keystore
openssl pkcs12 -export \
  -in "$OUT/sr.crt" -inkey "$OUT/sr.key" \
  -name schema-registry \
  -out "$OUT/sr.keystore.p12" \
  -passout "pass:$PASS"

# ── cleanup ───────────────────────────────────────────────────────────────────
rm -f "$OUT"/*.csr "$OUT"/*.srl

echo -e "${GREEN}Done.${NC}  certs → $OUT"
echo
echo -e "${YELLOW}Files:${NC}"
ls -1 "$OUT/"
echo
echo -e "${YELLOW}CA subject / validity:${NC}"
openssl x509 -in "$OUT/ca.crt" -noout -subject -dates
echo -e "${YELLOW}Broker SANs:${NC}"
openssl x509 -in "$OUT/broker.crt" -noout -ext subjectAltName
echo -e "${YELLOW}SR SANs:${NC}"
openssl x509 -in "$OUT/sr.crt" -noout -ext subjectAltName
echo
echo -e "${YELLOW}All certs signed by:${NC}"
openssl verify -CAfile "$OUT/ca.crt" "$OUT/broker.crt" "$OUT/sr.crt"
