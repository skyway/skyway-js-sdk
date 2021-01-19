#!/bin/bash

version=$1
BRANCH_WEBSITE='master'

# setup git
git config --global user.email "webrtc.skyway@gmail.com"
git config --global user.name "skyway-ci-bot"

# clone website repo
echo -e "StrictHostKeyChecking no\n" >> ~/.ssh/config
git clone -b $BRANCH_WEBSITE git@github.com:nttcom-webcore/skyway-official-web-site.git

# update version
cat skyway-official-web-site/docs/documents/javascript-sdk.md | grep ${version}
if [ "$?" -eq 0 ]; then
  echo "Website is up to date. Skip updating website."
  exit 0
fi
sed -i -e "s/skyway-[0-9]\{0,\}\.[0-9]\{0,\}\.[0-9]\{0,\}/skyway-${version}/g" skyway-official-web-site/docs/documents/javascript-sdk.md
sed -i -e "s/skyway-[0-9]\{0,\}\.[0-9]\{0,\}\.[0-9]\{0,\}/skyway-${version}/g" skyway-official-web-site/docs/en/documents/javascript-sdk.md

# deploy
cd skyway-official-web-site
git add -A
git commit -m 'Update js-sdk version'
git push origin $BRANCH_WEBSITE
echo 'Successful deployment!!'
exit 0
