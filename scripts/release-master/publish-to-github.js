const readline = require('readline');
const fs = require('fs');
const Octokit = require('@octokit/rest');

module.exports = async function publishToGitHub(version, { GITHUB_TOKEN }) {
  const octokit = new Octokit({ auth: `token ${GITHUB_TOKEN}` });

  console.log('Extract section from CHANGELOG.md');
  const changeLog = await getChangeLogSection(version);
  const body = [
    '```',
    `https://cdn.webrtc.ecl.ntt.com/skyway-${version}.js`,
    '```',
    ...changeLog,
  ].join('\n');
  console.log('');

  console.log('Create new release');
  const {
    data: { upload_url },
  } = await octokit.repos.createRelease({
    owner: 'skyway',
    repo: 'skyway-js-sdk',
    tag_name: `v${version}`,
    target_commitish: 'master',
    name: `v${version}`,
    body,
  });
  console.log('');

  console.log('Upload release assets');
  const sdkDev = fs.readFileSync('./dist/skyway.js');
  const sdkMin = fs.readFileSync('./dist/skyway.min.js');

  await Promise.all([
    octokit.repos.uploadReleaseAsset({
      headers: {
        'content-length': sdkDev.length,
        'content-type': 'application/javascript',
      },
      url: upload_url,
      name: 'skyway.js',
      file: sdkDev,
    }),
    octokit.repos.uploadReleaseAsset({
      headers: {
        'content-length': sdkMin.length,
        'content-type': 'application/javascript',
      },
      url: upload_url,
      name: 'skyway.min.js',
      file: sdkMin,
    }),
  ]);
};

function getChangeLogSection(version) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: fs.createReadStream('./CHANGELOG.md'),
      crlfDelay: Infinity,
    });

    const lines = [];
    let isTargetStart = false;
    let isTargetEnd = false;
    rl.on('line', line => {
      // This logic depends on writing format of CHANGELOG.md
      // version line must be started with `## ` and described as `v1.0.0`
      const isVersionLine = line.startsWith('## ');
      const isVersionFound = line.includes(`v${version}`);

      if (isTargetEnd) {
        // 4. next section found, quit
        resolve(lines);
      } else if (isTargetStart === false) {
        // 1. target section found
        isTargetStart = isVersionLine && isVersionFound;
        // just set start flag
      } else {
        // 2. check end flag
        isTargetEnd = isVersionLine && !isVersionFound;

        // 3. slice while start and not end
        if (isTargetStart && !isTargetEnd) {
          lines.push(line);
        }
      }
    });

    rl.once('close', () => resolve(lines));
  });
}
