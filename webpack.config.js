const webpack = require('webpack');

const config = {
  mode: 'development',
  entry: {
    skyway: './src/peer.js',
  },
  output: {
    libraryTarget: 'umd',
    libraryExport: 'default',
    library: 'Peer',
    path: `${__dirname}/dist`,
    filename: '[name].js',
  },
  module: {
    rules: [
      // keep this place for karma
    ],
  },
  plugins: [
    new webpack.optimize.ModuleConcatenationPlugin(),
    new webpack.BannerPlugin(_getCopyRight()),
  ],
};

// from `npm run build`, exports both `.js`, `.min.js` and ignore source-map/eval
if (process.env.NODE_ENV === 'production') {
  const normalConf = Object.assign({}, config, {
    devtool: 'none',
  });
  const minConf = Object.assign({}, config, {
    mode: 'production',
    entry: { 'skyway.min': './src/peer.js' },
  });

  module.exports = [normalConf, minConf];
  // from `npm run dev` and `npm t`(= karma-webpack), exports dev config
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
