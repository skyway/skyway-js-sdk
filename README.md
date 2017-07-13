# SkyWayJS

## Setting up

Use `npm install` to set up dependencies.

Use `gulp lint` to run eslint.

Use `gulp test` to run unit tests.

> You can specify files to test by `gulp test --tests=peer.js`, `gulp test --tests=shared/logger.js --tests=shared/util.js`.

Use `gulp build` to build the library (babelify, browserify, uglify).

## Contributing

Make sure you have nodejs installed. Run `npm install` to get started. After making changes in `src/`, you run `gulp test` to run tests and then the `gulp` command to validate(gulp lint) and build skyway.js which is stored in `dist` directory!
