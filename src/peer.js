'use strict';

const Connection      = require('./connection');
const DataConnection  = require('./dataConnection');
const MediaConnection = require('./mediaConnection');
const SFURoom         = require('./sfuRoom');
const MeshRoom        = require('./meshRoom');
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
   * @param {number} [options.debug=0] - Log level. NONE:0, ERROR:1, WARN:2, FULL:3.
   * @param {string} [options.host='skyway.io'] - The host name of signaling server.
   * @param {number} [options.port=443] - The port number of signaling server.
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

    if (this.options.host === util.CLOUD_HOST) {
      this.options.secure = true;
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
   * Creates new MediaConnection.
   * @param {string} peerId - The peerId of the peer you are connecting to.
   * @param {MediaStream} [stream] - The MediaStream to send to the remote peer.
   *                               If not set, the caller creates offer SDP with `sendonly` attribute.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {string} [options.connectionId] - An ID to uniquely identify the connection.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {string} [options.queuedMessages] - An array of messages that were already
   *                  received before the connection was created.
   * @param {string} [options.payload] - An offer message that triggered creating this object.
   * @return {MediaConnection} An instance of MediaConnection.
   */
  call(peerId, stream, options) {
    if (this._disconnectCalled) {
      util.warn('You cannot connect to a new Peer because you called ' +
        '.disconnect() on this Peer and ended your connection with the ' +
        'server. You can create a new Peer to reconnect, or call reconnect ' +
        'on this peer if you believe its ID to still be available.');
      util.emitError.call(
        this,
        'disconnected',
        'Cannot connect to new Peer after disconnecting from server.');
      return null;
    }

    options = options || {};
    options.originator = true;
    options.stream = stream;
    options.pcConfig = this._pcConfig;
    const mc = new MediaConnection(peerId, options);
    util.log('MediaConnection created in call method');
    this._addConnection(peerId, mc);
    return mc;
  }

  /**
   * Creates new DataConnection.
   * @param {string} peerId - User's peerId.
   * @param {Object} [options] - Optional arguments for DataConnection.
   * @param {string} [options.connectionId] - An ID to uniquely identify the connection.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {string} [options.serialization] - How to serialize data when sending.
   *                  One of 'binary', 'json' or 'none'.
   * @param {string} [options.queuedMessages] - An array of messages that were already
   *                  received before the connection was created.
   * @param {string} [options.payload] - An offer message that triggered creating this object.
   * @return {DataConnection} An instance of DataConnection.
   */
  connect(peerId, options) {
    if (this._disconnectCalled) {
      util.warn('You cannot connect to a new Peer because you called ' +
        '.disconnect() on this Peer and ended your connection with the ' +
        'server. You can create a new Peer to reconnect, or call reconnect ' +
        'on this peer if you believe its ID to still be available.');
      util.emitError.call(
        this,
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
   * Join fullmesh type or SFU type room that two or more users can join.
   * @param {string} roomName - The name of the room user is joining to.
   * @param {object} [roomOptions]- Optional arguments for the RTCPeerConnection.
   * @param {string} [roomOptions.mode='mesh'] - One of 'sfu' or 'mesh'.
   * @param {MesiaStream} [roomOptions.stream] - Media stream user wants to emit.
   * @return {SFURoom|MeshRoom} - An instance of SFURoom or MeshRoom.
   */
  joinRoom(roomName, roomOptions = {}) {
    if (!roomName) {
      util.emitError.call(this, 'room-error', 'Room name must be defined.');
      return null;
    }

    roomOptions.pcConfig = this._pcConfig;
    roomOptions.peerId = this.id;

    if (roomOptions.mode === 'sfu') {
      return this._initializeSfuRoom(roomName, roomOptions);
    }

    // mode is blank or 'mesh'
    return this._initializeFullMeshRoom(roomName, roomOptions);
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
   * Reconnect to SkyWay server. Does not work after a peer.destroy().
   */
  reconnect() {
    if (this._disconnectCalled && !this._destroyCalled) {
      this._disconnectCalled = false;
      this.socket.reconnect();
    }
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
              `${this.options.port}/api/apikeys/${this.options.key}/clients/`;

    // If there's no ID we need to wait for one before trying to init socket.
    http.open('get', url, true);

    /* istanbul ignore next */
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
        util.emitError.call(this, 'socket-error', 'Lost connection to server.');
      }
    });

    this.socket.start(id, this.options.token);

    window.onbeforeunload = () => {
      this.destroy();
    };
  }

  /**
   * Create and setup a SFURoom instance and emit SFU_JOIN message to SkyWay server.
   * If user called joinRoom with a MediaStream, it call sfuRoom.call with it.
   * @param {string} roomName - The name of the room user is joining to.
   * @param {object} [roomOptions] - Optional arguments for the RTCPeerConnection.
   * @param {object} [roomOptions.pcConfig] -  A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {string} [roomOptions.peerId] - User's peerId.
   * @param {string} [roomOptions.mode='mesh'] - One of 'sfu' or 'mesh'.
   * @param {MediaStream} [roomOptions.stream] - Media stream user wants to emit.
   * @return {SFURoom} - An instance of SFURoom.
   */
  _initializeSfuRoom(roomName, roomOptions = {}) {
    if (this.rooms[roomName]) {
      return this.rooms[roomName];
    }
    const sfuRoom = new SFURoom(roomName, this.id, roomOptions);
    this.rooms[roomName] = sfuRoom;
    this._setupSFURoomMessageHandlers(sfuRoom);

    const data = {
      roomName:    roomName,
      roomOptions: roomOptions
    };

    this.socket.send(util.MESSAGE_TYPES.SFU_JOIN.key, data);

    if (roomOptions.stream) {
      sfuRoom.call();
    }
    return sfuRoom;
  }

  /**
   * Create and setup a MeshRoom instance and emit MESH_JOIN message to SkyWay server.
   * If user called joinRoom with a MediaStream, it call meshRoom.call with it.
   * @param {string} roomName - The name of the room user is joining to.
   * @param {object} roomOptions - Optional arguments for the RTCPeerConnection.
   * @param {string} roomOptions.pcConfig -  A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {string} roomOptions.peerId - User's peerId.
   * @param {string} [roomOptions.mode='mesh'] - One of 'sfu' or 'mesh'.
   * @param {MediaStream} [roomOptions.stream] - Media stream user wants to emit.
   * @return {SFURoom} - An instance of MeshRoom.
   */
  _initializeFullMeshRoom(roomName, roomOptions = {}) {
    if (this.rooms[roomName]) {
      return this.rooms[roomName];
    }
    const meshRoom = new MeshRoom(roomName, this.id, roomOptions);
    this.rooms[roomName] = meshRoom;
    this._setupMeshRoomMessageHandlers(meshRoom);

    const data = {
      roomName:    roomName,
      roomOptions: roomOptions
    };

    this.socket.send(util.MESSAGE_TYPES.MESH_JOIN.key, data);

    if (roomOptions.stream) {
      meshRoom.call();
    }
    return meshRoom;
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
      this._abort(error.type, error.message);
    });

    this.socket.on(util.MESSAGE_TYPES.LEAVE.key, peerId => {
      util.log(`Received leave message from ${peerId}`);
      this._cleanupPeer(peerId);
    });

    this.socket.on(util.MESSAGE_TYPES.EXPIRE.key, peerId => {
      util.emitError.call(
        this,
        'peer-unavailable',
        `Could not connect to peer ${peerId}`
      );
    });

    this.socket.on(util.MESSAGE_TYPES.OFFER.key, offerMessage => {
      const connectionId = offerMessage.connectionId;
      let connection = this.getConnection(offerMessage.src, connectionId);

      if (connection) {
        connection.updateOffer(offerMessage);
        return;
      }

      if (offerMessage.connectionType === 'media') {
        connection = new MediaConnection(
          offerMessage.src,
          {
            connectionId:   connectionId,
            payload:        offerMessage,
            metadata:       offerMessage.metadata,
            originator:     false,
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

    // SFU

    this.socket.on(util.MESSAGE_TYPES.SFU_USER_JOIN.key, roomUserJoinMessage => {
      const room = this.rooms[roomUserJoinMessage.roomName];
      if (room) {
        room.handleJoin(roomUserJoinMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SFU_OFFER.key, offerMessage => {
      const room = this.rooms[offerMessage.roomName];
      if (room) {
        room.updateMsidMap(offerMessage.msids);
        room.handleOffer(offerMessage.offer);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SFU_USER_LEAVE.key, roomUserLeaveMessage => {
      const room = this.rooms[roomUserLeaveMessage.roomName];
      if (room) {
        room.handleLeave(roomUserLeaveMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SFU_DATA.key, roomDataMessage => {
      const room = this.rooms[roomDataMessage.roomName];
      if (room) {
        room.handleData(roomDataMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SFU_LOG.key, roomLogMessage => {
      const room = this.rooms[roomLogMessage.roomName];
      if (room) {
        room.handleLog(roomLogMessage.log);
      }
    });

    // MESH

    this.socket.on(util.MESSAGE_TYPES.MESH_USER_LIST.key, roomUserListMessage => {
      const room = this.rooms[roomUserListMessage.roomName];
      if (room) {
        if (roomUserListMessage.type === 'media') {
          room.makeMediaConnections(roomUserListMessage.userList);
        } else {
          room.makeDataConnections(roomUserListMessage.userList);
        }
      }
    });

    this.socket.on(util.MESSAGE_TYPES.MESH_USER_JOIN.key, roomUserJoinMessage => {
      const room = this.rooms[roomUserJoinMessage.roomName];
      if (room) {
        room.handleJoin(roomUserJoinMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.MESH_OFFER.key, offerMessage => {
      const room = this.rooms[offerMessage.roomName];
      if (room) {
        room.handleOffer(offerMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.MESH_ANSWER.key, answerMessage => {
      const room = this.rooms[answerMessage.roomName];
      if (room) {
        room.handleAnswer(answerMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.MESH_CANDIDATE.key, candidateMessage => {
      const room = this.rooms[candidateMessage.roomName];
      if (room) {
        room.handleCandidate(candidateMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.MESH_DATA.key, roomDataMessage => {
      const room = this.rooms[roomDataMessage.roomName];
      if (room) {
        room.handleData(roomDataMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.MESH_LOG.key, roomLogMessage => {
      const room = this.rooms[roomLogMessage.roomName];
      if (room) {
        room.handleLog(roomLogMessage.log);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.MESH_USER_LEAVE.key, roomUserLeaveMessage => {
      const room = this.rooms[roomUserLeaveMessage.roomName];
      if (room) {
        room.handleLeave(roomUserLeaveMessage);
      }
    });
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
   * Set up the message event handlers for an SFURoom
   * @param {SFURoom} room - The room to be set up.
   * @private
   */
  _setupSFURoomMessageHandlers(room) {
    room.on(SFURoom.MESSAGE_EVENTS.offerRequest.key, sendMessage => {
      this.socket.send(util.MESSAGE_TYPES.SFU_OFFER_REQUEST.key, sendMessage);
    });
    room.on(SFURoom.MESSAGE_EVENTS.answer.key, answerMessage => {
      this.socket.send(util.MESSAGE_TYPES.SFU_ANSWER.key, answerMessage);
    });
    room.on(SFURoom.MESSAGE_EVENTS.broadcast.key, sendMessage => {
      this.socket.send(util.MESSAGE_TYPES.SFU_DATA.key, sendMessage);
    });
    room.on(SFURoom.MESSAGE_EVENTS.getLog.key, getLogMessage => {
      this.socket.send(util.MESSAGE_TYPES.SFU_LOG.key, getLogMessage);
    });
    room.on(SFURoom.MESSAGE_EVENTS.leave.key, leaveMessage => {
      delete this.rooms[room.name];
      this.socket.send(util.MESSAGE_TYPES.SFU_LEAVE.key, leaveMessage);
    });
  }

  /**
   * Set up the message event handlers for a MeshRoom
   * @param {MeshRoom} room - The room to be set up.
   * @private
   */
  _setupMeshRoomMessageHandlers(room) {
    room.on(MeshRoom.MESSAGE_EVENTS.offer.key, offerMessage => {
      this.socket.send(util.MESSAGE_TYPES.MESH_OFFER.key, offerMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.answer.key, answerMessage => {
      this.socket.send(util.MESSAGE_TYPES.MESH_ANSWER.key, answerMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.candidate.key, candidateMessage => {
      this.socket.send(util.MESSAGE_TYPES.MESH_CANDIDATE.key, candidateMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.getPeers.key, requestMessage => {
      this.socket.send(util.MESSAGE_TYPES.MESH_USER_LIST_REQUEST.key, requestMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.broadcastByWS.key, sendMessage => {
      this.socket.send(util.MESSAGE_TYPES.MESH_DATA.key, sendMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.getLog.key, getLogMessage => {
      this.socket.send(util.MESSAGE_TYPES.MESH_LOG.key, getLogMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.leave.key, leaveMessage => {
      delete this.rooms[room.name];
      this.socket.send(util.MESSAGE_TYPES.MESH_LEAVE.key, leaveMessage);
    });
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
    util.emitError.call(this, type, message);
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
   * Successfully connected to signaling server.
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
   * Received a call from peer.
   *
   * @event Peer#call
   * @type {MediaConnection}
   */

  /**
   * Received a connection from peer.
   *
   * @event Peer#connection
   * @type {DataConnection}
   */

  /**
   * Finished closing all connections to peers.
   *
   * @event Peer#close
   */

  /**
   * Disconnected from the signalling server.
   *
   * @event Peer#disconnected
   * @type {string}
   */

}

module.exports = Peer;
