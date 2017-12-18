module.exports = {
  source: {
    include: ['./README.md', './src'],
  },
  templates: {
    default: {
      outputSourceFiles: false,
    },
  },
  opts: {
    destination: './docs',
    recurse: true,
  },
};
