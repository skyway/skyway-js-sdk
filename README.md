# SkyWayJS

[![Build Status](http://drone.webcore.ft.nttcloud.net/api/badges/SkyWay/SkyWay-Client/status.svg)](http://drone.webcore.ft.nttcloud.net/SkyWay/SkyWay-Client)

## Setting up

Use `npm install` to set up dependencies.

Use `gulp lint` to run eslint.

Use `gulp test` to run unit tests.

Use `gulp build` to build the library (babelify, browserify, uglify).

## For react-native (alpha)

Since there are several dependency mismatch between generic browser and react-native, you need to have slight change for this sdk.

Changes are as follows (super easy!).

```src/webrtcShim.js
// const RNWebRTC = {};  // for generic browser
const RNWebRTC = require('react-native-webrtc');   // for react-native
```

```src/socket.js
// const io           = require('socket.io-client');  // for generic browser
const io           = require('socket.io-client/socket.io');  // for react-native
```

Additionally, since this library uses [oney/react-native-webrtc](https://github.com/oney/react-native-webrtc), you need to setup Git Large File Storage on your development environment. For detail, please check [its installation section](https://github.com/oney/react-native-webrtc#installation). Please don't forget that you need to modify xcode or android studio setting (procedures are written in above installation section).

### API Key settings

You need to set domain name **signaling-bcb14672.skyway.io** in your [SkyWay API Key Settings](https://skyway.io/ds/).

note (Sept 1st, 2016) : Above setting will not work after a while. Because we need to set all signaling servers in dispatcher group.

## Contributing

Make sure you have nodejs installed. Run `npm install` to get started. After making changes in `src/`, you run `gulp test` to run tests and then the `gulp` command to validate and build peer.js!
