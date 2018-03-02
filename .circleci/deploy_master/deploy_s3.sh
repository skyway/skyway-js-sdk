#!/usr/bin/env bash
# Stop script if error occurs
set -e
set -o pipefail

# Import functions
source .circleci/common/upload_to_s3.sh;

s3_dist_bucket="s3://eclrtc-cdn-production/"
s3_example_bucket="s3://eclrtc-example-production"
examples_sdk_url="\/\/cdn.webrtc.ecl.ntt.com\/skyway-latest.js"
base_domain="\.webrtc\.ecl\.ntt\.com"

# Set API key for examples
skyway_apikey="5bea388b-3f95-4e1e-acb5-a34efdd0c480"
echo "window.__SKYWAY_KEY__ = '${skyway_apikey}';" > ./examples/key.js;

# Replace variable
find examples -name index.html | xargs sed -i -e "s/\"\/\/cdn\.webrtc\.ecl\.ntt\.com\/skyway-latest\.js\"/\"${examples_sdk_url}\"/g"
find dist -name "*.js" | xargs sed -i -e "s/\.webrtc\.ecl\.ntt\.com/${base_domain}/g"

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
