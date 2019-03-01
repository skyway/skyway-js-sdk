#!/usr/bin/env bash
# Stop script if error occurs
set -e
set -o pipefail

version_num=`cat package.json | jq -r ".version"`;
tag_name="v$version";

url="https://api.github.com/repos/$CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME/releases/tags/$tag_name";
status_code=`curl -s -H "Authorization: token $GITHUB_TOKEN" "$url" -o /dev/null -sw '%{http_code}'`;

if [[ $status_code -ne 404 ]]
then
    exit 1;
else
    exit 0;
fi