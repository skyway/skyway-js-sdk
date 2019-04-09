const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

module.exports = async function uploadSdkToS3(
  bucket,
  { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY }
) {
  const s3 = new AWS.S3({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  });

  const uploads = readdirRecurseSync('./examples')
    .filter(isContents)
    .map(filePath => {
      // eg. examples/_shared/key.js
      const paths = filePath.split('/');
      paths.shift();

      return {
        Key: paths.join('/'),
        Body: fs.readFileSync(`./${filePath}`),
        ContentType: getContentType(filePath),
      };
    });

  await Promise.all(
    uploads.map(upload => {
      const params = Object.assign(
        {
          Bucket: bucket,
        },
        upload
      );
      console.log(`Uploading s3://${params.Bucket}/${params.Key}`);
      return s3.upload(params).promise();
    })
  );
};

function readdirRecurseSync(dName) {
  let list = [];

  fs.readdirSync(dName).forEach(fName => {
    const filePath = path.join(dName, fName);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      list = list.concat(readdirRecurseSync(filePath));
    } else {
      list.push(filePath);
    }
  });

  return list;
}

function isContents(filePath) {
  return (
    filePath.endsWith('.html') ||
    filePath.endsWith('.css') ||
    filePath.endsWith('.js')
  );
}

function getContentType(filePath) {
  let cType = '';
  if (filePath.endsWith('.html')) {
    cType = 'text/html';
  }
  if (filePath.endsWith('.css')) {
    cType = 'text/css';
  }
  if (filePath.endsWith('.js')) {
    cType = 'application/javascript';
  }
  return cType;
}
