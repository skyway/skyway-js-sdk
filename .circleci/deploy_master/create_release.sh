#!/usr/bin/env bash
# Stop script if error occurs
set -e
set -o pipefail

# Get release info from CHANGELOG
cl_startline=$(cat CHANGELOG.md | grep -nE "^### " | head -n 1 | cut -d ":" -f 1)
cl_finishline=$(($(cat CHANGELOG.md | grep -nE "^## " | head -n 2 | tail -n 1 | cut -d ":" -f 1) - 1))
changelog=`sed -n "${cl_startline},${cl_finishline}p" CHANGELOG.md`;
version_num=`cat package.json | jq -r ".version"`

posix_escaped_changelog=`printf "%q" "$changelog"`;
escaped_changelog=`echo "$posix_escaped_changelog" | sed "s/^\$'\(.*\)'$/\1/"`;

release_tag_name="v$version_num";
release_commitish="master";
release_name="$release_tag_name";
release_body="\`\`\`\nhttps://cdn.webrtc.ecl.ntt.com/skyway-$version_num.js\n\`\`\`\n$escaped_changelog";

release_post_body=`cat << EOS
{
    "tag_name": "${release_tag_name}",
    "target_commitish": "${release_commitish}",
    "name": "${release_name}",
    "body": "${release_body}"
}
EOS
`

# Create release
url="https://api.github.com/repos/$CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME/releases";
response=`curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" "$url" -d "$release_post_body"`;
release_id=`echo $response | jq -r ".id"`;

if [[ "$release_id" == "null" ]];
then
    echo "Could not find release id";
    exit 1;
fi

# Upload builds
url="https://uploads.github.com/repos/$CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME/releases/$release_id/assets";

for path in dist/*; do
    filename=$(basename $path);
    echo "Uploading $filename to releases";
    curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/javascript" -d @"./dist/${filename}" "${url}?name=$filename"
done
