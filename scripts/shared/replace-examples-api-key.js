const replace = require('replace-in-file');

module.exports = async function replaceExamplesApiKey(apiKey) {
  const changes = await replace({
    files: './examples/_shared/key.js',
    from: '<YOUR_KEY_HERE>',
    to: apiKey,
  });

  if (changes.length) {
    console.log('Modified', changes.join(', '));
  } else {
    throw new Error('No files were modified!');
  }
};
