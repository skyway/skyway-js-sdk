const { version } = require('../../package.json');
const config = require('../config');
const replaceExamplesApiKey = require('../shared/replace-examples-api-key');
const uploadSdkToS3 = require('../shared/upload-sdk-to-s3');
const uploadExamplesToS3 = require('../shared/upload-examples-to-s3');
const isNewRelease = require('./is-new-release');
const isReleaseReady = require('./is-release-ready');
const publishToNpm = require('./publish-to-npm');
const publishToGitHub = require('./publish-to-github');
const notifySlack = require('./notify-slack');

(async function() {
  const {
    CIRCLE_BUILD_URL,
    API_KEY,
    GITHUB_TOKEN,
    NPM_TOKEN,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    S3_SDK_BUCKET,
    S3_EXAMPLES_BUCKET,
    NOTIFICATION_ENDOPOINT,
  } = config('master');

  console.log('# Release examples');
  console.log('## Replace API key');
  await replaceExamplesApiKey(API_KEY);
  console.log('');

  console.log('## Upload to S3:master');
  await uploadExamplesToS3(S3_EXAMPLES_BUCKET, {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
  });
  console.log('');

  console.log('# Release SDK');
  console.log(`## Check v${version} has not released yet`);
  const isNew = await isNewRelease(version, { GITHUB_TOKEN });
  if (!isNew) {
    console.log('## Notify to Slack');
    await notifySlack(
      `The branch \`master\` updated!\nExamples are released to S3, but SDK is not.\nSee <${CIRCLE_BUILD_URL}|detail>`,
      { NOTIFICATION_ENDOPOINT }
    );

    return process.exit(0);
  }

  console.log(`## Check v${version} is release ready`);
  const isReady = await isReleaseReady(version);
  if (!isReady) {
    console.log('## Notify to Slack');
    await notifySlack(
      `The branch \`master\` updated!\nExamples are released to S3, but SDK is not.\nSee <${CIRCLE_BUILD_URL}|detail>`,
      { NOTIFICATION_ENDOPOINT }
    );

    return process.exit(0);
  }

  console.log('## Publish to npm');
  await publishToNpm({ NPM_TOKEN });
  console.log('');

  console.log('## Publish to GitHub');
  await publishToGitHub(version, { GITHUB_TOKEN });
  console.log('');

  console.log('## Upload to S3:master');
  await uploadSdkToS3(S3_SDK_BUCKET, {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
  });
  console.log('');

  console.log('## Notify to Slack');
  await notifySlack(
    `The branch \`master\` updated!\nExamples and SDK are released to S3, SDK published to GitHub and npm.\nSee <${CIRCLE_BUILD_URL}|detail>`,
    { NOTIFICATION_ENDOPOINT }
  );
  console.log('');

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
