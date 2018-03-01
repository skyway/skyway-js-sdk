# Changelog

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
