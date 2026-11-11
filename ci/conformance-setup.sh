#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="test/fixtures/json-schema-test-suite"
COMMIT="245a45abc90190c0bff04d97e6d2b541b4bb9f12"  # tag Test-JSON-Schema-Acceptance-1.041
ARCHIVE_URL="https://github.com/json-schema-org/JSON-Schema-Test-Suite/archive/${COMMIT}.tar.gz"
EXPECTED_SHA256="b60bdf58fd414e9b86c8be70b03e3b2d596b8bc3bc822a2083d86041cea4b20e"

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

# Extract only the JSON test data: the archive also ships TypeScript tooling that the gates would lint.
tar -xzf "${ARCHIVE_FILE}" --strip-components=1 -C "${TARGET_DIR}" --wildcards "*/tests/*"
rm -f "${ARCHIVE_FILE}"

if command -v npx >/dev/null 2>&1; then
  npx playwright install --with-deps chromium || true
fi

echo "Conformance setup completed successfully."
