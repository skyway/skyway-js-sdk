#!/usr/bin/env bash
# Stop script if error occurs
set -e
set -o pipefail

# Import functions
source .circleci/common/upload_to_s3.sh;

s3_dist_bucket="s3://eclrtc-cdn-gcp-staging/"
s3_example_bucket="s3://eclrtc-example-gcp-staging/"
examples_sdk_url="\/\/cdn.stage.gcp.skyway.io\/skyway-latest.js"
base_domain="\.stage\.gcp\.skyway\.io"

# Set API key for examples
skyway_apikey="32466e1c-c9fc-4986-a0da-ba0fb96fcdc6"
echo "window.__SKYWAY_KEY__ = '${skyway_apikey}';" > ./examples/key.js;

# Replace variable
# TODO: When remove 'Deploy ECL staging', You must change Domain Name from '.stage\.ecl\.skyway\.io' to '.webrtc\.ecl\.ntt\.com'
find examples -name index.html | xargs sed -i -e "s/\"\/\/cdn\.stage\.ecl\.skyway\.io\/skyway-latest\.js\"/\"${examples_sdk_url}\"/g"
find dist -name "*.js" | xargs sed -i -e "s/\.stage\.ecl\.skyway\.io/${base_domain}/g"

# Upload sdk to s3
sdk_version=`cat package.json | jq -r .version`
echo "Uploading sdk to s3";
for path in dist/*; do
    filename=$(basename $path);
    upload_to_s3 "./dist/${filename}" "$s3_dist_bucket" "${filename%%.*}-${sdk_version}.${filename#*.}";
    upload_to_s3 "./dist/${filename}" "$s3_dist_bucket" "${filename%%.*}-latest.${filename#*.}";
done

# Upload examples
echo "Uploading examples to s3";
upload_dir_to_s3 "./examples/*" "$s3_example_bucket"
