const replace = require('replace-in-file');

module.exports = async function replaceSdkServerDomain(domain) {
  const changes = await replace({
    files: './dist/*.js',
    from: /webrtc\.ecl\.ntt\.com/g,
    to: domain,
  });

  if (changes.length) {
    console.log('Modified', changes.join(', '));
  } else {
    throw new Error('No files were modified!');
  }
};
