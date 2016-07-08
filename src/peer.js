'use strict';

const Connection      = require('./connection');
const DataConnection  = require('./dataConnection');
const MediaConnection = require('./mediaConnection');
const Room            = require('./room');
const Socket          = require('./socket');
const util            = require('./util');

const EventEmitter = require('events');
const Enum         = require('enum');

const PeerEvents = new Enum([
  'open',
  'error',
  'call',
  'connection',
  'close',
  'disconnected'
]);

/**
 * Class that manages all p2p connections and rooms.
 * This class contains socket.io message handlers.
 * @extends EventEmitter
 */
class Peer extends EventEmitter {

  /**
   * Create new Peer instance. This is called by user application.
   * @param {string} [id] - User's peerId.
   * @param {Object} options - Optional arguments for the connection.
   * @param {string} options.key - SkyWay API key.
   * @param {Integer} [options.debug=0] - Log level. NONE:0, ERROR:1, WARN:2, FULL:3.
   * @param {string} [options.host='skyway.io'] - The host name of signaling server.
   * @param {Integer} [options.port=443] - The port number of signaling server.
   * @param {string} [options.token=util.randomToken()] - The token used to authorize Peer.
   * @param {object} [options.config=util.defaultConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {boolean} [options.turn=true] - Whether using TURN or not.
   */
  constructor(id, options) {
    super();

    // true when connected to SkyWay server
    this.open = false;
    this.connections = {};
    this.rooms = {};

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

  /**
   * Creates new DataConnection.
   * @param {string} peerId - User's peerId.
   * @param {Object} [options] - Optional arguments for DataConnection.
   * @param {string} [options.connectionId] - An ID to uniquely identify the connection.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {string} [options.serialization] - How to serialize data when sending. One of 'binary', 'json' or 'none'.
   * @param {string} [options.queuedMessages] - An array of messages that were already received before the connection was created.
   * @param {string} [options.payload] - An offer message that triggered creating this object.
   * @return {Connection} An instance of DataConnection.
   */
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

    options = options || {};
    options.pcConfig = this._pcConfig;
    const connection = new DataConnection(peerId, options);
    util.log('DataConnection created in connect method');
    this._addConnection(peerId, connection);
    return connection;
  }

