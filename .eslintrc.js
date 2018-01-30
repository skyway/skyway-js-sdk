module.exports = {
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module',
  },
  plugins: ['prettier'],
  extends: ['eslint:recommended', 'prettier'],
  rules: {
    // prettier
    'prettier/prettier': [
      'error',
      {
        trailingComma: 'es5',
        singleQuote: true,
      },
    ],
    // rules
    'no-console': 'off',
    'no-unused-vars': 'error',
    'no-multiple-empty-lines': ['error', { max: 1 }],
    'no-var': 'error',
    'prefer-const': 'error',
  },
  env: {
    browser: true,
    node: true,
    es6: true,
    mocha: true,
  },
  globals: {
    RTCRtpSender: true,
  },
};
