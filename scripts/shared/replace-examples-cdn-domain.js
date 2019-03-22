const replace = require('replace-in-file');

module.exports = async function replaceExamplesCdnDomain(domain) {
  const changes = await replace({
    files: './examples/**/*.html',
    from: 'cdn.webrtc.ecl.ntt.com',
    to: domain,
  });

  if (changes.length) {
    console.log('Modified', changes.join(', '));
  } else {
    throw new Error('No files were modified!');
  }
};
