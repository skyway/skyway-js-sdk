const Octokit = require('@octokit/rest');
const { GITHUB_TOKEN } = process.env;

module.exports = async function fetchBaseBranch(number) {
  const octokit = new Octokit({ auth: `token ${GITHUB_TOKEN}` });

  const { data: { base: { ref } } } = await octokit.pulls.get({
    owner: 'skyway',
    repo: 'skyway-js-sdk',
    number,
  });

  return ref;
};
