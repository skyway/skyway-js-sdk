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

  setLogLevel(level) {
    // TODO: Remove lint bypass
    console.log(level);
  }

  setLogFunction(fn) {
    console.log(fn);
  }

  extend(dst, src) {
    // TODO: see if it can be replaced by ES6 Object.assign

    // TODO: Remove lint bypass
    console.log(dst, src);
    return src;
  }

  randomToken() {
    return '';
  }

  warn() {
  }

  validateId(id) {
    // TODO: Remove lint bypass
    console.log(id);
  }

  validateKey(key) {
    // TODO: Remove lint bypass
    console.log(key);
  }

  inherits(ctor, superCtor) {
    // TODO: Remove lint bypass
    console.log(ctor, superCtor);
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
    err ? console.error.apply(console, copy) : console.log.apply(console, copy);
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
