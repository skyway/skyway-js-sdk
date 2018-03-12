#!/usr/bin/env bash

echo "Working branch is ${CIRCLE_BRANCH}"

CIRCLE_PR_NUMBER=${CIRCLE_PULL_REQUEST##*/}
echo "PR number is ${CIRCLE_PR_NUMBER}"

# Make sure that PRs to master are only from the staging branch.
if [[ -n ${CIRCLE_PR_NUMBER} ]]
then
    url="https://api.github.com/repos/$CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME/pulls/$CIRCLE_PR_NUMBER";
    target_branch=$(
      curl -s -H "Authorization: token $GITHUB_TOKEN" "$url" | jq '.base.ref' | tr -d '"'
    )

    echo "target branch is $target_branch"
    if [[ "$target_branch" = "master" && "$CIRCLE_BRANCH" != "staging" ]]
    then
        echo "You may only submit a PR to master from staging. Merge once to staging then create another PR.";
        exit 1;
    fi
else
    echo "This build isn't associated with a pull request. Set the 'Only build pull requests' setting on circle ci and rebuild.";
    exit 1;
fi
