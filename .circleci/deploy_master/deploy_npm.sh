#!/usr/bin/env bash
# Stop script if error occurs
set -e
set -o pipefail

./check_is_new_release.sh;
if [ $? -ne 0 ]
then
    echo "Release $tag_name already exists, skipping.";
    exit 0;
fi

echo "//registry.npmjs.org/:_authToken=\${NPM_TOKEN}" > .npmrc
npm publish --access public
