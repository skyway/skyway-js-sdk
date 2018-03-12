#!/usr/bin/env bash
# Stop script if error occurs
set -e
set -o pipefail

echo "//registry.npmjs.org/:_authToken=\${NPM_TOKEN}" > .npmrc
npm publish --access public
