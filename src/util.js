'use strict';

const BinaryPack = require('js-binarypack');

// Log ENUM setup. 'enumify' is only used with `import`, not 'require'.
import {Enum} from 'enumify';
class LogLevel extends Enum {}
LogLevel.initEnum(['NONE', 'ERROR', 'WARN', 'FULL']);
const LOG_PREFIX      = 'SkyWayJS: ';

class MessageTypes extends Enum {}
MessageTypes.initEnum([
  'OPEN',
  'ERROR',
  'OFFER',
  'ANSWER',
  'LEAVE',
  'EXPIRE',
  'CANDIDATE'
]);

class PeerEvents extends Enum {}
PeerEvents.initEnum([
  'open',
  'error',
  'call',
  'connection',
  'close',
  'disconnected'
]);

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
    this.LOG_LEVELS = LogLevel;
    this.MESSAGE_TYPES = MessageTypes;
    this.PEER_EVENTS = PeerEvents;

    this.defaultConfig = {
      iceServers: [{
        urls: 'stun:stun.skyway.io:3478',
        url:  'stun:stun.skyway.io:3478'
      }]
    };

    this._logLevel = LogLevel.NONE.ordinal;
  }

  setLogLevel(level) {
    if (level instanceof LogLevel) {
      level = level.ordinal;
    }

    const decimalRadix = 10;
    let debugLevel = parseInt(level, decimalRadix);

    switch (debugLevel) {
      case 0:
        this._logLevel = LogLevel.NONE.ordinal;
        break;
      case 1:
        this._logLevel = LogLevel.ERROR.ordinal;
        break;
      case 2:
        this._logLevel = LogLevel.WARN.ordinal;
        break;
      case 3:
        this._logLevel = LogLevel.FULL.ordinal;
        break;
      default:
        this._logLevel = LogLevel.NONE.ordinal;
        break;
    }
  }

  warn() {
    if (this._logLevel >= LogLevel.WARN.ordinal) {
      let copy = Array.prototype.slice.call(arguments);
      copy.unshift(LOG_PREFIX);
      console.warn.apply(console, copy);
    }
  }

  error() {
    if (this._logLevel >= LogLevel.ERROR.ordinal) {
      let copy = Array.prototype.slice.call(arguments);
      copy.unshift(LOG_PREFIX);
      console.error.apply(console, copy);
    }
  }

  log() {
    if (this._logLevel >= LogLevel.FULL.ordinal) {
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

  isSecure() {
    return location.protocol === 'https:';
  }
}

module.exports = new Util();
