module.exports = function(env = 'staging') {
  const config = {
    staging: {
      API_KEY: '32466e1c-c9fc-4986-a0da-ba0fb96fcdc6',
      SERVER_DOMAIN: 'stage.gcp.skyway.io',
      CDN_DOMAIN: 'cdn.stage.gcp.skyway.io',
      S3_SDK_BUCKET: 'eclrtc-cdn-gcp-staging',
      S3_EXAMPLES_BUCKET: 'eclrtc-example-gcp-staging',
    },
    master: {
      API_KEY: '5bea388b-3f95-4e1e-acb5-a34efdd0c480',
      // do not need to replace(= default is master)
      SERVER_DOMAIN: '',
      CDN_DOMAIN: '',
      S3_SDK_BUCKET: 'eclrtc-cdn-production',
      S3_EXAMPLES_BUCKET: 'eclrtc-example-production',
    },
  }[env];

  return Object.assign(
    config,
    process.env,
    // debug zone
    {
      // CIRCLE_BRANCH: '',
      // CIRCLE_PULL_REQUEST: '',
      // CIRCLE_BUILD_URL: '',
      // AWS_ACCESS_KEY_ID: '',
      // AWS_SECRET_ACCESS_KEY: '',
      // NPM_TOKEN: '',
      // GITHUB_TOKEN: '',
      // NOTIFICATION_ENDOPOINT: '',
    }
  );
};
