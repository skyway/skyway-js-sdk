const fs = require('fs');
const AWS = require('aws-sdk');
const { version } = require('../../package.json');

module.exports = async function uploadSdkToS3(
  bucket,
  { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY }
) {
  const s3 = new AWS.S3({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  });

  const sdkDev = fs.readFileSync('./dist/skyway.js');
  const sdkMin = fs.readFileSync('./dist/skyway.min.js');

  const uploads = [
    { Key: `skyway-${version}.js`, Body: sdkDev },
    { Key: `skyway-${version}.min.js`, Body: sdkMin },
    { Key: `skyway-latest.js`, Body: sdkDev },
    { Key: `skyway-latest.min.js`, Body: sdkMin },
  ];

  await Promise.all(
    uploads.map(upload => {
      const params = Object.assign(
        {
          Bucket: bucket,
          ContentType: 'application/javascript',
        },
        upload
      );
      console.log(`Uploading s3://${params.Bucket}/${params.Key}`);
      return s3.upload(params).promise();
    })
  );
};