  /**
   * Creates new MediaConnection.
   * @param {string} peerId - The peerId of the peer you are connecting to.
   * @param {MediaStream} stream - The MediaStream to send to the remote peer. Set only when on the caller side.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {string} [options.connectionId] - An ID to uniquely identify the connection.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {string} [options.queuedMessages] - An array of messages that were already received before the connection was created.
   * @param {string} [options.payload] - An offer message that triggered creating this object.
   * @return {Connection} An instance of MediaConnection.
   */
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
    options.stream = stream;
    options.pcConfig = this._pcConfig;
    const mc = new MediaConnection(peerId, options);
    util.log('MediaConnection created in call method');
    this._addConnection(peerId, mc);
    return mc;
  }

  /**
   * Returns a connection according to given peerId and connectionId.
   * @param {string} peerId - The peerId of the connection to be searched.
   * @param {Object} connectionId - An ID to uniquely identify the connection.
   * @return {MediaConnection|DataConnection} Search result.
   */
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

  /**
   * Emit Error.
   * @param {string} type - The type of error.
   * @param {Error} err - An Error instance or error description.
   * @private
   */
  emitError(type, err) {
    util.error('Error:', err);
    if (typeof err === 'string') {
      err = new Error(err);
    }

    err.type = type;
    this.emit(Peer.EVENTS.error.key, err);
  }

  /**
   * Close all connections and disconnect socket.
   */
  destroy() {
    if (!this._destroyCalled) {
      this._destroyCalled = true;
      this._cleanup();
      this.disconnect();
    }
  }

  /**
   * Close socket and clean up some properties, then emit disconnect event.
   */
  disconnect() {
    setTimeout(() => {
      if (!this._disconnectCalled) {
        this._disconnectCalled = true;
        this.open = false;

        if (this.socket) {
          this.socket.close();
        }

        this.emit(Peer.EVENTS.disconnected.key, this.id);
        this._lastPeerId = this.id;
        this.id = null;
      }
    }, 0);
  }

  /**
   * Creates new MeshRoom or SFURoom. If roomOptions has a stream, it calls room.call.
   * @param {string} roomName - The name or room.
   * @param {Object} [roomOptions] - Optional arguments for the room.
   * @param {MediaStream} [roomOptions.stream] - The MediaStream to send to the remote peer.
   * @return {Room} An instance of SFURoom or MeshRoom.
   */
  joinRoom(roomName, roomOptions) {
    if (!roomName) {
      this.emitError('room-error', 'Room name must be defined.');
      return null;
    }

    if (this.rooms[roomName]) {
      return this.rooms[roomName];
    }

    if (!roomOptions) {
      roomOptions = {};
    }
    roomOptions.pcConfig = this._pcConfig;
    roomOptions.peerId = this.id;

    const room = new Room(roomName, roomOptions);
    this.rooms[roomName] = room;

    this._setupRoomMessageHandlers(room);

    const data = {
      roomName:    roomName,
      roomOptions: roomOptions
    };
    this.socket.send(util.MESSAGE_TYPES.ROOM_JOIN.key, data);

    return room;
  }

  /**
   * Set up room's message handlers.
   * @param {Room} room - The room to be set up.
   */
  _setupRoomMessageHandlers(room) {
    room.on(Room.MESSAGE_EVENTS.broadcast.key, sendMessage => {
      this.socket.send(util.MESSAGE_TYPES.ROOM_DATA.key, sendMessage);
    });
    room.on(Room.MESSAGE_EVENTS.leave.key, leaveMessage => {
      delete this.rooms[room.name];
      this.socket.send(util.MESSAGE_TYPES.ROOM_LEAVE.key, leaveMessage);
    });
    room.on(Room.MESSAGE_EVENTS.answer.key, answerMessage => {
      this.socket.send(util.MESSAGE_TYPES.ROOM_ANSWER.key, answerMessage);
    });
    room.on(Room.MESSAGE_EVENTS.getLog.key, getLogMessage => {
      this.socket.send(util.MESSAGE_TYPES.ROOM_LOG.key, getLogMessage);
    });
  }

  /**
   * Reconnect to SkyWay server.
   */
  reconnect() {
  }

  /**
   * Call Rest API and get the list of peerIds assciated with API key.
   * @param {function} cb - The callback function that is called after XHR.
   */
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

  /**
   * Disconnect the socket and emit error.
   * @param {string} type - The type of error.
   * @param {string} message - Error description.
   * @private
   */
  _abort(type, message) {
    util.error('Aborting!');
    this.disconnect();
    this.emitError(type, message);
  }

  /**
   * Abort in a moment.
   * @param {string} type - The type of error.
   * @param {string} message - Error description.
   * @private
   */
  _delayedAbort(type, message) {
    setTimeout(() => {
      this._abort(type, message);
    }, 0);
  }

  /**
   * Creates new Socket and initalize its message handlers.
   * @param {string} id - User's peerId.
   * @private
   */
  _initializeServerConnection(id) {
    this.socket = new Socket(
      this.options.secure,
      this.options.host,
      this.options.port,
      this.options.key
    );

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

  /**
   * Set up socket's message handlers.
   * @private
   */
  _setupMessageHandlers() {
    this.socket.on(util.MESSAGE_TYPES.OPEN.key, openMessage => {
      this.id = openMessage.peerId;
      this.open = true;
      this._pcConfig = Object.assign({}, this.options.config);

      // make a copy of iceServers as Object.assign still retains the reference
      const iceServers = this._pcConfig.iceServers;
      this._pcConfig.iceServers = iceServers ? iceServers.slice() : [];

      // Set up turn credentials
      const credential = openMessage.turnCredential;
      if (this.options.turn === true && credential) {
        // possible turn types are turn-tcp, turns-tcp, turn-udp
        const turnCombinations = [
          {protocol: 'turn', transport: 'tcp'},
          {protocol: 'turns', transport: 'tcp'},
          {protocol: 'turn', transport: 'udp'}
        ];
        for (let turnType of turnCombinations) {
          const protocol = turnType.protocol;
          const transport = turnType.transport;

          const iceServer = {
            urls: `${protocol}:${util.TURN_HOST}:${util.TURN_PORT}?transport=${transport}`,
            url:  `${protocol}:${util.TURN_HOST}:${util.TURN_PORT}?transport=${transport}`,

            username:   `${this.options.key}$${this.id}`,
            credential: credential
          };

          this._pcConfig.iceServers.push(iceServer);
        }

        util.log('SkyWay TURN Server is available');
      } else {
        util.log('SkyWay TURN Server is unavailable');
      }

      this.emit(Peer.EVENTS.open.key, this.id);
    });

    this.socket.on(util.MESSAGE_TYPES.ERROR.key, error => {
      this._abort('server-error', error);
    });

    this.socket.on(util.MESSAGE_TYPES.LEAVE.key, peerId => {
      util.log(`Received leave message from ${peerId}`);
      this._cleanupPeer(peerId);
    });

    this.socket.on(util.MESSAGE_TYPES.EXPIRE.key, peerId => {
      this.emitError(
        'peer-unavailable',
        `Could not connect to peer ${peerId}`
      );
    });

    this.socket.on(util.MESSAGE_TYPES.OFFER.key, offerMessage => {
      const connectionId = offerMessage.connectionId;
      let connection = this.getConnection(offerMessage.src, connectionId);

      if (connection) {
        util.warn('Offer received for existing Connection ID:', connectionId);
        return;
      }

      if (offerMessage.connectionType === 'media') {
        connection = new MediaConnection(
          offerMessage.src,
          {
            connectionId:   connectionId,
            payload:        offerMessage,
            metadata:       offerMessage.metadata,
            queuedMessages: this._queuedMessages[connectionId],
            pcConfig:       this._pcConfig
          }
        );

        util.log('MediaConnection created in OFFER');
        this._addConnection(offerMessage.src, connection);
        this.emit(Peer.EVENTS.call.key, connection);
      } else if (offerMessage.connectionType === 'data') {
        connection = new DataConnection(
          offerMessage.src,
          {
            connectionId:   connectionId,
            payload:        offerMessage,
            metadata:       offerMessage.metadata,
            label:          offerMessage.label,
            serialization:  offerMessage.serialization,
            queuedMessages: this._queuedMessages[connectionId],
            pcConfig:       this._pcConfig
          }
        );

        util.log('DataConnection created in OFFER');
        this._addConnection(offerMessage.src, connection);
        this.emit(Peer.EVENTS.connection.key, connection);
      } else {
        util.warn('Received malformed connection type: ', offerMessage.connectionType);
      }

      delete this._queuedMessages[connectionId];
    });

    this.socket.on(util.MESSAGE_TYPES.ROOM_OFFER.key, offerMessage => {
      // We want the Room class to handle this instead
      // The Room class acts as RoomConnection
      this.rooms[offerMessage.roomName].handleOffer(offerMessage.offer);
      this.rooms[offerMessage.roomName].updateMsidMap(offerMessage.msids);
      // NOTE: Room has already been created and added to this.rooms
    });

    this.socket.on(util.MESSAGE_TYPES.ANSWER.key, answerMessage => {
      const connection = this.getConnection(
                            answerMessage.src,
                            answerMessage.connectionId
                          );

      if (connection) {
        connection.handleAnswer(answerMessage);
      } else {
        this._storeMessage(util.MESSAGE_TYPES.ANSWER.key, answerMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.CANDIDATE.key, candidateMessage => {
      const connection = this.getConnection(
                            candidateMessage.src,
                            candidateMessage.connectionId
                          );

      if (connection) {
        connection.handleCandidate(candidateMessage);
      } else {
        this._storeMessage(util.MESSAGE_TYPES.CANDIDATE.key, candidateMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.ROOM_USER_JOIN.key, roomUserJoinMessage => {
      const room = this.rooms[roomUserJoinMessage.roomName];
      if (room) {
        room.handleJoin(roomUserJoinMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.ROOM_USER_LEAVE.key, roomUserLeaveMessage => {
      const room = this.rooms[roomUserLeaveMessage.roomName];
      if (room) {
        room.handleLeave(roomUserLeaveMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.ROOM_DATA.key, roomDataMessage => {
      const room = this.rooms[roomDataMessage.roomName];
      if (room) {
        room.handleData(roomDataMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.ROOM_LOG.key, roomLogMessage => {
      const room = this.rooms[roomLogMessage.roomName];
      if (room) {
        room.handleLog(roomLogMessage.log);
      }
    });
  }

  /**
   * Add connection to connections property and set up message handlers.
   * @param {string} peerId - User's peerId.
   * @param {MediaConnection|DataConnection} connection - The connection to be added.
   * @private
   */
  _addConnection(peerId, connection) {
    if (!this.connections[peerId]) {
      this.connections[peerId] = [];
    }
    this.connections[peerId].push(connection);

    this._setupConnectionMessageHandlers(connection);
  }

  /**
   * Set up connection's event handlers.
   * @param {MediaConnection|DataConnection} connection - The connection to be set up.
   * @private
   */
  _setupConnectionMessageHandlers(connection) {
    connection.on(Connection.EVENTS.candidate.key, candidateMessage => {
      this.socket.send(util.MESSAGE_TYPES.CANDIDATE.key, candidateMessage);
    });
    connection.on(Connection.EVENTS.answer.key, answerMessage => {
      this.socket.send(util.MESSAGE_TYPES.ANSWER.key, answerMessage);
    });
    connection.on(Connection.EVENTS.offer.key, offerMessage => {
      this.socket.send(util.MESSAGE_TYPES.OFFER.key, offerMessage);
    });
  }

  /**
   * Store a message until the connection is ready.
   * @param {string} type - The type of message. One of 'ANSWER' or 'CANDIDATE'.
   * @param {object} message - The object containing the message from remote peer.
   * @private
   */
  _storeMessage(type, message) {
    if (!this._queuedMessages[message.connectionId]) {
      this._queuedMessages[message.connectionId] = [];
    }
    this._queuedMessages[message.connectionId]
      .push({type: type, payload: message});
  }

  /**
   * Close all connections and emit close event.
   * @private
   */
  _cleanup() {
    if (this.connections) {
      for (let peer of Object.keys(this.connections)) {
        this._cleanupPeer(peer);
      }
    }
    this.emit(Peer.EVENTS.close.key);
  }

  /**
   * Close the connection.
   * @param {string} peer - The peerId of the peer to be closed.
   * @private
   */
  _cleanupPeer(peer) {
    if (this.connections[peer]) {
      for (let connection of this.connections[peer]) {
        connection.close();
      }
    }
  }

  /**
   * Events the Peer class can emit.
   * @type {Enum}
   */
  static get EVENTS() {
    return PeerEvents;
  }

  /**
   * Socket opened.
   *
   * @event Peer#open
   * @type {string}
   */

  /**
   * Error occurred.
   *
   * @event Peer#error
   * @type {MediaStream}
   */

  /**
   * MediaConnection created.
   *
   * @event Peer#call
   * @type {MediaConnection}
   */

  /**
   * DataConnection created.
   *
   * @event Peer#connection
   * @type {DataConnection}
   */

  /**
   * All connections closed.
   *
   * @event Peer#close
   */

  /**
   * Socket closed.
   *
   * @event Peer#disconnected
   * @type {string}
   */

}

module.exports = Peer;
