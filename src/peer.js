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

    this.connections = {};
    this.rooms = {};

    // messages received before connection is ready
    this._queuedMessages = {};

    if (id && id.constructor === Object) {
      options = id;
      id = undefined;
    } else if (id) {
      id = id.toString();
    }

    // TODO: util.CLOUD_HOST/PORT will be removed after Dispatcher is stable
    const defaultOptions = {
      debug:  util.LOG_LEVELS.NONE,
      host:   util.CLOUD_HOST,
      port:   util.CLOUD_PORT,
      secure: true,
      token:  util.randomToken(),
      config: util.defaultConfig,
      turn:   true
    };

    this.options = Object.assign({}, defaultOptions, options);

    util.setLogLevel(this.options.debug);

    if (!util.validateId(id)) {
      this._abort('invalid-id', `ID "${id}" is invalid`);
      return;
    }

    if (!util.validateKey(options.key)) {
      this._abort('invalid-key', `API KEY "${this.options.key}" is invalid`);
      return;
    }

    // if signaling server option is not provided, get from dispatcher
    if (!options.host || !options.port) {
      util.getSignalingServer().then(res => {
        Object.assign(this.options, res);
        this._initializeServerConnection(id);
      }).catch(err => {
        util.log(err);
        this._initializeServerConnection(id);
      });
    } else {
      if (this.options.host === '/') {
        this.options.host = window.location.hostname;
      }
      if (options.secure === undefined && this.options.port !== 443) {
        this.options.secure = undefined;
      }
      this._initializeServerConnection(id);
    }
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
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   * @return {MediaConnection} An instance of MediaConnection.
   */
  call(peerId, stream, options = {}) {
    if (!this._checkOpenStatus()) {
      return;
    }

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
  connect(peerId, options = {}) {
    if (!this._checkOpenStatus()) {
      return;
    }

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
   * @param {MediaStream} [roomOptions.stream] - Media stream user wants to emit.
   * @param {number} [roomOptions.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [roomOptions.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [roomOptions.videoCodec] - A video codec like 'H264'
   * @param {string} [roomOptions.audioCodec] - A video codec like 'PCMU'
   * @return {SFURoom|MeshRoom} - An instance of SFURoom or MeshRoom.
   */
  joinRoom(roomName, roomOptions = {}) {
    if (!this._checkOpenStatus()) {
      return;
    }

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
    if (!this._checkOpenStatus()) {
      return;
    }

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
   * Whether the socket is connecting to the signalling server or not.
   * @type {boolean} The open status.
   */
  get open() {
    return this.socket.isOpen;
  }

  /**
   * Close all connections and disconnect socket.
   */
  destroy() {
    this._cleanup();
    this.disconnect();
  }

  /**
   * Close socket and clean up some properties, then emit disconnect event.
   */
  disconnect() {
    if (this.open) {
      this.socket.close();
      this.emit(Peer.EVENTS.disconnected.key, this.id);
    }
  }

  /**
   * Reconnect to SkyWay server. Does not work after a peer.destroy().
   */
  reconnect() {
    if (!this.open) {
      this.socket.reconnect();
    }
  }

  /**
   * Call Rest API and get the list of peerIds assciated with API key.
   * @param {function} cb - The callback function that is called after XHR.
   */
  listAllPeers(cb) {
    if (!this._checkOpenStatus()) {
      return;
    }

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
   * Return socket open status and emit error when it's not open.
   * @return {boolean} - The socket status.
   */
  _checkOpenStatus() {
    if (!this.open) {
      this._emitNotConnectedError();
    }
    return this.open;
  }

  /**
   * Emit not connected error.
   */
  _emitNotConnectedError() {
    util.warn('You cannot connect to a new Peer because you are not connecting to SkyWay server now.' +
      'You can create a new Peer to reconnect, or call reconnect() ' +
      'on this peer if you believe its ID to still be available.');
    util.emitError.call(
      this,
      'disconnected',
      'Cannot connect to new Peer before connecting to SkyWay server or after disconnecting from the server.');
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
      this.disconnect();
      util.emitError.call(this, 'socket-error', 'Lost connection to server.');
    });

    this.socket.start(id, this.options.token);

    window.onbeforeunload = () => {
      this.destroy();
    };
  }

  /**
   * Create and setup a SFURoom instance and emit SFU_JOIN message to SkyWay server.
   * @param {string} roomName - The name of the room user is joining to.
   * @param {object} [roomOptions] - Optional arguments for the RTCPeerConnection.
   * @param {object} [roomOptions.pcConfig] -  A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {string} [roomOptions.peerId] - User's peerId.
   * @param {string} [roomOptions.mode='mesh'] - One of 'sfu' or 'mesh'.
   * @param {MediaStream} [roomOptions.stream] - Media stream user wants to emit.
   * @param {number} [roomOptions.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [roomOptions.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [roomOptions.videoCodec] - A video codec like 'H264'
   * @param {string} [roomOptions.audioCodec] - A video codec like 'PCMU'
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
      roomName: roomName,
      roomType: 'sfu'
    };

    this.socket.send(util.MESSAGE_TYPES.CLIENT.ROOM_JOIN.key, data);

    return sfuRoom;
  }

  /**
   * Create and setup a MeshRoom instance and emit MESH_JOIN message to SkyWay server.
   * @param {string} roomName - The name of the room user is joining to.
   * @param {object} roomOptions - Optional arguments for the RTCPeerConnection.
   * @param {string} roomOptions.pcConfig -  A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {string} roomOptions.peerId - User's peerId.
   * @param {string} [roomOptions.mode='mesh'] - One of 'sfu' or 'mesh'.
   * @param {MediaStream} [roomOptions.stream] - Media stream user wants to emit.
   * @param {number} [roomOptions.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [roomOptions.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [roomOptions.videoCodec] - A video codec like 'H264'
   * @param {string} [roomOptions.audioCodec] - A video codec like 'PCMU'
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
      roomName: roomName,
      roomType: 'mesh'
    };

    this.socket.send(util.MESSAGE_TYPES.CLIENT.ROOM_JOIN.key, data);

    return meshRoom;
  }

  /**
   * Set up socket's message handlers.
   * @private
   */
  _setupMessageHandlers() {
    this.socket.on(util.MESSAGE_TYPES.SERVER.OPEN.key, openMessage => {
      this.id = openMessage.peerId;
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

    this.socket.on(util.MESSAGE_TYPES.SERVER.ERROR.key, error => {
      util.emitError.call(this, error.type, error.message);
    });

    this.socket.on(util.MESSAGE_TYPES.SERVER.LEAVE.key, peerId => {
      util.log(`Received leave message from ${peerId}`);
      this._cleanupPeer(peerId);
    });

    this.socket.on(util.MESSAGE_TYPES.SERVER.OFFER.key, offerMessage => {
      // handle mesh room offers
      const roomName = offerMessage.roomName;
      if (roomName) {
        const room = this.rooms[roomName];

        if (room) {
          room.handleOffer(offerMessage);
        }
        return;
      }

      // handle p2p offers
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

    this.socket.on(util.MESSAGE_TYPES.SERVER.ANSWER.key, answerMessage => {
      // handle mesh room answers
      const roomName = answerMessage.roomName;
      if (roomName) {
        const room = this.rooms[roomName];

        if (room) {
          room.handleAnswer(answerMessage);
        }
        return;
      }

      // handle p2p answers
      const connection = this.getConnection(
        answerMessage.src,
        answerMessage.connectionId
      );

      if (connection) {
        connection.handleAnswer(answerMessage);
      } else {
        this._storeMessage(util.MESSAGE_TYPES.SERVER.ANSWER.key, answerMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SERVER.CANDIDATE.key, candidateMessage => {
      // handle mesh room candidates
      const roomName = candidateMessage.roomName;
      if (roomName) {
        const room = this.rooms[roomName];

        if (room) {
          room.handleCandidate(candidateMessage);
        }
        return;
      }

      // handle p2p candidates
      const connection = this.getConnection(
        candidateMessage.src,
        candidateMessage.connectionId
      );

      if (connection) {
        connection.handleCandidate(candidateMessage);
      } else {
        this._storeMessage(util.MESSAGE_TYPES.SERVER.CANDIDATE.key, candidateMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SERVER.ROOM_USER_JOIN.key, roomUserJoinMessage => {
      const room = this.rooms[roomUserJoinMessage.roomName];
      if (room) {
        room.handleJoin(roomUserJoinMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SERVER.ROOM_USER_LEAVE.key, roomUserLeaveMessage => {
      const room = this.rooms[roomUserLeaveMessage.roomName];
      if (room) {
        room.handleLeave(roomUserLeaveMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SERVER.ROOM_DATA.key, roomDataMessage => {
      const room = this.rooms[roomDataMessage.roomName];
      if (room) {
        room.handleData(roomDataMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SERVER.ROOM_LOGS.key, roomLogMessage => {
      const room = this.rooms[roomLogMessage.roomName];
      if (room) {
        room.handleLog(roomLogMessage.log);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SERVER.ROOM_USERS.key, roomUserListMessage => {
      const room = this.rooms[roomUserListMessage.roomName];
      if (room) {
        if (roomUserListMessage.type === 'media') {
          room.makeMediaConnections(roomUserListMessage.userList);
        } else {
          room.makeDataConnections(roomUserListMessage.userList);
        }
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SERVER.SFU_OFFER.key, offerMessage => {
      const room = this.rooms[offerMessage.roomName];
      if (room) {
        room.updateMsidMap(offerMessage.msids);
        room.handleOffer(offerMessage);
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
      this.socket.send(util.MESSAGE_TYPES.CLIENT.SEND_CANDIDATE.key, candidateMessage);
    });
    connection.on(Connection.EVENTS.answer.key, answerMessage => {
      this.socket.send(util.MESSAGE_TYPES.CLIENT.SEND_ANSWER.key, answerMessage);
    });
    connection.on(Connection.EVENTS.offer.key, offerMessage => {
      this.socket.send(util.MESSAGE_TYPES.CLIENT.SEND_OFFER.key, offerMessage);
    });
  }

  /**
   * Set up the message event handlers for a Room
   * @param {Room} room - The room to be set up.
   * @private
   */
  _setupRoomMessageHandlers(room) {
    room.on(SFURoom.MESSAGE_EVENTS.broadcast.key, sendMessage => {
      this.socket.send(util.MESSAGE_TYPES.CLIENT.ROOM_SEND_DATA.key, sendMessage);
    });
    room.on(SFURoom.MESSAGE_EVENTS.getLog.key, getLogMessage => {
      this.socket.send(util.MESSAGE_TYPES.CLIENT.ROOM_GET_LOGS.key, getLogMessage);
    });
    room.on(SFURoom.MESSAGE_EVENTS.leave.key, leaveMessage => {
      delete this.rooms[room.name];
      this.socket.send(util.MESSAGE_TYPES.CLIENT.ROOM_LEAVE.key, leaveMessage);
    });
  }

  /**
   * Set up the message event handlers for an SFURoom
   * @param {SFURoom} room - The room to be set up.
   * @private
   */
  _setupSFURoomMessageHandlers(room) {
    this._setupRoomMessageHandlers(room);

    room.on(SFURoom.MESSAGE_EVENTS.offerRequest.key, sendMessage => {
      this.socket.send(util.MESSAGE_TYPES.CLIENT.SFU_GET_OFFER.key, sendMessage);
    });
    room.on(SFURoom.MESSAGE_EVENTS.answer.key, answerMessage => {
      this.socket.send(util.MESSAGE_TYPES.CLIENT.SFU_ANSWER.key, answerMessage);
    });
  }

  /**
   * Set up the message event handlers for a MeshRoom
   * @param {MeshRoom} room - The room to be set up.
   * @private
   */
  _setupMeshRoomMessageHandlers(room) {
    this._setupRoomMessageHandlers(room);

    room.on(MeshRoom.MESSAGE_EVENTS.offer.key, offerMessage => {
      this.socket.send(util.MESSAGE_TYPES.CLIENT.SEND_OFFER.key, offerMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.answer.key, answerMessage => {
      this.socket.send(util.MESSAGE_TYPES.CLIENT.SEND_ANSWER.key, answerMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.candidate.key, candidateMessage => {
      this.socket.send(util.MESSAGE_TYPES.CLIENT.SEND_CANDIDATE.key, candidateMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.getPeers.key, requestMessage => {
      this.socket.send(util.MESSAGE_TYPES.CLIENT.ROOM_GET_USERS.key, requestMessage);
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
