const webpack = require('webpack');

// base
const config = {
  mode: 'development',
  entry: {
    skyway: './src/peer.js',
  },
  output: {
    libraryTarget: 'umd',
    library: 'Peer',
    path: `${__dirname}/dist`,
    filename: '[name].js',
  },
  module: {
    rules: [
      // keep this for karma
    ],
  },
  plugins: [
    new webpack.optimize.ModuleConcatenationPlugin(),
    new webpack.BannerPlugin(_getCopyRight()),
  ],
};

// from `npm run build, exports both `.js`, `.min.js`
if (process.env.NODE_ENV === 'production') {
  const minConf = Object.assign({}, config, {
    mode: 'production',
    entry: { 'skyway.min': './src/peer.js' },
  });

  module.exports = [config, minConf];
  // from karma, exports only not minified
} else {
  module.exports = config;
}

// eslint-disable-next-line
function _getCopyRight() {
  const currentYear = new Date().getFullYear();
  return `
SkyWay Copyright(c) ${currentYear} NTT Communications Corporation
peerjs Copyright(c) 2013 Michelle Bu <michelle@michellebu.com>
  `.trim();
}
