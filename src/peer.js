'use strict';

// const DataConnection  = require('./dataConnection');
// const MediaConnection = require('./mediaConnection');
// const Socket          = require('./socket');
const util            = require('./util');

const EventEmitter = require('events');

class Peer extends EventEmitter {
  constructor(id, options) {
    super();

    this.destroyed = false;
    this.disconnected = false;
    this.open = false;
    this.connections = {};
    this._lostMessages = {};

    if (id && id.constructor === Object) {
      options = id;
      id = undefined;
    } else if (id) {
      id = id.toString();
    }

    const defaultOptions = {
      debug:  0,
      host:   util.CLOUD_HOST,
      port:   util.CLOUD_PORT,
      key:    'skyway-apikey',
      path:   '/',
      token:  util.randomToken(),
      config: util.defaultConfig,
      turn:   true
    };
    this.options = options = Object.assign(options, defaultOptions);

    if (options.host === '/') {
      options.host = window.location.hostname;
    }

    if (options.path[0] !== '/') {
      options.path = `/${options.path}`;
    }
    if (options.path[options.path.length - 1] !== '/') {
      options.path += '/';
    }

    util.setLogLevel(options.debug);

    if (!util.validateId(id)) {
      this._delayedAbort('invalid-id', 'ID "' + id + '" is invalid');
      return;
    }

    if (!util.validateKey(options.key)) {
      this._delayedAbort('invalid-key', 'API KEY "' + options.key + '" is invalid');
      return;
    }

    this._initializeServerConnection();
    if (id) {
      this._retrieveId(id);
    } else {
      this._retrieveId();
    }
  }

  connect(peer, options) {
    // TODO: Remove lint bypass
    console.log(peer, options);
  }

  call(peer, stream, options) {
    // TODO: Remove lint bypass
    console.log(peer, stream, options);
  }

  getConnection(peer, id) {
    // TODO: Remove lint bypass
    console.log(peer, id);
  }

  emitError(type, err) {
    // TODO: Remove lint bypass
    console.log(type, err);
  }

  destroy() {
  }

  disconnect() {
  }

  reconnect() {
  }

  listAllPeers(cb) {
    // TODO: Remove lint bypass
    console.log(cb);
  }

  _abort(type, message) {
    util.error('Aborting!');
    if (this._lastServerId === undefined) {
      this.destroy();
    } else {
      this.disconnect();
    }
    this.emitError(type, message);
  }

  _delayedAbort(type, message) {
    util.setTimeout(() => {
      this._abort(type, message);
    }, 0);
  }

  _initializeServerConnection() {
    // TODO implement
  }

  _retrieveId(id) {
    // TODO: Remove lint bypass
    console.log(id);
  }
}

module.exports = Peer;
