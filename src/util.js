'use strict';

class Util {
  static setLogLevel(level) {
    // TODO: Remove lint bypass
    console.log(level);
  }

  static setLogFunction(fn) {
    console.log(fn);
  }

  static extend(dst, src) {
    // TODO: see if it can be replaced by ES6 Object.assign

    // TODO: Remove lint bypass
    console.log(dst, src);
    return src;
  }

  static randomToken() {
    return '';
  }

  static warn() {

  }

  static get browser() {

  }
  static get supports() {
  }

  static validateId(id) {
    // TODO: Remove lint bypass
    console.log(id);
  }

  static inherits(ctor, superCtor) {
    // TODO: Remove lint bypass
    console.log(ctor, superCtor);
  }

  static log() {

  }

  static get setZeroTimeout() {

  }

  static chunk(bl) {
    // TODO: Remove lint bypass
    console.log(bl);
  }

  static blobToArrayBuffer(blob, cb) {
    // TODO: Remove lint bypass
    console.log(blob, cb);
  }

  static blobToBinaryString(blob, cb) {
    // TODO: Remove lint bypass
    console.log(blob, cb);
  }

  static binaryStringToArrayBuffer(binary) {
    // TODO: Remove lint bypass
    console.log(binary);
  }

  static isSecure() {

  }
}

module.exports = Util;
