const { execFile } = require('child_process');
const { NPM_TOKEN } = process.env;

module.exports = async function publishToNpm() {
  // TODO:
  NPM_TOKEN;
  return new Promise((resolve, reject) => {
    execFile(
      'npm',
      ['publish', '--access public', '--tag latest'],
      (err, stdout, stderr) => {
        if (err || stderr) {
          return reject(err || stderr);
        }

        resolve(stdout);
      }
    );
  });
};
