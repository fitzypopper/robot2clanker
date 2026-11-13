#!/usr/bin/env bash
#
# Download the geckodriver binary used by the end-to-end test.
#
#   ./tools/fetch-geckodriver.sh
#
set -euo pipefail

cd "$(dirname "$0")"

if [ -x geckodriver ]; then
  echo "geckodriver is already present: $(./geckodriver --version | head -1)"
  exit 0
fi

URL=$(curl -sL --max-time 60 "https://api.github.com/repos/mozilla/geckodriver/releases/latest" \
  | python3 -c "
import json, sys
release = json.load(sys.stdin)
for asset in release['assets']:
    if 'linux64' in asset['name'] and asset['name'].endswith('.tar.gz'):
        print(asset['browser_download_url'])
        break
else:
    sys.exit('no linux64 geckodriver asset found')
")

TMP=$(mktemp -d)
trap 'rm -rf "${TMP}"' EXIT

echo "downloading ${URL}"
curl -sL --max-time 180 -o "${TMP}/geckodriver.tar.gz" "${URL}"
tar -xzf "${TMP}/geckodriver.tar.gz" -C "${TMP}"
cp "${TMP}/geckodriver" ./geckodriver
chmod +x ./geckodriver

echo "installed: $(./geckodriver --version | head -1)"
