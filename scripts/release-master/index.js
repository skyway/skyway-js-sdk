const { version } = require('../../package.json');
const replaceExamplesApiKey = require('../shared/replace-examples-api-key');
const uploadSdkToS3 = require('../shared/uploadSdkToS3');
const uploadExamplesToS3 = require('../shared/uploadExamplesToS3');
const isReleaseReady = require('./is-release-ready');
const publishToNpm = require('./publish-to-npm');
const publishToGitHub = require('./publish-to-github');
const notifySlack = require('./notify-slack');

(async function() {
  const {
    master: { API_KEY, S3_SDK_BUCKET, S3_EXAMPLES_BUCKET },
  } = require('../config');

  console.log('# Release examples');
  console.log('## Replace API key');
  await replaceExamplesApiKey(API_KEY);
  console.log('');

  console.log('## Upload to S3:master');
  await uploadExamplesToS3(S3_EXAMPLES_BUCKET);
  console.log('');

  console.log('# Release SDK');
  const isReady = await isReleaseReady(version);
  console.log(`Is release ready for v${version} ? ${isReady}`);

  if (!isReady) {
    console.log('## Notify to Slack');
    await notifySlack('TOOD: master updated');
    console.log('');

    return process.exit(0);
  }

  console.log('## Publish to npm');
  await publishToNpm();
  console.log('');

  console.log('## Publish to GitHub');
  await publishToGitHub();
  console.log('');

  console.log('## Upload to S3:master');
  await uploadSdkToS3(S3_SDK_BUCKET);
  console.log('');

  console.log('## Notify to Slack');
  await notifySlack('TOOD: master updated');
  console.log('');

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
