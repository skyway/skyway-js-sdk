#!/usr/bin/env bash
# Stop script if error occurs
set -e
set -o pipefail

# Notify SkyWay team Slack of the new release
cl_startline=$(cat CHANGELOG.md | grep -nE "^### " | head -n 1 | cut -d ":" -f 1)
cl_finishline=$(($(cat CHANGELOG.md | grep -nE "^## " | head -n 2 | tail -n 1 | cut -d ":" -f 1) - 1))
changelog=`sed -n "${cl_startline},${cl_finishline}p" CHANGELOG.md`;
version_num=`cat package.json | jq -r ".version"`

curl -X POST $NOTIFICATION_ENDOPOINT --data-urlencode 'payload={
    "username": "release bot",
    "icon_emoji": ":tada:",
    "text": "<'"$CIRCLE_BUILD_URL"'|skyway-js-sdk version '"$version_num"' released>\n*Change Log*\n```'"$changelog"'```"
}'
