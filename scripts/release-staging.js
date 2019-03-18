const replaceExamplesApiKey = require('./shared/replace-examples-api-key');
const replaceExamplesCdnDomain = require('./shared/replace-examples-cdn-domain');
const replaceSdkServerDomain = require('./shared/replace-sdk-server-domain');
const uploadSdkToS3 = require('./shared/uploadSdkToS3');
const uploadExamplesToS3 = require('./shared/uploadExamplesToS3');

(async function() {
  const {
    staging: {
      API_KEY,
      CDN_DOMAIN,
      SERVER_DOMAIN,
      S3_SDK_BUCKET,
      S3_EXAMPLES_BUCKET,
    },
  } = require('./config');

  console.log('# Replace API key for examples');
  await replaceExamplesApiKey(API_KEY);
  console.log('');

  console.log('# Replace CDN domain for examples');
  await replaceExamplesCdnDomain(CDN_DOMAIN);
  console.log('');

  console.log('# Replace server domain for sdk');
  await replaceSdkServerDomain(SERVER_DOMAIN);
  console.log('');

  console.log('# Upload SDK to S3:staging');
  await uploadSdkToS3(S3_SDK_BUCKET);
  console.log('');

  console.log('# Upload examples to S3:staging');
  await uploadExamplesToS3(S3_EXAMPLES_BUCKET);
  console.log('');

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
