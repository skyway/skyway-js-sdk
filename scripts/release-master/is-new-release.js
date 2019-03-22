const execFile = require('util').promisify(require('child_process').execFile);
const Octokit = require('@octokit/rest');

module.exports = async function isReleaseReady(version, { GITHUB_TOKEN }) {
  console.log(`Release for v${version} not exists on GitHub?`);
  const cond1 = await isNewGitHubRelease(version, { GITHUB_TOKEN });
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

async function isNewGitHubRelease(version, { GITHUB_TOKEN }) {
  const octokit = new Octokit({ auth: `token ${GITHUB_TOKEN}` });

  let isNewRelease = false;

  try {
    await octokit.repos.getReleaseByTag({
      owner: 'skyway',
      repo: 'skyway-js-sdk',
      tag: `v${version}`,
    });
  } catch (err) {
    // reject means not yet released
    if (err.status === 404) {
      isNewRelease = true;
    }
  }

  return isNewRelease;
}

async function isNewNpmRelease(version) {
  const { stdout } = await execFile('npm', [
    'view',
    'skyway-js',
    'versions',
    '--json',
  ]);
  const isNewRelease = JSON.parse(stdout).includes(version) === false;
  return isNewRelease;
}
