const Octokit = require('@octokit/rest');
const { CIRCLE_BRANCH, CIRCLE_PULL_REQUEST, GITHUB_TOKEN } = process.env;

(async function() {
  if (!CIRCLE_BRANCH) {
    throw new Error(
      'The build not associated with a pull request is not allowed!'
    );
  }

  // eg. https://github.com/skyway/skyway-js-sdk/pull/155
  const number = CIRCLE_PULL_REQUEST.split('/').pop();

  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const { data: { base: { ref } } } = await octokit.pulls.get({
    owner: 'skyway',
    repo: 'skyway-js-sdk',
    number,
  });

  const baseBranch = ref;
  const currentBranch = CIRCLE_BRANCH;

  console.log(`This PR will be into ${baseBranch} from ${currentBranch}`);

  switch (true) {
    case baseBranch === 'master' && currentBranch === 'master':
    case baseBranch === 'master' && currentBranch === 'staging':
    case baseBranch === 'master' && currentBranch.startsWith('ops/'):
    case baseBranch === 'staging' && currentBranch === 'staging':
    case baseBranch === 'staging' && currentBranch.startsWith('dev/'):
      console.log('Branch names are valid ;D');
      break;
    default:
      throw new Error('The name of current branch is not allowed to merge!');
  }

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
