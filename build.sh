#!/usr/bin/env bash
#
# Package the extension into a distributable XPI.
#
#   ./build.sh            -> dist/Robot2Clanker-<version>.xpi
#
# The XPI is unsigned on purpose: addons.mozilla.org is the signer for
# public listings, and about:debugging can load the unsigned file directly.

set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f extension/manifest.json ]; then
  echo "error: extension/manifest.json not found" >&2
  exit 1
fi

read -r NAME VERSION < <(python3 - <<'PY'
import json
with open("extension/manifest.json") as fh:
    manifest = json.load(fh)
print(manifest["name"], manifest["version"])
PY
)

OUT="dist/${NAME}-${VERSION}.xpi"

mkdir -p dist
rm -f "$OUT"

# -r recurse, -X drop extra file attributes, -9 maximise compression.
(cd extension && zip -r -X -9 "../${OUT}" . \
  -x ".DS_Store" "*/.DS_Store" "*.map")

echo "built ${OUT} ($(stat -c%s "${OUT}") bytes)"
echo
echo "contents:"
unzip -l "${OUT}" | sed 's/^/  /'
