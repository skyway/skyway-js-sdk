const fs = require('fs');
const { version } = require('../../package.json');

(async function isVersionCorrect() {
  console.log(`Script tag for v${version} exists in each example file?`);
  const cond1 = isAllExampleSdkVersionURLCorrect(version);
  if (!cond1) {
    console.log('=> Please check SDK version in each examples');
    console.log('');
    return false;
  }
  console.log('=> Yes. Continue checking');
  console.log('');

  console.log(`v${version} exists in README.md?`);
  const cond2 = isReadmeVersionURLCorrect(version);
  if (!cond2) {
    console.log('=> Please check SDK version in README.md');
    console.log('');
    return false;
  }
  console.log('=> Yes. Finished checking');
  console.log('');

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});

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
