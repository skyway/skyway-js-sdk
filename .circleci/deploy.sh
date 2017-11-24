#!/bin/bash

# Skip if executed in a forked repository or local
if [ "${AWS_ACCESS_KEY_ID}" == "" ] || [ "${AWS_SECRET_ACCESS_KEY}" == "" ] || 
   [ "${NPM_USER}" == "" ] || [ "${NPM_EMAIL}" == "" ] || [ "${NPM_PASS}" == "" ]; then
    echo "Skipped."
    exit 0
fi

# Set environment variables
if [ "${CIRCLE_BRANCH}" == "master" ]; then
    # Production
    s3_dist_bucket="s3://eclrtc-cdn-production/"
    s3_example_bucket="s3://eclrtc-example-production"
    examples_sdk_url="\/\/cdn.webrtc.ecl.ntt.com\/skyway-latest.js"
    base_domain="\.webrtc\.ecl\.ntt\.com"

    # Publish to npm
    echo -e "$NPM_USER\n$NPM_PASS\n$NPM_EMAIL" | npm login
    npm publish --access public

elif [[ "${CIRCLE_BRANCH}" =~ "release/" ]]; then 
    # Staging
    s3_dist_bucket="s3://eclrtc-cdn-staging/"
    s3_example_bucket="s3://eclrtc-example-staging/"
    examples_sdk_url="\/\/cdn.stage.ecl.skyway.io\/skyway-latest.js"
    base_domain="\.stage\.ecl\.skyway\.io"
else 
    echo "Skipped."
    exit 0
fi

# Set API key for examples
skyway_apikey="5bea388b-3f95-4e1e-acb5-a34efdd0c480"
echo "window.__SKYWAY_KEY__ = '${skyway_apikey}';" > ./examples/key.js;

# Replace variable
find examples -name index.html | xargs sed -i -e "s/\"\/\/cdn\.webrtc\.ecl\.ntt\.com\/skyway-latest\.js\"/\"${examples_sdk_url}\"/g"
find dist -name "*.js" | xargs sed -i -e "s/\.webrtc\.ecl\.ntt\.com/${base_domain}/g"

# Set aws keys
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}"

# Upload sdk to s3
sdk_version=`cat package.json | jq -r .version`
for path in dist/*; do
    filename=$(basename $path);
    s3cmd --no-mime-magic --guess-mime-type put ./dist/${filename} $s3_dist_bucket${filename%%.*}-${sdk_version}.${filename#*.};
    s3cmd --no-mime-magic --guess-mime-type put ./dist/${filename} $s3_dist_bucket${filename%%.*}-latest.${filename#*.};
done

# Upload examples
s3cmd --no-mime-magic --guess-mime-type put -r ./examples/* $s3_example_bucket
