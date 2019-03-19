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
