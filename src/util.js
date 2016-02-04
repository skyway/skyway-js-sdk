'use strict';

const BinaryPack = require('js-binarypack');

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

    this._logLevel = 0;
  }

  noop() {
  }

  setLogLevel(level) {
    const decimalRadix = 10;
    let debugLevel = parseInt(level, decimalRadix);
    if (isNaN(parseInt(level, decimalRadix))) {
      // If they are using truthy/falsy values for debug
      this._logLevel = level ? 3 : 0;
    } else {
      this._logLevel = debugLevel;
    }
    this.log = this.warn = this.error = this.noop;
    if (this._logLevel > 0) {
      this.error = this._printWith('ERROR');
    }
    if (this._logLevel > 1) {
      this.warn = this._printWith('WARNING');
    }
    if (this._logLevel > 2) {
      this.log = this._print;
    }
  }

  _printWith(prefix) {
    return () => {
      let copy = Array.prototype.slice.call(arguments);
      copy.unshift(prefix);
      this._print.apply(this, copy);
    };
  }

  _print() {
    let err = false;
    let copy = Array.prototype.slice.call(arguments);
    copy.unshift('PeerJS: ');
    for (var i = 0, l = copy.length; i < l; i++) {
      if (copy[i] instanceof Error) {
        copy[i] = '(' + copy[i].name + ') ' + copy[i].message;
        err = true;
      }
    }
    if (err) {
      console.error.apply(console, copy);
    } else {
      console.log.apply(console, copy);
    }
  }

  setLogFunction(fn) {
    console.log(fn);
  }

  randomToken() {
    return Math.random().toString(36).substr(2);
  }

  warn() {
  }

  validateId(id) {
    // Allow empty ids
    return !id || /^[A-Za-z0-9_-]+(?:[ _-][A-Za-z0-9]+)*$/.exec(id);
  }

  validateKey(key) {
    // Allow empty keys
    return !key || /^[a-z0-9]{8}(-[a-z0-9]{4}){3}-[a-z0-9]{12}$/.exec(key);
  }

  log() {
    if (!this.debug) {
      return;
    }

    let err = false;
    let copy = Array.prototype.slice.call(arguments);
    copy.unshift('PeerJS: ');
    for (let i = 0, l = copy.length; i < l; i++) {
      if (copy[i] instanceof Error) {
        copy[i] = '(' + copy[i].name + ') ' + copy[i].message;
        err = true;
      }
    }

    if (err) {
      console.error.apply(console, copy);
    } else {
      console.log.apply(console, copy);
    }
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

  isSecure() {
  }
}

module.exports = Util;
