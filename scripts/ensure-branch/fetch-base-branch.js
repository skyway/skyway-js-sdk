const Octokit = require('@octokit/rest');

module.exports = async function fetchBaseBranch(prNumber, { GITHUB_TOKEN }) {
  const octokit = new Octokit({ auth: `token ${GITHUB_TOKEN}` });

  const {
    data: {
      base: { ref },
    },
  } = await octokit.pulls.get({
    owner: 'skyway',
    repo: 'skyway-js-sdk',
    pull_number: prNumber,
  });

  return ref;
};
