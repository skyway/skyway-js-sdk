'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _enum = require('enum');

var _enum2 = _interopRequireDefault(_enum);

var _socket = require('./peer/socket');

var _socket2 = _interopRequireDefault(_socket);

var _connection = require('./peer/connection');

var _connection2 = _interopRequireDefault(_connection);

var _dataConnection = require('./peer/dataConnection');

var _dataConnection2 = _interopRequireDefault(_dataConnection);

var _mediaConnection = require('./peer/mediaConnection');

var _mediaConnection2 = _interopRequireDefault(_mediaConnection);

var _sfuRoom = require('./peer/sfuRoom');

var _sfuRoom2 = _interopRequireDefault(_sfuRoom);

var _meshRoom = require('./peer/meshRoom');

var _meshRoom2 = _interopRequireDefault(_meshRoom);

var _util = require('./shared/util');

var _util2 = _interopRequireDefault(_util);

var _logger = require('./shared/logger');

var _logger2 = _interopRequireDefault(_logger);

var _config = require('./shared/config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var PeerEvents = new _enum2.default(['open', 'error', 'call', 'connection', 'expiresin', 'close', 'disconnected']);

/**
 * Class that manages all p2p connections and rooms.
 * This class contains socket.io message handlers.
 * @extends EventEmitter
 */

var Peer = function (_EventEmitter) {
  _inherits(Peer, _EventEmitter);

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
  function Peer(id, options) {
    _classCallCheck(this, Peer);

    var _this = _possibleConstructorReturn(this, (Peer.__proto__ || Object.getPrototypeOf(Peer)).call(this));

    _this.connections = {};
    _this.rooms = {};

    // messages received before connection is ready
    _this._queuedMessages = {};

    if (id && id.constructor === Object) {
      options = id;
      id = undefined;
    } else if (id) {
      id = id.toString();
    }

    var defaultOptions = {
      debug: _logger2.default.LOG_LEVELS.NONE,
      secure: true,
      token: _util2.default.randomToken(),
      config: _config2.default.defaultConfig,
      turn: true,

      dispatcherSecure: _config2.default.DISPATCHER_SECURE,
      dispatcherHost: _config2.default.DISPATCHER_HOST,
      dispatcherPort: _config2.default.DISPATCHER_PORT
    };

    _this.options = Object.assign({}, defaultOptions, options);

    _logger2.default.setLogLevel(_this.options.debug);

    if (!_util2.default.validateId(id)) {
      _this._abort('invalid-id', 'ID "' + id + '" is invalid');
      return _possibleConstructorReturn(_this);
    }

    if (!_util2.default.validateKey(options.key)) {
      _this._abort('invalid-key', 'API KEY "' + _this.options.key + '" is invalid');
      return _possibleConstructorReturn(_this);
    }

    if (_this.options.host === '/') {
      _this.options.host = window.location.hostname;
    }
    if (options.secure === undefined && _this.options.port !== 443) {
      _this.options.secure = undefined;
    }
    _this._initializeServerConnection(id);
    return _this;
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
   * @return {MediaConnection} An instance of MediaConnection.
   */


  _createClass(Peer, [{
    key: 'call',
    value: function call(peerId, stream) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      if (!this._checkOpenStatus()) {
        return;
      }

      options.originator = true;
      options.stream = stream;
      options.pcConfig = this._pcConfig;
      var mc = new _mediaConnection2.default(peerId, options);
      _logger2.default.log('MediaConnection created in call method');
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
     * @return {DataConnection} An instance of DataConnection.
     */

  }, {
    key: 'connect',
    value: function connect(peerId) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if (!this._checkOpenStatus()) {
        return;
      }

      options.pcConfig = this._pcConfig;
      var connection = new _dataConnection2.default(peerId, options);
      _logger2.default.log('DataConnection created in connect method');
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

  }, {
    key: 'joinRoom',
    value: function joinRoom(roomName) {
      var roomOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if (!this._checkOpenStatus()) {
        return;
      }

      if (!roomName) {
        var err = new Error('Room name must be defined.');
        err.type = 'room-error';
        _logger2.default.error(err);
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

  }, {
    key: 'getConnection',
    value: function getConnection(peerId, connectionId) {
      if (!this._checkOpenStatus()) {
        return;
      }

      if (this.connections[peerId]) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = this.connections[peerId][Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var connection = _step.value;

            if (connection.id === connectionId) {
              return connection;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      }
      return null;
    }

    /**
     * Whether the socket is connecting to the signalling server or not.
     * @type {boolean} The open status.
     */

  }, {
    key: 'destroy',


    /**
     * Close all connections and disconnect socket.
     */
    value: function destroy() {
      this._cleanup();
      this.disconnect();
    }

    /**
     * Close socket and clean up some properties, then emit disconnect event.
     */

  }, {
    key: 'disconnect',
    value: function disconnect() {
      if (this.open) {
        this.socket.close();
        this.emit(Peer.EVENTS.disconnected.key, this.id);
      }
    }

    /**
     * Reconnect to SkyWay server. Does not work after a peer.destroy().
     */

  }, {
    key: 'reconnect',
    value: function reconnect() {
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

  }, {
    key: 'updateCredential',
    value: function updateCredential(newCredential) {
      this.socket.updateCredential(newCredential);
    }

    /**
     * Call Rest API and get the list of peerIds assciated with API key.
     * @param {function} cb - The callback function that is called after XHR.
     */

  }, {
    key: 'listAllPeers',
    value: function listAllPeers(cb) {
      if (!this._checkOpenStatus()) {
        return;
      }

      cb = cb || function () {};
      var self = this;
      var http = new XMLHttpRequest();

      var url = this.socket.signalingServerUrl + '/api/apikeys/' + this.options.key + '/clients/';

      // If there's no ID we need to wait for one before trying to init socket.
      http.open('get', url, true);

      /* istanbul ignore next */
      http.onerror = function () {
        self._abort('server-error', 'Could not get peers from the server.');
        cb([]);
      };
      http.onreadystatechange = function () {
        if (http.readyState !== 4) {
          return;
        }
        if (http.status === 401) {
          cb([]);
          var err = new Error('It doesn\'t look like you have permission to list peers IDs. ' + 'Please enable the SkyWay REST API on dashboard');
          err.type = 'list-error';
          _logger2.default.error(err);
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

  }, {
    key: '_checkOpenStatus',
    value: function _checkOpenStatus() {
      if (!this.open) {
        this._emitNotConnectedError();
      }
      return this.open;
    }

    /**
     * Emit not connected error.
     */

  }, {
    key: '_emitNotConnectedError',
    value: function _emitNotConnectedError() {
      _logger2.default.warn('You cannot connect to a new Peer because you are not connecting to SkyWay server now.' + 'You can create a new Peer to reconnect, or call reconnect() ' + 'on this peer if you believe its ID to still be available.');

      var err = new Error('Cannot connect to new Peer before connecting to SkyWay server or after disconnecting from the server.');
      err.type = 'disconnected';
      _logger2.default.error(err);
      this.emit(Peer.EVENTS.error.key, err);
    }

    /**
     * Creates new Socket and initalize its message handlers.
     * @param {string} id - User's peerId.
     * @private
     */

  }, {
    key: '_initializeServerConnection',
    value: function _initializeServerConnection(id) {
      var _this2 = this;

      this.socket = new _socket2.default(this.options.key, {
        secure: this.options.secure,
        host: this.options.host,
        port: this.options.port,

        dispatcherSecure: this.options.dispatcherSecure,
        dispatcherHost: this.options.dispatcherHost,
        dispatcherPort: this.options.dispatcherPort
      });

      this._setupMessageHandlers();

      this.socket.on('error', function (error) {
        _this2._abort('socket-error', error);
      });

      this.socket.on('disconnect', function () {
        // If we haven't explicitly disconnected, emit error and disconnect.
        _this2.disconnect();

        var err = new Error('Lost connection to server.');
        err.type = 'socket-error';
        _logger2.default.error(err);
        _this2.emit(Peer.EVENTS.error.key, err);
      });

      this.socket.start(id, this.options.token, this.options.credential);

      window.onbeforeunload = function () {
        _this2.destroy();
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

  }, {
    key: '_initializeSfuRoom',
    value: function _initializeSfuRoom(roomName) {
      var roomOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if (this.rooms[roomName]) {
        return this.rooms[roomName];
      }
      var sfuRoom = new _sfuRoom2.default(roomName, this.id, roomOptions);
      this.rooms[roomName] = sfuRoom;
      this._setupSFURoomMessageHandlers(sfuRoom);

      var data = {
        roomName: roomName,
        roomType: 'sfu'
      };

      this.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.ROOM_JOIN.key, data);

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

  }, {
    key: '_initializeFullMeshRoom',
    value: function _initializeFullMeshRoom(roomName) {
      var roomOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if (this.rooms[roomName]) {
        return this.rooms[roomName];
      }
      var meshRoom = new _meshRoom2.default(roomName, this.id, roomOptions);
      this.rooms[roomName] = meshRoom;
      this._setupMeshRoomMessageHandlers(meshRoom);

      var data = {
        roomName: roomName,
        roomType: 'mesh'
      };

      this.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.ROOM_JOIN.key, data);

      return meshRoom;
    }

    /**
     * Set up socket's message handlers.
     * @private
     */

  }, {
    key: '_setupMessageHandlers',
    value: function _setupMessageHandlers() {
      var _this3 = this;

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.OPEN.key, function (openMessage) {
        _this3.id = openMessage.peerId;
        _this3._pcConfig = Object.assign({}, _this3.options.config);

        // make a copy of iceServers as Object.assign still retains the reference
        var iceServers = _this3._pcConfig.iceServers;
        _this3._pcConfig.iceServers = iceServers ? iceServers.slice() : [];

        // Set up turn credentials
        var turnCredential = openMessage.turnCredential;
        var turnUserName = void 0;
        var turnPassword = void 0;
        if ((typeof turnCredential === 'undefined' ? 'undefined' : _typeof(turnCredential)) === 'object') {
          turnUserName = turnCredential.username;
          turnPassword = turnCredential.credential;
        } else if (typeof turnCredential === 'string') {
          // Handle older server versions that don't send the username
          turnUserName = _this3.options.key + '$' + _this3.id;
          turnPassword = turnCredential;
        }
        if (_this3.options.turn === true && turnUserName && turnPassword) {
          // possible turn types are turn-tcp, turns-tcp, turn-udp
          var turnCombinations = [{ protocol: 'turn', transport: 'tcp' }, { protocol: 'turn', transport: 'udp' }];

          // Edge can not handle turns-tcp
          if (_util2.default.detectBrowser() !== 'edge') {
            turnCombinations.push({ protocol: 'turns', transport: 'tcp' });
          }

          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = turnCombinations[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
              var turnType = _step2.value;

              var protocol = turnType.protocol;
              var transport = turnType.transport;

              var iceServer = {
                urls: protocol + ':' + _config2.default.TURN_HOST + ':' + _config2.default.TURN_PORT + '?transport=' + transport,
                url: protocol + ':' + _config2.default.TURN_HOST + ':' + _config2.default.TURN_PORT + '?transport=' + transport,

                username: turnUserName,
                credential: turnPassword
              };

              _this3._pcConfig.iceServers.push(iceServer);
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
              }
            } finally {
              if (_didIteratorError2) {
                throw _iteratorError2;
              }
            }
          }

          _logger2.default.log('SkyWay TURN Server is available');
        } else {
          _logger2.default.log('SkyWay TURN Server is unavailable');
        }

        _this3.emit(Peer.EVENTS.open.key, _this3.id);
      });

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.ERROR.key, function (error) {
        var err = new Error(error.message);
        err.type = error.type;
        _logger2.default.error(err);
        _this3.emit(Peer.EVENTS.error.key, err);
      });

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.LEAVE.key, function (peerId) {
        _logger2.default.log('Received leave message from ' + peerId);
        _this3._cleanupPeer(peerId);
      });

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.AUTH_EXPIRES_IN.key, function (remainingSec) {
        _logger2.default.log('Credential expires in ' + remainingSec);
        _this3.emit(Peer.EVENTS.expiresin.key, remainingSec);
      });

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.OFFER.key, function (offerMessage) {
        // handle mesh room offers
        var roomName = offerMessage.roomName;
        if (roomName) {
          var room = _this3.rooms[roomName];

          if (room) {
            room.handleOffer(offerMessage);
          }
          return;
        }

        // handle p2p offers
        var connectionId = offerMessage.connectionId;
        var connection = _this3.getConnection(offerMessage.src, connectionId);

        if (connection) {
          connection.updateOffer(offerMessage);
          return;
        }

        if (offerMessage.connectionType === 'media') {
          connection = new _mediaConnection2.default(offerMessage.src, {
            connectionId: connectionId,
            payload: offerMessage,
            metadata: offerMessage.metadata,
            originator: false,
            queuedMessages: _this3._queuedMessages[connectionId],
            pcConfig: _this3._pcConfig
          });

          _logger2.default.log('MediaConnection created in OFFER');
          _this3._addConnection(offerMessage.src, connection);
          _this3.emit(Peer.EVENTS.call.key, connection);
        } else if (offerMessage.connectionType === 'data') {
          connection = new _dataConnection2.default(offerMessage.src, {
            connectionId: connectionId,
            payload: offerMessage,
            metadata: offerMessage.metadata,
            label: offerMessage.label,
            serialization: offerMessage.serialization,
            queuedMessages: _this3._queuedMessages[connectionId],
            pcConfig: _this3._pcConfig
          });

          _logger2.default.log('DataConnection created in OFFER');

          _this3._addConnection(offerMessage.src, connection);
          _this3.emit(Peer.EVENTS.connection.key, connection);
        } else {
          _logger2.default.warn('Received malformed connection type: ', offerMessage.connectionType);
        }

        delete _this3._queuedMessages[connectionId];
      });

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.ANSWER.key, function (answerMessage) {
        // handle mesh room answers
        var roomName = answerMessage.roomName;
        if (roomName) {
          var room = _this3.rooms[roomName];

          if (room) {
            room.handleAnswer(answerMessage);
          }
          return;
        }

        // handle p2p answers
        var connection = _this3.getConnection(answerMessage.src, answerMessage.connectionId);

        if (connection) {
          connection.handleAnswer(answerMessage);
        } else {
          _this3._storeMessage(_config2.default.MESSAGE_TYPES.SERVER.ANSWER.key, answerMessage);
        }
      });

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.CANDIDATE.key, function (candidateMessage) {
        // handle mesh room candidates
        var roomName = candidateMessage.roomName;
        if (roomName) {
          var room = _this3.rooms[roomName];

          if (room) {
            room.handleCandidate(candidateMessage);
          }
          return;
        }

        // handle p2p candidates
        var connection = _this3.getConnection(candidateMessage.src, candidateMessage.connectionId);

        if (connection) {
          connection.handleCandidate(candidateMessage);
        } else {
          _this3._storeMessage(_config2.default.MESSAGE_TYPES.SERVER.CANDIDATE.key, candidateMessage);
        }
      });

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.ROOM_USER_JOIN.key, function (roomUserJoinMessage) {
        var room = _this3.rooms[roomUserJoinMessage.roomName];
        if (room) {
          room.handleJoin(roomUserJoinMessage);
        }
      });

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.ROOM_USER_LEAVE.key, function (roomUserLeaveMessage) {
        var room = _this3.rooms[roomUserLeaveMessage.roomName];
        if (room) {
          room.handleLeave(roomUserLeaveMessage);
        }
      });

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.ROOM_DATA.key, function (roomDataMessage) {
        var room = _this3.rooms[roomDataMessage.roomName];
        if (room) {
          room.handleData(roomDataMessage);
        }
      });

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.ROOM_LOGS.key, function (roomLogMessage) {
        var room = _this3.rooms[roomLogMessage.roomName];
        if (room) {
          room.handleLog(roomLogMessage.log);
        }
      });

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.ROOM_USERS.key, function (roomUserListMessage) {
        var room = _this3.rooms[roomUserListMessage.roomName];
        if (room) {
          if (roomUserListMessage.type === 'media') {
            room.makeMediaConnections(roomUserListMessage.userList);
          } else {
            room.makeDataConnections(roomUserListMessage.userList);
          }
        }
      });

      this.socket.on(_config2.default.MESSAGE_TYPES.SERVER.SFU_OFFER.key, function (offerMessage) {
        var room = _this3.rooms[offerMessage.roomName];
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

  }, {
    key: '_setupConnectionMessageHandlers',
    value: function _setupConnectionMessageHandlers(connection) {
      var _this4 = this;

      connection.on(_connection2.default.EVENTS.candidate.key, function (candidateMessage) {
        _this4.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.SEND_CANDIDATE.key, candidateMessage);
      });
      connection.on(_connection2.default.EVENTS.answer.key, function (answerMessage) {
        _this4.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.SEND_ANSWER.key, answerMessage);
      });
      connection.on(_connection2.default.EVENTS.offer.key, function (offerMessage) {
        _this4.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.SEND_OFFER.key, offerMessage);
      });
    }

    /**
     * Set up the message event handlers for a Room
     * @param {Room} room - The room to be set up.
     * @private
     */

  }, {
    key: '_setupRoomMessageHandlers',
    value: function _setupRoomMessageHandlers(room) {
      var _this5 = this;

      room.on(_sfuRoom2.default.MESSAGE_EVENTS.broadcast.key, function (sendMessage) {
        _this5.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.ROOM_SEND_DATA.key, sendMessage);
      });
      room.on(_sfuRoom2.default.MESSAGE_EVENTS.getLog.key, function (getLogMessage) {
        _this5.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.ROOM_GET_LOGS.key, getLogMessage);
      });
      room.on(_sfuRoom2.default.MESSAGE_EVENTS.leave.key, function (leaveMessage) {
        delete _this5.rooms[room.name];
        _this5.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.ROOM_LEAVE.key, leaveMessage);
      });
    }

    /**
     * Set up the message event handlers for an SFURoom
     * @param {SFURoom} room - The room to be set up.
     * @private
     */

  }, {
    key: '_setupSFURoomMessageHandlers',
    value: function _setupSFURoomMessageHandlers(room) {
      var _this6 = this;

      this._setupRoomMessageHandlers(room);

      room.on(_sfuRoom2.default.MESSAGE_EVENTS.offerRequest.key, function (sendMessage) {
        _this6.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.SFU_GET_OFFER.key, sendMessage);
      });
      room.on(_sfuRoom2.default.MESSAGE_EVENTS.answer.key, function (answerMessage) {
        _this6.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.SFU_ANSWER.key, answerMessage);
      });
      room.on(_sfuRoom2.default.MESSAGE_EVENTS.candidate.key, function (candidateMessage) {
        _this6.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.SFU_CANDIDATE.key, candidateMessage);
      });
    }

    /**
     * Set up the message event handlers for a MeshRoom
     * @param {MeshRoom} room - The room to be set up.
     * @private
     */

  }, {
    key: '_setupMeshRoomMessageHandlers',
    value: function _setupMeshRoomMessageHandlers(room) {
      var _this7 = this;

      this._setupRoomMessageHandlers(room);

      room.on(_meshRoom2.default.MESSAGE_EVENTS.offer.key, function (offerMessage) {
        _this7.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.SEND_OFFER.key, offerMessage);
      });
      room.on(_meshRoom2.default.MESSAGE_EVENTS.answer.key, function (answerMessage) {
        _this7.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.SEND_ANSWER.key, answerMessage);
      });
      room.on(_meshRoom2.default.MESSAGE_EVENTS.candidate.key, function (candidateMessage) {
        _this7.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.SEND_CANDIDATE.key, candidateMessage);
      });
      room.on(_meshRoom2.default.MESSAGE_EVENTS.getPeers.key, function (requestMessage) {
        _this7.socket.send(_config2.default.MESSAGE_TYPES.CLIENT.ROOM_GET_USERS.key, requestMessage);
      });
    }

    /**
     * Disconnect the socket and emit error.
     * @param {string} type - The type of error.
     * @param {string} message - Error description.
     * @private
     */

  }, {
    key: '_abort',
    value: function _abort(type, message) {
      _logger2.default.error('Aborting!');
      this.disconnect();

      var err = new Error(message);
      err.type = type;
      _logger2.default.error(err);
      this.emit(Peer.EVENTS.error.key, err);
    }

    /**
     * Add connection to connections property and set up message handlers.
     * @param {string} peerId - User's peerId.
     * @param {MediaConnection|DataConnection} connection - The connection to be added.
     * @private
     */

  }, {
    key: '_addConnection',
    value: function _addConnection(peerId, connection) {
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

  }, {
    key: '_storeMessage',
    value: function _storeMessage(type, message) {
      if (!this._queuedMessages[message.connectionId]) {
        this._queuedMessages[message.connectionId] = [];
      }
      this._queuedMessages[message.connectionId].push({ type: type, payload: message });
    }

    /**
     * Close all connections and emit close event.
     * @private
     */

  }, {
    key: '_cleanup',
    value: function _cleanup() {
      if (this.connections) {
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
          for (var _iterator3 = Object.keys(this.connections)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var peer = _step3.value;

            this._cleanupPeer(peer);
          }
        } catch (err) {
          _didIteratorError3 = true;
          _iteratorError3 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }
          } finally {
            if (_didIteratorError3) {
              throw _iteratorError3;
            }
          }
        }
      }
      this.emit(Peer.EVENTS.close.key);
    }

    /**
     * Close the connection.
     * @param {string} peer - The peerId of the peer to be closed.
     * @private
     */

  }, {
    key: '_cleanupPeer',
    value: function _cleanupPeer(peer) {
      if (this.connections[peer]) {
        var _iteratorNormalCompletion4 = true;
        var _didIteratorError4 = false;
        var _iteratorError4 = undefined;

        try {
          for (var _iterator4 = this.connections[peer][Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var connection = _step4.value;

            connection.close();
          }
        } catch (err) {
          _didIteratorError4 = true;
          _iteratorError4 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }
          } finally {
            if (_didIteratorError4) {
              throw _iteratorError4;
            }
          }
        }
      }
    }

    /**
     * Events the Peer class can emit.
     * @type {Enum}
     */

  }, {
    key: 'open',
    get: function get() {
      return this.socket.isOpen;
    }
  }], [{
    key: 'EVENTS',
    get: function get() {
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

  }]);

  return Peer;
}(_events2.default);

exports.default = Peer;