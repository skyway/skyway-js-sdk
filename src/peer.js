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

class Peer extends EventEmitter {
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
   * Join fullmesh type or SFU type room that two or more users can join.
   * @param {string} roomName - The name of the room user is joining to.
   * @param {object} [roomOptions]- Optional arguments for the RTCPeerConnection.
   * @param {string} [roomOptions.mode='mesh'] - One of 'sfu' or 'mesh'.
   * @param {MesiaStream} [roomOptions.stream] - Media stream user wants to emit.
   * @return {SFURoom|MeshRoom} - An instance of SFURoom or MeshRoom.
   */
  joinRoom(roomName, roomOptions = {}) {
    if (!roomName) {
      this.emitError('room-error', 'Room name must be defined.');
      return null;
    }

    roomOptions.pcConfig = this._pcConfig;
    roomOptions.peerId = this.id;

    if (roomOptions.mode === 'sfu') {
      return this._initSfuRoom(roomName, roomOptions);
    }

    // mode is blank or 'mesh'
    return this._initFullMeshRoom(roomName, roomOptions);
  }

  /**
   * Create and setup a SFURoom instance and emit SFU_JOIN message to SkyWay server.
   * If user called joinRoom with a MediaStream, it call sfuRoom.call with it.
   * @param {string} roomName - The name of the room user is joining to.
   * @param {object} roomOptions- Optional arguments for the RTCPeerConnection.
   * @param {string} roomOptions.pcConfig -  A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {string} roomOptions.peerId - User's peerId.
   * @param {string} [roomOptions.mode='mesh'] - One of 'sfu' or 'mesh'.
   * @param {MesiaStream} [roomOptions.stream] - Media stream user wants to emit.
   * @return {SFURoom} - An instance of SFURoom.
   */
  _initSfuRoom(roomName, roomOptions) {
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
      sfuRoom.call(sfuRoom.localStream);
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
   * @param {MesiaStream} [roomOptions.stream] - Media stream user wants to emit.
   * @return {SFURoom} - An instance of MeshRoom.
   */
  _initFullMeshRoom(roomName, roomOptions) {
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
      meshRoom.call(meshRoom.localStream);
    }
    return meshRoom;
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
    this.emit(Peer.EVENTS.error.key, err);
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

        this.emit(Peer.EVENTS.disconnected.key, this.id);
        this._lastPeerId = this.id;
        this.id = null;
      }
    }, 0);
  }

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
        let options = {};
        options.pcConfig = this._pcConfig;
        if (roomUserListMessage.type === 'media') {
          room.makeMCs(roomUserListMessage.userList, options);
        } else {
          room.makeDCs(roomUserListMessage.userList, options);
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
      room.handleAnswer(answerMessage);
    });

    this.socket.on(util.MESSAGE_TYPES.MESH_CANDIDATE.key, candidateMessage => {
      const room = this.rooms[candidateMessage.roomName];
      room.handleCandidate(candidateMessage);
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

  _addConnection(peerId, connection) {
    if (!this.connections[peerId]) {
      this.connections[peerId] = [];
    }
    this.connections[peerId].push(connection);

    this._setupConnectionMessageHandlers(connection);
  }

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

  _storeMessage(type, message) {
    if (!this._queuedMessages[message.connectionId]) {
      this._queuedMessages[message.connectionId] = [];
    }
    this._queuedMessages[message.connectionId]
      .push({type: type, payload: message});
  }

  _cleanup() {
    if (this.connections) {
      for (let peer of Object.keys(this.connections)) {
        this._cleanupPeer(peer);
      }
    }
    this.emit(Peer.EVENTS.close.key);
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
