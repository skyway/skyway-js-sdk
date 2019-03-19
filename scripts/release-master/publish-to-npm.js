const execFile = require('util').promisify(require('child_process').execFile);
const exec = require('util').promisify(require('child_process').exec);
const { NPM_TOKEN } = process.env;

module.exports = async function publishToNpm() {
  console.log('Add npm token > .npmrc');
  await exec(`echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc`);
  console.log('');

  const { stderr, stdout } = await execFile('npm', [
    'publish',
    '--access public',
    '--tag latest',
  ]);
  console.log(stderr);
  console.log(stdout);
};
