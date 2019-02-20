# SkyWay JavaScript SDK

## Using the SDK

### Including the sdk from the CDN in your html

Add the following script tag to your html file.

```html
<script type="text/javascript" src="https://cdn.webrtc.ecl.ntt.com/skyway-latest.js"></script>
```

You can then use the `Peer` object to start connecting.
For more details, check out the [Tutorial](https://webrtc.ecl.ntt.com/en/js-tutorial.html). ([日本語](https://webrtc.ecl.ntt.com/js-tutorial.html))

### Installing using npm to use with a bundler (e.g. webpack or browserify)

With [npm](https://npmjs.org/) installed, run

    $ npm install -s skyway-js

You can then use `require` or `import` to import the package.

```js
// require
const Peer = require('skyway-js');
const peer = new Peer({key: 'your-api-key'});

// import
import Peer from 'skyway-js';
const peer = new Peer({key: 'your-api-key'});
```

## Docs

- [API reference](https://webrtc.ecl.ntt.com/en/js-reference/)([日本語](https://webrtc.ecl.ntt.com/js-reference/))
- [Tutorial](https://webrtc.ecl.ntt.com/en/js-tutorial.html)([日本語](https://webrtc.ecl.ntt.com/js-tutorial.html))
- [Sample Code](https://github.com/skyway/skyway-js-sdk/tree/master/examples/)

## Examples

You can use `/examples` directory for checking your development code.

Follow these steps.

- Modify your key
  - e.g.) `sed -i -e "s/<YOUR_KEY_HERE>/12341234-abcd-1234-abcd-1234567890ab/g" examples/_shared/key.js`
  - The key can be obtained from https://webrtc.ecl.ntt.com/en/ .
- Start server on project root
  - e.g.) `python -m SimpleHTTPServer 8000`

## Contributing

### Setting up

Make sure you have nodejs installed. Run `npm install` to get started and to set up dependencies.

```sh
# run eslint
npm run lint

# run all unit tests
npm run test # OR npm test OR npm t

# build the library
npm run build
```

After making changes in `src/`, you run

- `npm run lint` to validate
- `npm test` to run tests

then the `npm run build` and build `skyway(.min).js` which is stored in `dist` directory!

### Bug Reports
* check if you can reproduce in the latest version
* check the [FAQ](https://support.skyway.io/hc/en-us/categories/204565748-FAQ) and the [forum](https://support.skyway.io/hc/en-us/community/topics) to make sure the same issue has not already been reported.
* create an issue by filling in the template.

### Feature requests, proposals
* We welcome suggestions on the [developer community forums](https://support.skyway.io/hc/en-us/community/topics)
* GitHub issues are primarily intended for bug reports/fixes

### Pull Requests
* We do our best to process them quickly but please be understanding if we take a while to respond.
* Steps
    * make changes on your fork.
    * include clear descriptions and references to all the issues by filling the template.
    * submit tests for your changes.
    * update docs when creating or changing features.
    * make sure the test suite & lint passes.

```
npm run lint
npm run test
```

* Branch
    * send all pull requests (bug fixes, new features) to the master branch.
    * maintainers will change it to an appropriate branch.

### Templates
#### Issue
```
## Description of the problem

## Environment
- SDK version (ex. SDK v1.0.1,etc)
- Device (ex. Windows PC, Nexus6, etc)
- OS (ex. Windows XX / Android 7.0 etc)
- Network (Cable/DSL/Fiber + WiFi, MiFi, LTE, etc)

## Steps to reproduce the problem

## Expected behavior

## Other information (Console log etc)

```
#### PR
```
## Description of the Change

## Benefits

## Possible side effects

## Relevant Issues

```
