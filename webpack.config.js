const webpack = require('webpack');

const config = {
  entry:  './src/peer.js',
  output: {
    libraryTarget: 'umd',
    library:       'Peer',
    path:          `${__dirname}/dist`,
    filename:      'eclwebrtc.js',
  },
  module: {
    rules: [
      {
        test:    /.js$/,
        exclude: /node_modules/,
        use:     {
          loader: 'babel-loader',
        },
      },
    ],
  },
  plugins: [],
};

if (process.env.NODE_ENV === 'production') {
  config.plugins.push(new webpack.optimize.ModuleConcatenationPlugin());
}

module.exports = config;
