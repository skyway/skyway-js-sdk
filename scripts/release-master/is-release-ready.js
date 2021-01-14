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
  const cond2 = await isCorrectAllExampleSdkVersion(version);
  if (!cond2) {
    console.log('=> No. abort release steps');
    console.log('');
    return false;
  }
  console.log('=> Yes. continue release steps');
  console.log('');

  console.log(`v${version} exists in README.md?`);
  const cond3 = await isCorrectReadmeVersion(version);
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

async function checkExampleSdkVersion(version, file) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: fs.createReadStream(file),
      crlfDelay: Infinity,
    });

    rl.on('line', line => {
      const isVersionFound = line.includes(
        `cdn.webrtc.ecl.ntt.com/skyway-${version}.js`
      );
      if (isVersionFound) {
        return resolve(true);
      }
    });

    rl.once('close', () => {
      return resolve(false);
    });
  });
}

async function isCorrectAllExampleSdkVersion(version) {
  const examplePaths = [
    './examples/p2p-data/index.html',
    './examples/p2p-media/index.html',
    './examples/room/index.html',
  ];
  for (const path of examplePaths) {
    const isCorrectVersion = await checkExampleSdkVersion(version, path);
    if (!isCorrectVersion) return false;
  }
  return true;
}

async function isCorrectReadmeVersion(version) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: fs.createReadStream('./README.md'),
      crlfDelay: Infinity,
    });

    let numVersionFound = 0;
    rl.on('line', line => {
      const isVersionFound = line.includes(
        `cdn.webrtc.ecl.ntt.com/skyway-${version}.js`
      );
      if (isVersionFound) numVersionFound++;
      const isMinVersionFound = line.includes(`skyway-${version}.min.js`);

      if (numVersionFound > 0 && isMinVersionFound) {
        return resolve(true);
      }
    });

    rl.once('close', () => resolve(false));
  });
}
