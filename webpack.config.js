const webpack = require('webpack');

// base
const config = {
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

// from `npm run build, exports both `.js`, `.min.js`
if (process.env.NODE_ENV === 'production') {
  const minConf = Object.assign({}, config, {
    entry: { 'skyway.min': './src/peer.js' },
    plugins: [...config.plugins.slice(), new webpack.optimize.UglifyJsPlugin()],
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
