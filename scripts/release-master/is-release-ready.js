const { execFile } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const Octokit = require('@octokit/rest');
const { GITHUB_TOKEN } = process.env;

module.exports = async function isReleaseReady(version) {
  const cond1 = await isNewGitHubRelease(version);
  if (!cond1) {
    console.log(`GitHub release for v${version} has already exist!`);
    return false;
  }

  const cond2 = await isNewNpmRelease(version);
  if (!cond2) {
    console.log(`NPM release for ${version} has already exist!`);
    return false;
  }

  const cond3 = await hasChangeLog(version);
  if (!cond3) {
    console.log(`Section for ${version} not found in CHANGELOG.md!`);
    return false;
  }

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

async function hasChangeLog(version) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: fs.createReadStream('./CHANGELOG.md'),
      crlfDelay: Infinity,
    });

    rl.on('line', line => {
      const isVersionLine = line.startsWith('##');
      const isVersionFound = line.includes(`v${version}`);

      if (isVersionLine && isVersionFound) {
        return resolve(true);
      }
    });

    rl.once('close', () => resolve(false));
  });
}
