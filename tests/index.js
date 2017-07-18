// See https://github.com/webpack-contrib/karma-webpack#alternative-usage
const testsContext = require.context('.', true, /.js$/);
testsContext.keys().forEach(testsContext);
