const config = require('../config');
const fetchBaseBranch = require('./fetch-base-branch');

(async function() {
  const { CIRCLE_BRANCH, CIRCLE_PULL_REQUEST, GITHUB_TOKEN } = config();

  // eg. https://github.com/skyway/skyway-js-sdk/pull/155
  const prNo = CIRCLE_PULL_REQUEST.split('/').pop();

  const baseBranch = await fetchBaseBranch(prNo, { GITHUB_TOKEN });
  const currentBranch = CIRCLE_BRANCH;

  console.log(`This PR will be into ${baseBranch} from ${currentBranch}`);

  // The PR matches branch names combination below are only allowed to commit.
  // To commit directly(include merge commit of valid PR) is restricted by GitHub's branch protection.
  switch (true) {
    case baseBranch === 'master' && currentBranch === 'staging':
    case baseBranch === 'master' && currentBranch.startsWith('ops/'):
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
