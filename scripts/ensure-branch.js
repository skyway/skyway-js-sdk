const Octokit = require('@octokit/rest');
const { CIRCLE_BRANCH, CIRCLE_PULL_REQUEST, GITHUB_TOKEN } = process.env;

(async function() {
  if (!CIRCLE_BRANCH) {
    throw new Error(
      'The build not associated with a pull request is not allowed!'
    );
  }

  // eg. https://github.com/skyway/skyway-js-sdk/pull/155
  const [, , , owner, repo, , number] = CIRCLE_PULL_REQUEST.split('/');

  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const { data: { base: ref } } = await octokit.pulls.get({
    owner,
    repo,
    number,
  });

  const fromBranch = CIRCLE_BRANCH;
  const toBranch = ref;

  console.log(`PR: ${fromBranch} => ${toBranch}`);

  switch (true) {
    case fromBranch === 'master' && toBranch === 'master':
    case fromBranch === 'staging' && toBranch === 'staging':
    case fromBranch === 'staging' && toBranch === 'master':
    case fromBranch.startsWith('dev/') && toBranch === 'staging':
    case fromBranch.startsWith('ops/') && toBranch === 'master':
      break;
    default:
      throw new Error('Invalid branch rules.');
  }

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
