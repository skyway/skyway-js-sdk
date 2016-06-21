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
  /**
   * Creates an peer. It's called by user application.
   * @param {string} [id] - own peerID.
   * @param {Object} options - @@@@
   * @param {string} options.key - API key.
   * @param {Integer} [options.debug=util.LOG_LEVELS.NONE] - @@@
   * @param {string} [options.host=util.CLOUD_HOST] - @@@
   * @param {Object} [options.port=util.CLOUD_PORT] - @@@
   * @param {Object} [options.token=util.randomToken()] - @@@
   * @param {Object} [options.config=util.defaultConfig] - @@@
   * @param {Object} [options.turn=true] - @@@
   */
  constructor(id, options) {
    super();

    // true when connected to SkyWay server
    this.open = false;
    this.connections = {};
    this.meshRooms = {};
    this.sfuRooms = {};

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
   * @param {string} peerId - @@@
   * @param {Object} [options] - @@@@
   * @param {string} [options.label] - @@@@
   * @param {string} [options.metadata] - @@@@
   * @param {string} [options.serialization] - @@@@
   * @param {boolean} [options.reliable] - @@@@
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
   * @param {string} peerId - @@@
   * @param {MediaStream} stream - @@@
   * @param {Object} options - @@@@
   * @param {Object} [options.label] - @@@@
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
    options._stream = stream;
    options.pcConfig = this._pcConfig;
    const mc = new MediaConnection(peerId, options);
    util.log('MediaConnection created in call method');
    this._addConnection(peerId, mc);
    return mc;
  }

  /**
   * Creates new MeshRoom or SFURoom. If roomOptions has a stream, it calls callRoom.
   * @param {string} roomName - @@@
   * @param {Object} roomOptions - @@@@
   */
  joinRoom(roomName, roomOptions) {
    if (!roomName) {
      this.emitError('room-error', 'Room name must be defined.');
      return null;
    }

    if (!roomOptions) {
      roomOptions = {};
    }
    roomOptions.pcConfig = this._pcConfig;

    const data = {
      roomName:    roomName,
      roomOptions: roomOptions
    };

    if(roomOptions.mode === 'sfu'){
      if (this.sfuRooms[roomName]) {
        return this.sfuRooms[roomName];
      }
      const sfuRoom = new SFURoom(roomName, roomOptions);
      this.sfuRooms[roomName] = sfuRoom;
      this._setupSFURoomMessageHandlers(sfuRoom);

      this.socket.send(util.MESSAGE_TYPES.SFU_JOIN.key, data);

      if(sfuRoom.localStream) {
        sfuRoom.callRoom(sfuRoom.localStream)
      }

      return sfuRoom;

    }else{
      if (this.meshRooms[roomName]) {
        return this.meshRooms[roomName];
      }
      roomOptions.peerId = roomOptions.peerId || this.id;
      const meshRoom = new MeshRoom(roomName, roomOptions);
      this.meshRooms[roomName] = meshRoom;
      this._setupMeshRoomMessageHandlers(meshRoom);

      this.socket.send(util.MESSAGE_TYPES.MESH_JOIN.key, data);

      if(meshRoom.localStream) {
        meshRoom.callRoom(meshRoom.localStream)
      }
      return meshRoom;
    }
  }

  /**
   * Returns a connection according to given peerId and connectionId.
   * @param {string} peerId - @@@
   * @param {Object} connectionId - @@@@
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

  emitError(type, err) {
    util.error('Error:', err);
    if (typeof err === 'string') {
      err = new Error(err);
    }

    err.type = type;
    this.emit(Peer.EVENTS.error.key, err);
  }

  /**
   * Destroy
   */
  destroy() {
    if (!this._destroyCalled) {
      this._destroyCalled = true;
      this._cleanup();
      this.disconnect();
    }
  }

  /**
   * Disconnect
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

  _setupSFURoomMessageHandlers(room) {
    room.on(SFURoom.MESSAGE_EVENTS.offer_request.key, sendMessage => {
      this.socket.send(util.MESSAGE_TYPES.SFU_OFFER_REQUEST.key, sendMessage);
    });
    room.on(SFURoom.MESSAGE_EVENTS.broadcast.key, sendMessage => {
      this.socket.send(util.MESSAGE_TYPES.SFU_DATA.key, sendMessage);
    });
    room.on(SFURoom.MESSAGE_EVENTS.leave.key, leaveMessage => {
      delete this.sfuRooms[room.name];
      this.socket.send(util.MESSAGE_TYPES.SFU_LEAVE.key, leaveMessage);
    });
    room.on(SFURoom.MESSAGE_EVENTS.answer.key, answerMessage => {
      this.socket.send(util.MESSAGE_TYPES.SFU_ANSWER.key, answerMessage);
    });
    room.on(SFURoom.MESSAGE_EVENTS.getLog.key, getLogMessage => {
      this.socket.send(util.MESSAGE_TYPES.SFU_LOG.key, getLogMessage);
    });

  }

  _setupMeshRoomMessageHandlers(room) {
    console.log('setup mesh message handler')
    room.on(MeshRoom.MESSAGE_EVENTS.offer.key, offerMessage => {
      console.log('meshRoomManager on offer')
      this.socket.send(util.MESSAGE_TYPES.MESH_OFFER.key, offerMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.answer.key, answerMessage => {
      console.log('meshRoomManager on answer')
      this.socket.send(util.MESSAGE_TYPES.MESH_ANSWER.key, answerMessage);
    })
    room.on(MeshRoom.MESSAGE_EVENTS.candidate.key, candidateMessage => {
      console.log('meshRoomManager on candidate')
      this.socket.send(util.MESSAGE_TYPES.MESH_CANDIDATE.key, candidateMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.getPeers.key, requestMessage => {
      console.log('meshRoomManager on get_peers')
      this.socket.send(util.MESSAGE_TYPES.MESH_USER_LIST_REQUEST.key, requestMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.broadcastByWS.key, sendMessage => {
      console.log('meshRoomManager on broadcastByWS')
      this.socket.send(util.MESSAGE_TYPES.MESH_DATA.key, sendMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.broadcastByDC.key, sendMessage => {
      console.log('meshRoomManager on broadcastByDC')
      this.socket.send(util.MESSAGE_TYPES.MESH_DATA.key, sendMessage);
    });
    room.on(MeshRoom.MESSAGE_EVENTS.getLog.key, getLogMessage => {
      this.socket.send(util.MESSAGE_TYPES.MESH_LOG.key, getLogMessage);
    });
  }

  reconnect() {
  }

  /**
   * listAllPeers
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

  /**
   * Creates new Socket and initalize its message handlers.
   * @param {string} id - peerID.
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
            connectionId:    connectionId,
            _payload:        offerMessage,
            metadata:        offerMessage.metadata,
            _queuedMessages: this._queuedMessages[connectionId],
            pcConfig:        this._pcConfig
          }
        );

        util.log('MediaConnection created in OFFER');
        this._addConnection(offerMessage.src, connection);
        this.emit(Peer.EVENTS.call.key, connection);
      } else if (offerMessage.connectionType === 'data') {
        connection = new DataConnection(
          offerMessage.src,
          {
            connectionId:    connectionId,
            _payload:        offerMessage,
            metadata:        offerMessage.metadata,
            label:           offerMessage.label,
            serialization:   offerMessage.serialization,
            _queuedMessages: this._queuedMessages[connectionId],
            pcConfig:        this._pcConfig
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
      const room = this.sfuRooms[roomUserJoinMessage.roomName];
      if (room) {
        room.handleJoin(roomUserJoinMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SFU_OFFER.key, offerMessage => {
      // We want the Room class to handle this instead
      // The Room class acts as RoomConnection
      this.sfuRooms[offerMessage.roomName].handleOffer(offerMessage.offer);
      // NOTE: Room has already been created and added to this.sruRooms
    });

    this.socket.on(util.MESSAGE_TYPES.SFU_USER_LEAVE.key, roomUserLeaveMessage => {
      const room = this.sfuRooms[roomUserLeaveMessage.roomName];
      if (room) {
        room.handleLeave(roomUserLeaveMessage);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.SFU_DATA.key, roomDataMessage => {
      const room = this.sfuRooms[roomDataMessage.roomName];
      if (room) {
        room.handleData(roomDataMessage);
      }
    });
    this.socket.on(util.MESSAGE_TYPES.SFU_LOG.key, roomLogMessage => {
      const room = this.sfuRooms[roomLogMessage.roomName];
      if (room) {
        room.handleLog(roomLogMessage.log);
      }
    });

    // MESH

    this.socket.on(util.MESSAGE_TYPES.MESH_USER_LIST.key, roomUserListMessage => {
      console.log('socket on MESH_USER_LIST', roomUserListMessage)
      const room = this.meshRooms[roomUserListMessage.roomName];
      if(room.localStream) {
        room.makeCalls(roomUserListMessage.userList);
      }
    });

    this.socket.on(util.MESSAGE_TYPES.MESH_USER_JOIN.key, roomUserJoinMessage => {
      const room = this.meshRooms[roomUserJoinMessage.roomName];
      //add when the client does't have room object.
      if (room) {
        room.handleJoin(roomUserJoinMessage);
      }else {

      }
    });

    this.socket.on(util.MESSAGE_TYPES.MESH_OFFER.key, offerMessage => {
      console.log('socket on MESH_OFFER')
      const room = this.meshRooms[offerMessage.roomName];
      if(room){
        room.handleOffer(offerMessage);
      }else{
        
      }
    });

    this.socket.on(util.MESSAGE_TYPES.MESH_ANSWER.key, answerMessage => {
      console.log('socket on MESH_ANSWER');
      const room = this.meshRooms[answerMessage.roomName];
      room.handleAnswer(answerMessage);
    });

    this.socket.on(util.MESSAGE_TYPES.MESH_CANDIDATE.key, candidateMessage => {
      console.log('socket on MESH_CANDIDATE');
      const room = this.meshRooms[candidateMessage.roomName];
      room.handleCandidate(candidateMessage)
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
