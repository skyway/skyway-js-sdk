import EventEmitter from 'events';
import Enum from 'enum';

import Socket from './peer/socket';
import Connection from './peer/connection';
import DataConnection from './peer/dataConnection';
import MediaConnection from './peer/mediaConnection';
import SFURoom from './peer/sfuRoom';
import MeshRoom from './peer/meshRoom';
import util from './shared/util';
import logger from './shared/logger';
import config from './shared/config';

const PeerEvents = new Enum([
  'open',
  'error',
  'call',
  'connection',
  'expiresin',
  'close',
  'disconnected',
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
   * @param {string} [options.host] - The host name of signaling server.
   * @param {number} [options.port] - The port number of signaling server.
   * @param {string} [options.dispatcherPort=dispatcher.webrtc.ecl.ntt.com] - The host name of the dispatcher server.
   * @param {number} [options.dispatcherPort=443] - The port number of dispatcher server.
   * @param {boolean} [options.dispatcherSecure=true] - True if the dispatcher server supports https.
   * @param {object} [options.config=config.defaultConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {boolean} [options.turn=true] - Whether using TURN or not.
   * @param {object} [options.credential] - The credential used to authenticate peer.
   + @param {number} [options.credential.timestamp] - Current UNIX timestamp.
   + @param {number} [options.credential.ttl] - Time to live; The credential expires at timestamp + ttl.
   + @param {string} [options.credential.authToken] - Credential token calculated with HMAC.
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

    const defaultOptions = {
      debug: logger.LOG_LEVELS.NONE,
      secure: true,
      config: config.defaultConfig,
      turn: true,

      dispatcherSecure: config.DISPATCHER_SECURE,
      dispatcherHost: config.DISPATCHER_HOST,
      dispatcherPort: config.DISPATCHER_PORT,
    };

    this.options = Object.assign({}, defaultOptions, options);
    // do not override by options
    this.options.token = util.randomToken();

    logger.setLogLevel(this.options.debug);

    if (!util.validateId(id)) {
      this._abort('invalid-id', `ID "${id}" is invalid`);
      return;
    }

    if (!util.validateKey(options.key)) {
      this._abort('invalid-key', `API KEY "${this.options.key}" is invalid`);
      return;
    }

    if (this.options.host === '/') {
      this.options.host = window.location.hostname;
    }
    if (options.secure === undefined && this.options.port !== 443) {
      this.options.secure = undefined;
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
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   * @param {boolean} [options.videoReceiveEnabled] - A flag to set video recvonly
   * @param {boolean} [options.audioReceiveEnabled] - A flag to set audio recvonly
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
    mc.startConnection();
    logger.log('MediaConnection created in call method');
    this._addConnection(peerId, mc);
    return mc;
  }

  /**
   * Creates new DataConnection.
   * @param {string} peerId - User's peerId.
   * @param {Object} [options] - Optional arguments for DataConnection.
   * @param {string} [options.connectionId] - An ID to uniquely identify the connection.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {Object} [options.dcInit] - Options passed to createDataChannel() as a RTCDataChannelInit.
   *                  See https://www.w3.org/TR/webrtc/#dom-rtcdatachannelinit
   * @param {string} [options.serialization] - How to serialize data when sending.
   *                  One of 'binary', 'json' or 'none'.
   * @return {DataConnection} An instance of DataConnection.
   */
  connect(peerId, options = {}) {
    if (!this._checkOpenStatus()) {
      return;
    }

    options.pcConfig = this._pcConfig;
    const connection = new DataConnection(peerId, options);
    connection.startConnection();
    logger.log('DataConnection created in connect method');
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
   * @param {boolean} [options.videoReceiveEnabled] - A flag to set video recvonly
   * @param {boolean} [options.audioReceiveEnabled] - A flag to set audio recvonly
   * @return {SFURoom|MeshRoom} - An instance of SFURoom or MeshRoom.
   */
  joinRoom(roomName, roomOptions = {}) {
    if (!this._checkOpenStatus()) {
      return;
    }

    if (!roomName) {
      const err = new Error('Room name must be defined.');
      err.type = 'room-error';
      logger.error(err);
      this.emit(Peer.EVENTS.error.key, err);
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
      for (const connection of this.connections[peerId]) {
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
    return this.socket && this.socket.isOpen;
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
   * Update server-side credential by sending a request in order to extend TTL.
   * @param {object} newCredential - The new credential generated by user.
   * @param {number} [newCredential.timestamp] - Current UNIX timestamp.
   + @param {number} [newCredential.ttl] - Time to live; The credential expires at timestamp + ttl.
   + @param {string} [newCredential.authToken] - Credential token calculated with HMAC.
   */
  updateCredential(newCredential) {
    this.socket.updateCredential(newCredential);
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

    const url = `${this.socket.signalingServerUrl}/api/apikeys/${this.options.key}/clients/`;

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
        const err = new Error(
          "It doesn't look like you have permission to list peers IDs. " +
            'Please enable the SkyWay REST API on dashboard'
        );
        err.type = 'list-error';
        logger.error(err);
        self.emit(Peer.EVENTS.error.key, err);
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
    logger.warn(
      'You cannot connect to a new Peer because you are not connecting to SkyWay server now.' +
        'You can create a new Peer to reconnect, or call reconnect() ' +
        'on this peer if you believe its ID to still be available.'
    );

    const err = new Error(
      'Cannot connect to new Peer before connecting to SkyWay server or after disconnecting from the server.'
    );
    err.type = 'disconnected';
    logger.error(err);
    this.emit(Peer.EVENTS.error.key, err);
  }

  /**
   * Creates new Socket and initalize its message handlers.
   * @param {string} id - User's peerId.
   * @private
   */
  _initializeServerConnection(id) {
    this.socket = new Socket(this.options.key, {
      secure: this.options.secure,
      host: this.options.host,
      port: this.options.port,

      dispatcherSecure: this.options.dispatcherSecure,
      dispatcherHost: this.options.dispatcherHost,
      dispatcherPort: this.options.dispatcherPort,
    });

    this._setupMessageHandlers();

    this.socket.on('error', error => {
      this._abort('socket-error', error);
    });

    this.socket.on('disconnect', () => {
      // If we haven't explicitly disconnected, emit error and disconnect.
      this.disconnect();

      const err = new Error('Lost connection to server.');
      err.type = 'socket-error';
      logger.error(err);
      this.emit(Peer.EVENTS.error.key, err);
    });

    this.socket.start(id, this.options.token, this.options.credential);
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
   * @param {boolean} [roomOptions.videoReceiveEnabled] - A flag to set video recvonly
   * @param {boolean} [roomOptions.audioReceiveEnabled] - A flag to set audio recvonly
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
      roomType: 'sfu',
    };

    this.socket.send(config.MESSAGE_TYPES.CLIENT.ROOM_JOIN.key, data);

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
   * @param {boolean} [roomOptions.videoReceiveEnabled] - A flag to set video recvonly
   * @param {boolean} [roomOptions.audioReceiveEnabled] - A flag to set audio recvonly
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
      roomType: 'mesh',
    };

    this.socket.send(config.MESSAGE_TYPES.CLIENT.ROOM_JOIN.key, data);

    return meshRoom;
  }

  /**
   * Set up socket's message handlers.
   * @private
   */
  _setupMessageHandlers() {
    this.socket.on(config.MESSAGE_TYPES.SERVER.OPEN.key, openMessage => {
      this.id = openMessage.peerId;
      this._pcConfig = Object.assign({}, this.options.config);

      // make a copy of iceServers as Object.assign still retains the reference
      const iceServers = this._pcConfig.iceServers;
      this._pcConfig.iceServers = iceServers ? iceServers.slice() : [];

      // Set up turn credentials
      const turnCredential = openMessage.turnCredential;
      let turnUserName;
      let turnPassword;
      if (typeof turnCredential === 'object') {
        turnUserName = turnCredential.username;
        turnPassword = turnCredential.credential;
      } else if (typeof turnCredential === 'string') {
        // Handle older server versions that don't send the username
        turnUserName = `${this.options.key}$${this.id}`;
        turnPassword = turnCredential;
      }
      if (this.options.turn === true && turnUserName && turnPassword) {
        // possible turn types are turn-tcp, turns-tcp, turn-udp
        const turnCombinations = [
          { protocol: 'turn', transport: 'tcp' },
          { protocol: 'turn', transport: 'udp' },
        ];

        // Edge can not handle turns-tcp
        const browser = util.detectBrowser();
        if (browser.name !== 'edge') {
          turnCombinations.push({ protocol: 'turns', transport: 'tcp' });
        }

        for (const turnType of turnCombinations) {
          const protocol = turnType.protocol;
          const transport = turnType.transport;

          const iceServer = {
            urls: `${protocol}:${config.TURN_HOST}:${config.TURN_PORT}?transport=${transport}`,
            url: `${protocol}:${config.TURN_HOST}:${config.TURN_PORT}?transport=${transport}`,

            username: turnUserName,
            credential: turnPassword,
          };

          this._pcConfig.iceServers.push(iceServer);
        }

        logger.log('SkyWay TURN Server is available');
      } else {
        logger.log('SkyWay TURN Server is unavailable');
      }

      this.emit(Peer.EVENTS.open.key, this.id);
    });

    this.socket.on(config.MESSAGE_TYPES.SERVER.ERROR.key, error => {
      const err = new Error(error.message);
      err.type = error.type;
      logger.error(err);
      this.emit(Peer.EVENTS.error.key, err);
    });

    this.socket.on(config.MESSAGE_TYPES.SERVER.LEAVE.key, peerId => {
      logger.log(`Received leave message from ${peerId}`);
      this._cleanupPeer(peerId);
    });

    this.socket.on(
      config.MESSAGE_TYPES.SERVER.FORCE_CLOSE.key,
      ({ src: remoteId, connectionId }) => {
        // select a force closing connection and Close it.
        const connection = this.getConnection(remoteId, connectionId);
        if (connection) {
          // close the connection without sending FORCE_CLOSE
          connection.close(false);
        }
      }
    );

    this.socket.on(
      config.MESSAGE_TYPES.SERVER.AUTH_EXPIRES_IN.key,
      remainingSec => {
        logger.log(`Credential expires in ${remainingSec}`);
        this.emit(Peer.EVENTS.expiresin.key, remainingSec);
      }
    );

    this.socket.on(config.MESSAGE_TYPES.SERVER.OFFER.key, offerMessage => {
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
        connection = new MediaConnection(offerMessage.src, {
          connectionId: connectionId,
          payload: offerMessage,
          metadata: offerMessage.metadata,
          originator: false,
          queuedMessages: this._queuedMessages[connectionId],
          pcConfig: this._pcConfig,
        });
        connection.startConnection();

        logger.log('MediaConnection created in OFFER');

        this._addConnection(offerMessage.src, connection);
        this.emit(Peer.EVENTS.call.key, connection);
      } else if (offerMessage.connectionType === 'data') {
        connection = new DataConnection(offerMessage.src, {
          connectionId: connectionId,
          payload: offerMessage,
          metadata: offerMessage.metadata,
          label: offerMessage.label,
          dcInit: offerMessage.dcInit,
          serialization: offerMessage.serialization,
          queuedMessages: this._queuedMessages[connectionId],
          pcConfig: this._pcConfig,
        });
        connection.startConnection();

        logger.log('DataConnection created in OFFER');

        this._addConnection(offerMessage.src, connection);
        this.emit(Peer.EVENTS.connection.key, connection);
      } else {
        logger.warn(
          'Received malformed connection type: ',
          offerMessage.connectionType
        );
      }

      delete this._queuedMessages[connectionId];
    });

    this.socket.on(config.MESSAGE_TYPES.SERVER.ANSWER.key, answerMessage => {
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
        // Should we remove this storing
        // because answer should be handled immediately after its arrival?
        this._storeMessage(
          config.MESSAGE_TYPES.SERVER.ANSWER.key,
          answerMessage
        );
      }
    });

    this.socket.on(
      config.MESSAGE_TYPES.SERVER.CANDIDATE.key,
      candidateMessage => {
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
          // Store candidate in the queue so that the candidate can be added
          // after setRemoteDescription completed.
          this._storeMessage(
            config.MESSAGE_TYPES.SERVER.CANDIDATE.key,
            candidateMessage
          );
        }
      }
    );

    this.socket.on(
      config.MESSAGE_TYPES.SERVER.ROOM_USER_JOIN.key,
      roomUserJoinMessage => {
        const room = this.rooms[roomUserJoinMessage.roomName];
        if (room) {
          room.handleJoin(roomUserJoinMessage);
        }
      }
    );

    this.socket.on(
      config.MESSAGE_TYPES.SERVER.ROOM_USER_LEAVE.key,
      roomUserLeaveMessage => {
        const room = this.rooms[roomUserLeaveMessage.roomName];
        if (room) {
          room.handleLeave(roomUserLeaveMessage);
        }
      }
    );

    this.socket.on(
      config.MESSAGE_TYPES.SERVER.ROOM_DATA.key,
      roomDataMessage => {
        const room = this.rooms[roomDataMessage.roomName];
        if (room) {
          room.handleData(roomDataMessage);
        }
      }
    );

    this.socket.on(
      config.MESSAGE_TYPES.SERVER.ROOM_LOGS.key,
      roomLogMessage => {
        const room = this.rooms[roomLogMessage.roomName];
        if (room) {
          room.handleLog(roomLogMessage.log);
        }
      }
    );

    this.socket.on(
      config.MESSAGE_TYPES.SERVER.ROOM_USERS.key,
      roomUserListMessage => {
        const room = this.rooms[roomUserListMessage.roomName];
        if (room) {
          if (roomUserListMessage.type === 'media') {
            room.makeMediaConnections(roomUserListMessage.userList);
          } else {
            room.makeDataConnections(roomUserListMessage.userList);
          }
        }
      }
    );

    this.socket.on(config.MESSAGE_TYPES.SERVER.SFU_OFFER.key, offerMessage => {
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
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.SEND_CANDIDATE.key,
        candidateMessage
      );
    });
    connection.on(Connection.EVENTS.answer.key, answerMessage => {
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.SEND_ANSWER.key,
        answerMessage
      );
    });
    connection.on(Connection.EVENTS.offer.key, offerMessage => {
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.SEND_OFFER.key,
        offerMessage
      );
    });
    connection.on(Connection.EVENTS.forceClose.key, () => {
      const forceCloseMessage = {
        dst: connection.remoteId,
        connectionId: connection.id,
      };

      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.SEND_FORCE_CLOSE.key,
        forceCloseMessage
      );
    });
  }

  /**
   * Set up the message event handlers for a Room
   * @param {Room} room - The room to be set up.
   * @private
   */
  _setupRoomMessageHandlers(room) {
    room.on(SFURoom.MESSAGE_EVENTS.broadcast.key, sendMessage => {
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.ROOM_SEND_DATA.key,
        sendMessage
      );
    });
    room.on(SFURoom.MESSAGE_EVENTS.getLog.key, getLogMessage => {
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.ROOM_GET_LOGS.key,
        getLogMessage
      );
    });
    room.on(SFURoom.MESSAGE_EVENTS.leave.key, leaveMessage => {
      delete this.rooms[room.name];
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.ROOM_LEAVE.key,
        leaveMessage
      );
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
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.SFU_GET_OFFER.key,
        sendMessage
      );
    });
    room.on(SFURoom.MESSAGE_EVENTS.answer.key, answerMessage => {
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.SFU_ANSWER.key,
        answerMessage
      );
    });
    room.on(SFURoom.MESSAGE_EVENTS.candidate.key, candidateMessage => {
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.SFU_CANDIDATE.key,
        candidateMessage
      );
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
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.SEND_OFFER.key,
        offerMessage
      );
    });
    room.on(MeshRoom.MESSAGE_EVENTS.answer.key, answerMessage => {
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.SEND_ANSWER.key,
        answerMessage
      );
    });
    room.on(MeshRoom.MESSAGE_EVENTS.candidate.key, candidateMessage => {
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.SEND_CANDIDATE.key,
        candidateMessage
      );
    });
    room.on(MeshRoom.MESSAGE_EVENTS.getPeers.key, requestMessage => {
      this.socket.send(
        config.MESSAGE_TYPES.CLIENT.ROOM_GET_USERS.key,
        requestMessage
      );
    });
  }

  /**
   * Disconnect the socket and emit error.
   * @param {string} type - The type of error.
   * @param {string} message - Error description.
   * @private
   */
  _abort(type, message) {
    logger.error('Aborting!');
    this.disconnect();

    const err = new Error(message);
    err.type = type;
    logger.error(err);
    this.emit(Peer.EVENTS.error.key, err);
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
    this._queuedMessages[message.connectionId].push({
      type: type,
      payload: message,
    });
  }

  /**
   * Close all connections and emit close event.
   * @private
   */
  _cleanup() {
    if (this.connections) {
      for (const peer of Object.keys(this.connections)) {
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
      for (const connection of this.connections[peer]) {
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

export default Peer;
