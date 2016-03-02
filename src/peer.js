'use strict';

const DataConnection  = require('./dataConnection');
const MediaConnection = require('./mediaConnection');
const Socket          = require('./socket');
const util            = require('./util');

const EventEmitter = require('events');

// Log ENUM setup. 'enumify' is only used with `import`, not 'require'.
import {Enum} from 'enumify';
class PeerEvents extends Enum {}
PeerEvents.initEnum([
  'open',
  'error',
  'call',
  'connection',
  'close',
  'disconnected'
]);

class Peer extends EventEmitter {
  constructor(id, options) {
    super();

    // true when connected to SkyWay server
    this.open = false;
    this.connections = {};

    // to prevent duplicate calls to destroy/disconnect
    this._disconnectCalled = false;
    this._destroyCalled = false;

    // messages received before connection is ready
    this._queuedMessages = {};

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

    this._initializeServerConnection(id);
  }

  connect(peerId, options) {
    if (this._disconnectCalled) {
      util.warn('You cannot connect to a new Peer because you called ' +
        '.disconnect() on this Peer and ended your connection with the ' +
        'server. You can create a new Peer to reconnect, or call reconnect ' +
        'on this peer if you believe its ID to still be available.');
      this.emitError(
        'disconnected',
        'Cannot connect to new Peer after disconnecting from server.'
      );
      return null;
    }

    const connection = new DataConnection(peerId, options);
    util.log('DataConnection created in connect method');
    this._addConnection(peerId, connection);
    return connection;
  }

  call(peerId, stream, options) {
    if (this._disconnectCalled) {
      util.warn('You cannot connect to a new Peer because you called ' +
        '.disconnect() on this Peer and ended your connection with the ' +
        'server. You can create a new Peer to reconnect, or call reconnect ' +
        'on this peer if you believe its ID to still be available.');
      this.emitError(
        'disconnected',
        'Cannot connect to new Peer after disconnecting from server.');
      return null;
    }
    if (!stream) {
      util.error(
        'To call a peer, you must provide ' +
        'a stream from your browser\'s `getUserMedia`.'
      );
      return null;
    }

    options = options || {};
    options._stream = stream;
    const mc = new MediaConnection(options);
    util.log('MediaConnection created in call method');
    this._addConnection(peerId, mc);
    return mc;
  }

  getConnection(peerId, connectionId) {
    if (this.connections[peerId]) {
      for (let connection of this.connections[peerId]) {
        if (connection.id === connectionId) {
          return connection;
        }
      }
    }
    return null;
  }

