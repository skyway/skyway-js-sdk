'use strict';

const BinaryPack = require('js-binarypack');

const LOG_LEVEL_NONE  = 0;
const LOG_LEVEL_ERROR = 1;
const LOG_LEVEL_WARN  = 2;
const LOG_LEVEL_FULL  = 3;
const LOG_PREFIX      = 'SkyWayJS: '

class Util {
  constructor() {
    this.CLOUD_HOST = 'skyway.io';
    this.CLOUD_PORT = 443;
    this.TURN_HOST = 'turn.skyway.io';
    this.TURN_PORT = 443;
    this.browser = undefined;
    this.supports = undefined;
    this.debug = false;
    this.pack = BinaryPack.pack;
    this.unpack = BinaryPack.unpack;
    this.setZeroTimeout = undefined;

    this._logLevel = LOG_LEVEL_NONE;
  }

  setLogLevel(level) {
    const decimalRadix = 10;
    let debugLevel = parseInt(level, decimalRadix);

    switch (debugLevel) {
      case 0:
        this._logLevel = LOG_LEVEL_NONE;
        break;
      case 1:
        this._logLevel = LOG_LEVEL_ERROR;
        break;
      case 2:
        this._logLevel = LOG_LEVEL_WARN;
        break;
      case 3:
        this._logLevel = LOG_LEVEL_FULL;
        break;
    }
  }

  warn() {
    if(this._logLevel >= LOG_LEVEL_WARN) {
      let copy = Array.prototype.slice.call(arguments);
      copy.unshift(LOG_PREFIX);
      console.warn.apply(console, copy);
    }
  }

  error() {
    if(this._logLevel >= LOG_LEVEL_ERROR) {
      let copy = Array.prototype.slice.call(arguments);
      copy.unshift(LOG_PREFIX);
      console.error.apply(console, copy);
    }
  }

  log() {
    if(this._logLevel >= LOG_LEVEL_FULL) {
      let copy = Array.prototype.slice.call(arguments);
      copy.unshift(LOG_PREFIX);
      console.log.apply(console, copy);
    }
  }

  validateId(id) {
    // Allow empty ids
    return !id || /^[A-Za-z0-9_-]+(?:[ _-][A-Za-z0-9]+)*$/.exec(id);
  }

  validateKey(key) {
    // Allow empty keys
    return !key || /^[a-z0-9]{8}(-[a-z0-9]{4}){3}-[a-z0-9]{12}$/.exec(key);
  }

  randomToken() {
    return Math.random().toString(36).substr(2);
  }

  chunk(bl) {
    // TODO: Remove lint bypass
    console.log(bl);
  }

  blobToArrayBuffer(blob, cb) {
    // TODO: Remove lint bypass
    console.log(blob, cb);
  }

  blobToBinaryString(blob, cb) {
    // TODO: Remove lint bypass
    console.log(blob, cb);
  }

  binaryStringToArrayBuffer(binary) {
    // TODO: Remove lint bypass
    console.log(binary);
  }

  // isSecure() {
  //   // FIXME: Lint error since location is not defined explicitly
  //   return location.protocol === 'https:';
  // }
}

module.exports = Util;
