const isReleaseReady = require('./is-release-ready');
const replaceExamplesApiKey = require('../shared/replace-examples-api-key');
const uploadSdkToS3 = require('../shared/uploadSdkToS3');
const uploadExamplesToS3 = require('../shared/uploadExamplesToS3');

(async function() {
  const {
    master: { API_KEY, S3_SDK_BUCKET, S3_EXAMPLES_BUCKET },
  } = require('../config');

  if (isReleaseReady()) {
    return;
  }

  console.log('# Replace API key for examples');
  await replaceExamplesApiKey(API_KEY);
  console.log('');

  console.log('# Upload SDK to S3:master');
  await uploadSdkToS3(S3_SDK_BUCKET);
  console.log('');

  console.log('# Upload examples to S3:master');
  await uploadExamplesToS3(S3_EXAMPLES_BUCKET);
  console.log('');

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
