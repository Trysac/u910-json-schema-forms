#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="test/fixtures/json-schema-test-suite"
COMMIT="23a2a6886e090f77d33d99d14619d84bf40114cc"
ARCHIVE_URL="https://github.com/json-schema-org/JSON-Schema-Test-Suite/archive/${COMMIT}.tar.gz"
EXPECTED_SHA256="9a1a8c9b98099ea6baef2dc1b11ce20fbe4b4a39ba4cbe6562ba7cf4fb5f442b"

mkdir -p "${TARGET_DIR}"
ARCHIVE_FILE="/tmp/json-schema-test-suite.tar.gz"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "${ARCHIVE_URL}" -o "${ARCHIVE_FILE}"
else
  wget -qO "${ARCHIVE_FILE}" "${ARCHIVE_URL}"
fi

ACTUAL_SHA256=$(sha256sum "${ARCHIVE_FILE}" | cut -d' ' -f1)
if [ "${ACTUAL_SHA256}" != "${EXPECTED_SHA256}" ]; then
  echo "Checksum verification failed for JSON Schema Test Suite! Expected ${EXPECTED_SHA256}, got ${ACTUAL_SHA256}" >&2
  exit 1
fi

tar -xzf "${ARCHIVE_FILE}" --strip-components=1 -C "${TARGET_DIR}"
rm -f "${ARCHIVE_FILE}"

if command -v npx >/dev/null 2>&1; then
  npx playwright install --with-deps chromium || true
fi

echo "Conformance setup completed successfully."
