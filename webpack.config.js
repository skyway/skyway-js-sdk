const webpack = require('webpack');

const config = {
  mode: 'development',
  entry: {
    skyway: ['babel-polyfill', './src/peer.js'],
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
      {
        test: /.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
  plugins: [
    new webpack.optimize.ModuleConcatenationPlugin(),
    new webpack.BannerPlugin(_getCopyRight()),
  ],
};

// from `npm run build`, exports both `.js`, `.min.js`
if (process.env.NODE_ENV === 'production') {
  const minConf = Object.assign({}, config, {
    mode: 'production',
    entry: { 'skyway.min': './src/peer.js' },
  });

  module.exports = [config, minConf];
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
