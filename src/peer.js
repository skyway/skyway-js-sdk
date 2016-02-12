'use strict';

// const DataConnection  = require('./dataConnection');
// const MediaConnection = require('./mediaConnection');
const Socket          = require('./socket');
const util            = require('./util');

const EventEmitter = require('events');

class Peer extends EventEmitter {
  constructor(id, options) {
    super();

    // true when connected to SkyWay server
    this.open = false;
    this.connections = {};

    // to prevent duplicate calls to destroy/disconnect
    this._disconnectCalled = false;
    this._destroyCalled = false;

    // store peerId after disconnect to use when reconnecting
    this._lastPeerId = null;

    if (id && id.constructor === Object) {
      options = id;
      id = undefined;
    } else if (id) {
      id = id.toString();
    }

    const defaultOptions = {
      debug:  util.LOG_LEVELS.NONE,
      host:   util.CLOUD_HOST,
      port:   util.CLOUD_PORT,
      token:  util.randomToken(),
      config: util.defaultConfig,
      turn:   true
    };
    this.options = Object.assign({}, defaultOptions, options);

    if (this.options.host === '/') {
      this.options.host = window.location.hostname;
    }

    util.setLogLevel(this.options.debug);

    if (!util.validateId(id)) {
      this._abort('invalid-id', `ID "${id}" is invalid`);
      return;
    }

    if (!util.validateKey(this.options.key)) {
      this._abort('invalid-key', `API KEY "${this.options.key}" is invalid`);
      return;
    }

    this._initializeServerConnection();
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
    util.error('Error:', err);
    if (typeof err === 'string') {
      err = new Error(err);
    }

    err.type = type;
    this.emit('error', err);
  }

  destroy() {
    if (!this._destroyCalled) {
      this._destroyCalled = true;
      this._cleanup();
      this.disconnect();
    }
  }

  disconnect() {
    setTimeout(() => {
      if (!this._disconnectCalled) {
        this._disconnectCalled = true;
        this.open = false;

        if (this.socket) {
          this.socket.close();
        }

        this.emit('disconnected', this.id);
        this._lastPeerId = this.id;
        this.id = null;
      }
    }, 0);
  }

  reconnect() {
  }

  listAllPeers(cb) {
    // TODO: Remove lint bypass
    console.log(cb);
  }

  _abort(type, message) {
    util.error('Aborting!');
    this.disconnect();
    this.emitError(type, message);
  }

  _delayedAbort(type, message) {
    setTimeout(() => {
      this._abort(type, message);
    }, 0);
  }

  _initializeServerConnection() {
    this.socket = new Socket(
      this.options.secure,
      this.options.host,
      this.options.port,
      this.options.key);

    this.socket.on('message', data => {
      this._handleMessage(data);
    });

    this.socket.on('error', error => {
      this._abort('socket-error', error);
    });

    this.socket.on('disconnect', () => {
      // If we haven't explicitly disconnected, emit error and disconnect.
      if (!this._disconnectCalled) {
        this.disconnect();
        this.emitError('socket-error', 'Lost connection to server.');
      }
    });

    window.onbeforeunload = () => {
      this.destroy();
    };
  }

  _handleMessage() {
  }

  _retrieveId(id) {
    // TODO: Remove lint bypass
    console.log(id);
  }

  _cleanup() {
    if (this.connections) {
      for (let peer of Object.keys(this.connections)) {
        this._cleanupPeer(peer);
      }
    }
    this.emit('close');
  }

  _cleanupPeer(peer) {
    for (let id of Object.keys(this.connections[peer])) {
      this.connections[peer][id].close();
    }
  }
}

module.exports = Peer;
