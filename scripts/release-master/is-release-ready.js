const { execFile } = require('child_process');
const Octokit = require('@octokit/rest');
const { version } = require('../../package.json');
const { GITHUB_TOKEN } = process.env;

module.exports = async function isReleaseReady() {
  const cond1 = await isNewGitHubRelease(version);
  const cond2 = await isNewNpmRelease(version);
  console.log(cond1);
  console.log(cond2);

  return true;
};

async function isNewGitHubRelease(version) {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  let isNewRelease = false;
  try {
    await octokit.repos.getReleaseByTag({
      owner: 'skyway',
      repo: 'skyway-js-sdk',
      tag: `v${version}`,
    });
  } catch (err) {
    if (err.status === 404) {
      isNewRelease = true;
    }
  }

  return isNewRelease;
}

async function isNewNpmRelease(version) {
  return new Promise((resolve, reject) => {
    execFile(
      'npm',
      ['view', 'skyway-js', 'versions', '--json'],
      (err, stdout, stderr) => {
        if (err || stderr) {
          return reject(err || stderr);
        }

        const isNewRelease = JSON.parse(stdout).includes(version) === false;
        resolve(isNewRelease);
      }
    );
  });
}
