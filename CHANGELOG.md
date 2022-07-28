# Changelog

## release note

## [v4.4.5](https://github.com/skyway/skyway-js-sdk/releases/tag/v4.4.5) - 2022-07-28

### Fixed

- Fixed a problem that could cause `TypeError: Cannot read properties of null (reading 'addIceCandidate')` error if the `close` method of `MediaConnection` was called before the  connection was established. ([#336](https://github.com/skyway/skyway-js-sdk/pull/336))

## [v4.4.4](https://github.com/skyway/skyway-js-sdk/releases/tag/v4.4.4) - 2022-03-17

### Fixed

- Updated to close connections when peer left from MeshRoom. ([#333](https://github.com/skyway/skyway-js-sdk/pull/333))

## [v4.4.3](https://github.com/skyway/skyway-js-sdk/releases/tag/v4.4.3) - 2021-11-10

### Updated

- Updated type definition file. ([#330](https://github.com/skyway/skyway-js-sdk/pull/330))
  - Added `PeerError` interface.
  - Updated `Peer.joinRoom()` definition.

## [v4.4.2](https://github.com/skyway/skyway-js-sdk/releases/tag/v4.4.2) - 2021-10-22

### Fixed

- Updated to use only XHR if Safari 15 or over, due to a bug in Safari 15. ([#318](https://github.com/skyway/skyway-js-sdk/pull/318))

## [v4.4.1](https://github.com/skyway/skyway-js-sdk/releases/tag/v4.4.1) - 2021-03-29

### Fixed

- Add Peer.fetchPeerExists() to type definition file. ([#314](https://github.com/skyway/skyway-js-sdk/pull/314))

## [v4.4.0](https://github.com/skyway/skyway-js-sdk/releases/tag/v4.4.0) - 2021-02-15

### Deprecated

- Deprecated `Peer.reconnect()`. Recreate peer instance instead. ([#308](https://github.com/skyway/skyway-js-sdk/pull/308))
- Deprecated `Peer.disconnect()`. Use peer's destroy method instead.
- Deprecated `disconnected` event on `Peer`. Use peer's close event instead.

## [v4.3.0](https://github.com/skyway/skyway-js-sdk/releases/tag/v4.3.0) - 2021-01-19

### Fixed

- Fixed a connecting process to signaling server so that `Peer` would reconnect when a request to the dispatcher server failed. ([#297](https://github.com/skyway/skyway-js-sdk/pull/297))
- Remove unnecessary module settings in package.json.

## [v4.2.0](https://github.com/skyway/skyway-js-sdk/releases/tag/v4.2.0) - 2020-12-22

### Added

- Added `fetchPeerExists` API to fetch whether a peer exists. You can call this API once per second per peer. ([#288](https://github.com/skyway/skyway-js-sdk/pull/288))

## [v4.1.1](https://github.com/skyway/skyway-js-sdk/releases/tag/v4.1.1) - 2020-12-08

### Fixed

- Add MeshRoom.getPeerConnections() and SfuRoom.getPeerConnection() to type definition file.

## [v4.1.0](https://github.com/skyway/skyway-js-sdk/releases/tag/v4.1.0) - 2020-12-07

### Added

- Added APIs to get RTCPeerConnections used in SFU room and Mesh room. ([#279](https://github.com/skyway/skyway-js-sdk/pull/279))

### Fixed

- Fixed a problem that `npm install` fails on node v15.1.0 or later. ([#278](https://github.com/skyway/skyway-js-sdk/pull/278))
- Fixed a bug that it occurs RTCError on closing DataConnection. ([#277](https://github.com/skyway/skyway-js-sdk/pull/277))

## [v4.0.0](https://github.com/skyway/skyway-js-sdk/releases/tag/v4.0.0) - 2020-11-09

### Breaking Changes

- Fixed UMD exports and changed to use `globalThis` object instead of `window` object. ([#268](https://github.com/skyway/skyway-js-sdk/pull/268))

### Fixed

- Fixed a bug that caused the Chrome browser to crash when multiple people joined the SFU Room at the same time. ([#272](https://github.com/skyway/skyway-js-sdk/pull/272))
- Fixed a bug that prevented some Peer communication from being established when multiple people joined the SFU Room at the same time. ([#272](https://github.com/skyway/skyway-js-sdk/pull/272))
- Fixed a problem in which unnecessary warnings were displayed by events such as iceConnectionFailed. ([#267](https://github.com/skyway/skyway-js-sdk/pull/267))
- Updated the package to remove the warning when installing skyway-js from npm.([#266](https://github.com/skyway/skyway-js-sdk/pull/266))

## [v3.1.0](https://github.com/skyway/skyway-js-sdk/releases/tag/v3.1.0) - 2020-10-13

### Deprecated

- Deprecated `false` value of `forceClose` parameter for `MediaConnection.close()` and `DataConnection.close()`. ([#261](https://github.com/skyway/skyway-js-sdk/pull/261))

## [v3.0.2](https://github.com/skyway/skyway-js-sdk/releases/tag/v3.0.2) - 2020-07-02

### Fixed

- Fixed type definitions of meshroom connections type. ([#250](https://github.com/skyway/skyway-js-sdk/pull/250))

## [v3.0.1](https://github.com/skyway/skyway-js-sdk/releases/tag/v3.0.1) - 2020-06-02

### Fixed

- Fixed the bug that `room.send` does not work after the second time. ([#241](https://github.com/skyway/skyway-js-sdk/pull/241))

## [v3.0.0](https://github.com/skyway/skyway-js-sdk/releases/tag/v3.0.0) - 2020-05-26

### Breaking Changes

- Limit interval to send by using SFU/MeshRoom.send() ([#237](https://github.com/skyway/skyway-js-sdk/pull/237))
  - The frequent of consecutive send is limited to once every 100 msec.
  - Outgoing data that exceeds the sending frequency limit is queued and sent sequentially every 100 msec.
- Limit the size of data to send by using SFU/MeshRoom.send()（[#233](https://github.com/skyway/skyway-js-sdk/pull/233))
  - The maximum size of the data to be sent is 20MB.

### Fixed

- Fix the timing issue about mesh room ([#232](https://github.com/skyway/skyway-js-sdk/pull/232))

## [v2.0.5](https://github.com/skyway/skyway-js-sdk/releases/tag/v2.0.5) - 2020-01-08

### Fixed

- Fixed the license for npm to Apache-2.0 ([#226](https://github.com/skyway/skyway-js-sdk/pull/226))

## [v2.0.4](https://github.com/skyway/skyway-js-sdk/releases/tag/v2.0.4) - 2019-12-03

### Fixed

- Fixed the bug that peers already in the room were not included in `SFURoom.members`. ([#221](https://github.com/skyway/skyway-js-sdk/pull/221))

## [v2.0.3](https://github.com/skyway/skyway-js-sdk/releases/tag/v2.0.3) - 2019-08-27

### Fixed

- Fix a bug of handle video|audio only stream.([#214](https://github.com/skyway/skyway-js-sdk/pull/214))

### Updated
- Update dev+prod deps.([#211](https://github.com/skyway/skyway-js-sdk/pull/211))


## [v2.0.2](https://github.com/skyway/skyway-js-sdk/releases/tag/v2.0.2) - 2019-07-29

### Fixed

- Use `connectionState` to detect `iceConnectionState` goes `failed`.([#208](https://github.com/skyway/skyway-js-sdk/pull/208))
- Misc Updates for `/examples`.([#192](https://github.com/skyway/skyway-js-sdk/pull/192))

## [v2.0.1](https://github.com/skyway/skyway-js-sdk/releases/tag/v2.0.1) - 2019-07-05

### Fixed

- Improve error messages for internal XHR.([#188](https://github.com/skyway/skyway-js-sdk/pull/188))
- Ignore candidate which means `end-of-candidates` by empty string.([#189](https://github.com/skyway/skyway-js-sdk/pull/189))

## [v2.0.0](https://github.com/skyway/skyway-js-sdk/releases/tag/v2.0.0) - 2019-06-24

### Breaking Changes

- Use `unified-plan` and track-based APIs on every browser.([#183](https://github.com/skyway/skyway-js-sdk/pull/183))
  - `removeStream` event is not emitted anymore on `MediaConnection`, `MeshRoom` and `SFURoom`.
  - You may be able to use `peerLeave` event instead.

### Added
- Add `skyway-js.d.ts` to support TypeScript.([#186](https://github.com/skyway/skyway-js-sdk/pull/186))

### Fixed

- Fix bug when calling `peer.call()` w/o `stream` ends up with SDP error in `unified-plan` environment.([#183](https://github.com/skyway/skyway-js-sdk/pull/183))
- Update `/examples` to use `playsinline` attribute for mobile.([#181](https://github.com/skyway/skyway-js-sdk/pull/181))
- Fix `token` for `Peer` not to be overridden by user options.([#182](https://github.com/skyway/skyway-js-sdk/pull/182))
- Update error messages for SDK internally gets signaling server URL.([#185](https://github.com/skyway/skyway-js-sdk/pull/185))

## [v1.4.0](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.4.0) - 2019-05-28

### Added

- Add APIs to get an RTCPeerConnection that used in `MediaConnection` and `DataConnection`.

### Fixed

- Fix the error on parsing SDP in unified-plan iOS.

## [v1.3.0](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.3.0) - 2019-05-21

### Added

- Add an option when calling Connection.close to signal intention to disconnection to the remote peer instantly.

### Fixed

- Fix a bug of `replaceStream` with the audio OR video only stream (mentioned in #172)

#### Internally changed

- Changed to not to use the part of legacy stream-based API internally.

## [v1.2.0](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.2.0) - 2019-04-09

### Added

- Support Safari(v12.1~)

## [v1.1.21](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.21) - 2019-03-26

### Fixed

- Fix SkyWay not to override global `onbeforeunload` handler
- Throw proper error when invalid id was passed into `Peer` constructor
- Update dependencies

## [v1.1.20](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.20) - 2019-02-18

### Fixed

- Fix that SkyWay always uses plan-b as SDP format
- Renew examples

## [v1.1.19](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.19) - 2018-12-05

### Fixed

- Remove streams of a peer when it leaves from a SFU room.

## [v1.1.18](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.18) - 2018-11-19

### Fixed

- Add a sdpSemantics option for Chrome M72 that will use unified-plan as default

## [v1.1.17](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.17) - 2018-09-05

### Fixed

- Fix that the bug receive-only does not work on Chrome 69

## [v1.1.16](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.16) - 2018-08-20

### Fixed

- Change the timeout setting of the request to dispatcher server for stabilization
- Do not output source-map and use better dev-tool in production mode
- Fix that skyway.js uploaded to Github release page was broken

## [v1.1.15](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.15) - 2018-07-17

### Fixed

- Fix that dist/skyway.js is included after npm install

## [v1.1.14](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.14) - 2018-07-17

### Fixed

- Fix connection fails which happen when ICE candidates arrive before setRemoteDescription
- Refactor the codes into async/await style

## [v1.1.13](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.13) - 2018-06-26

### Fixed

- Add errors which occur when the request to the dispatcher server has aborted.
- Avoid fault of parsing JSON with a failure of the request to the dispatcher server.

## [v1.1.12](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.12) - 2018-06-20

### Fixed

- Revert v1.1.11 because of bugs

## [v1.1.11](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.11) - 2018-06-19

### Fixed

- Change the timeout setting of the request to dispatcher server for stabilization
- Fix the severe timing bug which happens during setRemoteDescription and its resolution

## [v1.1.10](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.10) - 2018-05-21

### Fixed

- Catch error when fetching signaling server fails with a timeout

## [v1.1.9](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.9) - 2018-05-07

### Fixed

- Fix referring to null variable after calling close()

## [v1.1.8](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.8) - 2018-04-27

### Fixed

- Fix Firefox 59 receive only mode not working
- Prevent DOMException by settting remote SDP when signaling state is not stable

## [v1.1.7](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.7) - 2018-03-12

### Fixed

- Fix Chrome 64 and Firefox 59 replaceStream interoperability

### Known Issues

- remote stream freezes in an SFU room for clients using Firefox 59 and replaceStream is called on Chrome 64

## [v1.1.6](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.6) - 2018-03-01

### Fixed

- Use addStream for SkyWay to Work with Google Chrome 65

## [v1.1.5](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.5) - 2018-01-31

### Fixed

- Fixed a bug that SkyWay is broken on Google Chrome 63 and earlier.

## [v1.1.4](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.4) - 2018-01-30

### Fixed

- Fixed a bug that replaceStream does not work correctly on Google Chrome 64.

## [v1.1.3](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.3) - 2017-12-11

### Fixed

- add commit of replaceStream bug that was supposed to be fixed in v1.1.0 was somehow misplaced

## [v1.1.2](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.2) - 2017-12-04

### Added

- Added contribution guide to README

## [v1.1.1](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.1) - 2017-12-04

### Fixed

- Fixed npm install instructions in README

## [v1.1.0](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.1.0) - 2017-12-04

### Added

- New options to `peer.call()/peer.joinRoom()` (videoReceiveEnabled/audioReceiveEnabled) which enabled you to receive audio while sending video and vice versa ([PR #25](https://github.com/skyway/skyway-js-sdk/pull/25))
- Support unreliable datachannel by adding a new option to `peer.connect()` (dcInit) which allows you to set the options shown [here](https://www.w3.org/TR/webrtc/#dom-rtcdatachannelinit) ([PR #26](https://github.com/skyway/skyway-js-sdk/pull/26))
- [npm support](https://www.npmjs.com/package/skyway-js) ([PR #27](https://github.com/skyway/skyway-js-sdk/pull/27))

### Fixed

- Fixed bug where adding a previously non-existent track when calling `replaceStream()` failed. ([PR #12](https://github.com/skyway/skyway-js-sdk/pull/12))
  - make sure to set xReceiveEnabled when you initially don't have a media track of type 'x' but might be receiving one later

## [v1.0.1](https://github.com/skyway/skyway-js-sdk/releases/tag/v1.0.1) - 2017-09-11

### Added

- Change log

### Fixed

- Change timing of DataConnection 'open' event so that it can always be caught. ([PR #1](https://github.com/skyway/skyway-js-sdk/pull/1))
