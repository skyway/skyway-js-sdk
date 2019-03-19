const { execFile } = require('child_process');
const Octokit = require('@octokit/rest');
const { GITHUB_TOKEN } = process.env;

module.exports = async function isReleaseReady(version) {
  console.log(`Release for v${version} not exists on GitHub?`);
  const cond1 = await isNewGitHubRelease(version);
  if (!cond1) {
    console.log('=> No. abort release steps');
    console.log('');
    return false;
  }
  console.log('=> Yes. continue release steps');
  console.log('');

  console.log(`Release for ${version} not exists on npm?`);
  const cond2 = await isNewNpmRelease(version);
  if (!cond2) {
    console.log('=> No. abort release steps');
    console.log('');
    return false;
  }
  console.log('=> Yes. continue release steps');
  console.log('');

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