  emitError(type, err) {
    util.error('Error:', err);
    if (typeof err === 'string') {
      err = new Error(err);
    }

    err.type = type;
    this.emit(Peer.EVENTS.error.name, err);
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

        this.emit(Peer.EVENTS.disconnected.name, this.id);
        this._lastPeerId = this.id;
        this.id = null;
      }
    }, 0);
  }

  reconnect() {
  }

  listAllPeers(cb) {
    cb = cb || function() {};
    const self = this;
    const http = new XMLHttpRequest();
    const protocol = this.options.secure ? 'https://' : 'http://';

    const url = `${protocol}${this.options.host}:` +
              `${this.options.port}/active/list/${this.options.key}`;

    // If there's no ID we need to wait for one before trying to init socket.
    http.open('get', url, true);
    http.onerror = function() {
      self._abort('server-error', 'Could not get peers from the server.');
      cb([]);
    };
    http.onreadystatechange = function() {
      if (http.readyState !== 4) {
        return;
      }
      if (http.status === 401) {
        cb([]);
        throw new Error(
          'It doesn\'t look like you have permission to list peers IDs. ' +
          'Please enable the SkyWay REST API on https://skyway.io/ds/'
        );
      } else if (http.status === 200) {
        cb(JSON.parse(http.responseText));
      } else {
        cb([]);
      }
    };
    http.send(null);
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

  _initializeServerConnection(id) {
    this.socket = new Socket(
      this.options.secure,
      this.options.host,
      this.options.port,
      this.options.key);

    this._setupMessageHandlers();

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

    this.socket.start(id, this.options.token);

    window.onbeforeunload = () => {
      this.destroy();
    };
  }

  _setupMessageHandlers() {
    this.socket.on(util.MESSAGE_TYPES.OPEN.name, id => {
      this.id = id;
      this.open = true;
      this.emit(Peer.EVENTS.open, id);
    });

    this.socket.on(util.MESSAGE_TYPES.ERROR.name, error => {
      this._abort('server-error', error);
    });

    this.socket.on(util.MESSAGE_TYPES.LEAVE.name, peerId => {
      util.log(`Received leave message from ${peerId}`);
      this._cleanupPeer(peerId);
    });

    this.socket.on(util.MESSAGE_TYPES.EXPIRE.name, peerId => {
      this.emitError(
        'peer-unavailable',
        `Could not connect to peer ${peerId}`
      );
    });

    this.socket.on(util.MESSAGE_TYPES.OFFER.name, offerMessage => {
      const connectionId = offerMessage.connectionId;
      let connection = this.getConnection(offerMessage.src, connectionId);

      if (connection) {
        util.warn('Offer received for existing Connection ID:', connectionId);
        return;
      }

      if (offerMessage.type === 'media') {
        connection = new MediaConnection({
          connectionId:    connectionId,
          payload:         offerMessage,
          metadata:        offerMessage.metadata,
          _queuedMessages: this._queuedMessages[connectionId]
        });

        util.log('MediaConnection created in OFFER');
        this._addConnection(offerMessage.src, connection);
        this.emit(Peer.EVENTS.call.name, connection);
      } else if (offerMessage.type === 'data') {
        connection = new DataConnection({
          connectionId:    connectionId,
          _payload:        offerMessage,
          metadata:        offerMessage.metadata,
          label:           offerMessage.label,
          serialization:   offerMessage.serialization,
          _queuedMessages: this._queuedMessages[connectionId]
        });

        util.log('DataConnection created in OFFER');
        this._addConnection(offerMessage.src, connection);
        this.emit(Peer.EVENTS.connection.name, connection);
      } else {
        util.warn('Received malformed connection type: ', offerMessage.type);
      }

      delete this._queuedMessages[connectionId];
    });

    this.socket.on(util.MESSAGE_TYPES.ANSWER.name, answerMessage => {
      const connection = this.getConnection(
                            answerMessage.src,
                            answerMessage.connectionId
                          );

      if (connection) {
        connection.handleAnswer(answerMessage);
      } else {
        this._storeMessage(util.MESSAGE_TYPES.ANSWER.name, answerMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.CANDIDATE.name, candidateMessage => {
      const connection = this.getConnection(
                            candidateMessage.src,
                            candidateMessage.connectionId
                          );

      if (connection) {
        connection.handleAnswer(candidateMessage);
      } else {
        this._storeMessage(util.MESSAGE_TYPES.CANDIDATE.name, candidateMessage);
      }
    });
  }

  _addConnection(peerId, connection) {
    if (!this.connections[peerId]) {
      this.connections[peerId] = [];
    }
    this.connections[peerId].push(connection);
  }

  _storeMessage(type, message) {
    if (this._queuedMessages[message.connectionId]) {
      this._queuedMessages[message.connectionId] = [];
    }
    this._queuedMessages[message.connectionId].push({type: type, payload: message});
  }

  _cleanup() {
    if (this.connections) {
      for (let peer of Object.keys(this.connections)) {
        this._cleanupPeer(peer);
      }
    }
    this.emit(Peer.EVENTS.close.name);
  }

  _cleanupPeer(peer) {
    if (this.connections[peer]) {
      for (let connection of this.connections[peer]) {
        connection.close();
      }
    }
  }

  static get EVENTS() {
    return PeerEvents;
  }
}

module.exports = Peer;
