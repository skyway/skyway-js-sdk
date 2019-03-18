const Octokit = require('@octokit/rest');

(async function() {
  const octokit = new Octokit();
  console.log(process.env);
  console.log(octokit);

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
