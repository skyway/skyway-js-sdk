const readline = require('readline');
const fs = require('fs');

module.exports = async function isReleaseReady(version) {
  console.log(`Section for v${version} exists in CHANGELOG.md?`);
  const cond1 = await hasChangeLog(version);
  if (!cond1) {
    console.log('=> No. abort release steps');
    console.log('');
    return false;
  }
  console.log('=> Yes. continue release steps');
  console.log('');

  console.log(`Script tag for v${version} exists in each example file?`);
  const cond2 = isAllExampleSdkVersionURLCorrect(version);
  if (!cond2) {
    console.log('=> No. abort release steps');
    console.log('');
    return false;
  }
  console.log('=> Yes. continue release steps');
  console.log('');

  console.log(`v${version} exists in README.md?`);
  const cond3 = isReadmeVersionURLCorrect(version);
  if (!cond3) {
    console.log('=> No. abort release steps');
    console.log('');
    return false;
  }
  console.log('=> Yes. continue release steps');
  console.log('');

  return true;
};

async function hasChangeLog(version) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: fs.createReadStream('./CHANGELOG.md'),
      crlfDelay: Infinity,
    });

    rl.on('line', line => {
      const isVersionLine = line.startsWith('## ');
      const isVersionFound = line.includes(`v${version}`);

      if (isVersionLine && isVersionFound) {
        return resolve(true);
      }
    });

    rl.once('close', () => resolve(false));
  });
}

function isSdkVersionURLCorrect(version, filepath) {
  const data = fs.readFileSync(filepath, 'utf8');
  const matches = data.match(
    /cdn\.webrtc\.ecl\.ntt\.com\/skyway-([0-9]+\.[0-9]+\.[0-9]+)(\.min)?\.js/g
  );
  for (const match of matches) {
    if (!match.includes(version)) return false;
  }
  return true;
}

function isAllExampleSdkVersionURLCorrect(version) {
  const examplePaths = [
    './examples/p2p-data/index.html',
    './examples/p2p-media/index.html',
    './examples/room/index.html',
  ];
  for (const path of examplePaths) {
    if (!isSdkVersionURLCorrect(version, path)) return false;
  }
  return true;
}

function isReadmeVersionURLCorrect(version) {
  return isSdkVersionURLCorrect(version, './README.md');
}
