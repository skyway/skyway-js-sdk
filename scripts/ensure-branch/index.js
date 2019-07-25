const config = require('../config');
const fetchBaseBranch = require('./fetch-base-branch');

/**
 * We have to take care of these patterns of commit.
 * - 1. commit on some PR
 * - 2. others
 *   - 2.1. merge commit of that PR
 *   - 2.2. commit directly on some branch
 *     - restricted by GitHub's branch protection
 */
(async function() {
  const { CIRCLE_BRANCH, CIRCLE_PULL_REQUEST, GITHUB_TOKEN } = config();

  console.log(`CIRCLE_BRANCH: ${CIRCLE_BRANCH}`);
  console.log(`CIRCLE_PULL_REQUEST: ${CIRCLE_PULL_REQUEST}`);
  console.log('');

  // if pattern 2.
  if (!CIRCLE_PULL_REQUEST) {
    if (CIRCLE_BRANCH === 'master' || CIRCLE_BRANCH === 'staging') {
      // 2.1. is OK
      console.log(
        `This commit may be a merge commit for branch ${CIRCLE_BRANCH}.`
      );
      return process.exit(0);
    } else {
      // 2.2. is NG
      throw new Error(
        'This commit is not associated with PR! We should enable branch protection on GitHub.'
      );
    }
  }

  // else pattern 1.
  // eg. https://github.com/skyway/skyway-js-sdk/pull/155
  const prNo = CIRCLE_PULL_REQUEST.split('/').pop();

  const baseBranch = await fetchBaseBranch(prNo, { GITHUB_TOKEN });
  const currentBranch = CIRCLE_BRANCH;

  console.log(`This PR will be into ${baseBranch} from ${currentBranch}`);

  // The PR matches branch names combination below are only allowed to commit.
  // To commit directly is restricted by GitHub's branch protection.
  switch (true) {
    case baseBranch === 'master' && currentBranch === 'staging':
    case baseBranch === 'staging' && currentBranch.startsWith('ops/'):
    case baseBranch === 'staging' && currentBranch.startsWith('dev/'):
    case baseBranch === 'staging' && currentBranch.startsWith('dependabot/'):
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
