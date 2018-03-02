#!/usr/bin/env bash
# Stop script if error occurs
set -e
set -o pipefail

echo -e "$NPM_USER\n$NPM_PASS\n$NPM_EMAIL" | npm login
npm publish --access public
