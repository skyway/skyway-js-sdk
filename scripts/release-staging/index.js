const config = require('../config');
const replaceExamplesApiKey = require('../shared/replace-examples-api-key');
const replaceExamplesCdnDomain = require('../shared/replace-examples-cdn-domain');
const replaceSdkServerDomain = require('../shared/replace-sdk-server-domain');
const uploadSdkToS3 = require('../shared/upload-sdk-to-s3');
const uploadExamplesToS3 = require('../shared/upload-examples-to-s3');

(async function() {
  const {
    API_KEY,
    CDN_DOMAIN,
    SERVER_DOMAIN,
    S3_SDK_BUCKET,
    S3_EXAMPLES_BUCKET,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
  } = config('staging');

  console.log('# Release examples');
  console.log('## Replace API key');
  await replaceExamplesApiKey(API_KEY);
  console.log('');

  console.log('## Replace CDN domain');
  await replaceExamplesCdnDomain(CDN_DOMAIN);
  console.log('');

  console.log('## Upload to S3:staging');
  await uploadExamplesToS3(S3_EXAMPLES_BUCKET, {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
  });
  console.log('');

  console.log('# Release SDK');
  console.log('## Replace server domain');
  await replaceSdkServerDomain(SERVER_DOMAIN);
  console.log('');

  console.log('## Upload to S3:staging');
  await uploadSdkToS3(S3_SDK_BUCKET, {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
  });
  console.log('');

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
