'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _enum = require('enum');

var _enum2 = _interopRequireDefault(_enum);

var _room = require('./room');

var _room2 = _interopRequireDefault(_room);

var _connection = require('./connection');

var _connection2 = _interopRequireDefault(_connection);

var _mediaConnection = require('./mediaConnection');

var _mediaConnection2 = _interopRequireDefault(_mediaConnection);

var _dataConnection = require('./dataConnection');

var _dataConnection2 = _interopRequireDefault(_dataConnection);

var _logger = require('../shared/logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MessageEvents = ['broadcastByDC', 'getPeers'];

var MeshEvents = new _enum2.default([]);
MeshEvents.extend(_room2.default.EVENTS.enums);
var MeshMessageEvents = new _enum2.default(MessageEvents);
MeshMessageEvents.extend(_room2.default.MESSAGE_EVENTS.enums);

/**
 * Class that manages fullmesh type room.
 * @extends Room
 */

var MeshRoom = function (_Room) {
  _inherits(MeshRoom, _Room);

  /**
   * Create a fullmesh room.
   * @param {string} name - Room name.
   * @param {string} peerId - User's peerId.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {MediaStream} [options.stream] - The MediaStream to send to the remote peer.
   * @param {object} [options.pcConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   */
  function MeshRoom(name, peerId, options) {
    _classCallCheck(this, MeshRoom);

    var _this = _possibleConstructorReturn(this, (MeshRoom.__proto__ || Object.getPrototypeOf(MeshRoom)).call(this, name, peerId, options));

    _this.connections = {};
    return _this;
  }

  /**
   * Called by client app to create MediaConnections.
   * It emit getPeers event for getting peerIds of all of room participant.
   * After getting peerIds, makeMCs is called.
   * @param {MediaStream} [stream] - The MediaStream to send to the remote peer.
   */


  _createClass(MeshRoom, [{
    key: 'call',
    value: function call(stream) {
      if (stream) {
        this._localStream = stream;
      }

      var data = {
        roomName: this.name,
        type: 'media'
      };

      this.emit(MeshRoom.MESSAGE_EVENTS.getPeers.key, data);
    }

    /**
     * Called by client app to create DataConnections.
     * It emit getPeers event for getting peerIds of all of room participant.
     * After getting peerIds, makeDCs is called.
     */

  }, {
    key: 'connect',
    value: function connect() {
      var data = {
        roomName: this.name,
        type: 'data'
      };

      this.emit(MeshRoom.MESSAGE_EVENTS.getPeers.key, data);
    }

    /**
     * Start video call to all participants in the room.
     * @param {Array} peerIds - Array of peerIds you are calling to.
     */

  }, {
    key: 'makeMediaConnections',
    value: function makeMediaConnections(peerIds) {
      var options = {
        stream: this._localStream,
        pcConfig: this._pcConfig,
        originator: true,
        videoBandwidth: this._options.videoBandwidth,
        audioBandwidth: this._options.audioBandwidth,
        videoCodec: this._options.videoCodec,
        audioCodec: this._options.audioCodec
      };

      this._makeConnections(peerIds, 'media', options);
    }

    /**
     * Start data connection to all participants in the room.
     * @param {Array} peerIds - Array of peerIds you are connecting to.
     */

  }, {
    key: 'makeDataConnections',
    value: function makeDataConnections(peerIds) {
      var options = {
        pcConfig: this._pcConfig
      };

      this._makeConnections(peerIds, 'data', options);
    }

    /**
     * Handle join message from new participant in the room.
     * It emits peerJoin event and if the message contains user's peerId, also emits open event.
     * @param {Object} joinMessage - Message object.
     * @param {string} joinMessage.src - The peerId of the peer that joined.
     * @param {string} joinMessage.roomName - The name of the joined room.
     */

  }, {
    key: 'handleJoin',
    value: function handleJoin(joinMessage) {
      var src = joinMessage.src;
      if (src === this._peerId) {
        this.call(this._localStream);
        this.emit(MeshRoom.EVENTS.open.key);

        // At this stage the Server has acknowledged us joining a room
        return;
      }

      this.emit(MeshRoom.EVENTS.peerJoin.key, src);
    }

    /**
     * Handle leave message from other participant in the room.
     * It deletes connection from room's connections property and emits peerLeave event.
     * @param {Object} leaveMessage - Message object.
     * @param {string} leaveMessage.src - The peerId of the peer that left.
     * @param {string} leaveMessage.roomName - The name of the left room.
     */

  }, {
    key: 'handleLeave',
    value: function handleLeave(leaveMessage) {
      var src = leaveMessage.src;
      this._deleteConnections(src);
      this.emit(MeshRoom.EVENTS.peerLeave.key, src);
    }

    /**
     * Handle Offer message from new participant and create a Connection instance.
     * @param {object} offerMessage - Message object containing Offer SDP.
     * @param {object} offerMessage.offer - Object containing Offer SDP text.
     * @param {string} offerMessage.connectionId - An ID to uniquely identify the connection.
     * @param {string} offerMessage.connectionType - One of 'media' or 'data'.
     * @param {string} offerMessage.dst - The peerId of the peer who receiving the Offer.
     * @param {string} offerMessage.roomName - The name of the room user is joining.
     * @param {string} offerMessage.src - The peerId of the peer who sent the Offer.
     */

  }, {
    key: 'handleOffer',
    value: function handleOffer(offerMessage) {
      var connectionId = offerMessage.connectionId;
      var connection = this._getConnection(offerMessage.src, connectionId);

      if (connection) {
        connection.updateOffer(offerMessage);
        return;
      }

      if (offerMessage.connectionType === 'media') {
        connection = new _mediaConnection2.default(offerMessage.src, {
          connectionId: connectionId,
          payload: offerMessage,
          metadata: offerMessage.metadata,
          pcConfig: this._pcConfig
        });
        _logger2.default.log('MediaConnection created in OFFER');
        this._addConnection(offerMessage.src, connection);
        this._setupMessageHandlers(connection);

        connection.answer(this._localStream, {
          videoBandwidth: this._options.videoBandwidth,
          audioBandwidth: this._options.audioBandwidth,
          videoCodec: this._options.videoCodec,
          audioCodec: this._options.audioCodec
        });
      } else {
        _logger2.default.warn('Received malformed connection type: ' + offerMessage.connectionType);
      }
    }

    /**
     * Handle Answer message from participant in the room.
     * @param {object} answerMessage - Message object containing Answer SDP.
     * @param {object} answerMessage.answer - Object containing Answer SDP text.
     * @param {string} answerMessage.connectionId - An ID to uniquely identify the connection.
     * @param {string} answerMessage.connectionType - One of 'media' or 'data'.
     * @param {string} answerMessage.dst - The peerId of the peer who receiving the Answer.
     * @param {string} answerMessage.roomName - The name of the room user is joining.
     * @param {string} answerMessage.src - The peerId of the peer who sent the Answer.
     */

  }, {
    key: 'handleAnswer',
    value: function handleAnswer(answerMessage) {
      var connection = this._getConnection(answerMessage.src, answerMessage.connectionId);

      if (connection) {
        connection.handleAnswer(answerMessage);
      }
    }

    /**
     * Handles Candidate message from participant in the room.
     * @param {object} candidateMessage - Message object containing Candidate SDP.
     * @param {object} candidateMessage.candidate - Object containing Candidate SDP text.
     * @param {string} candidateMessage.connectionId - An ID to uniquely identify the connection.
     * @param {string} candidateMessage.connectionType - One of 'media' or 'data'.
     * @param {string} candidateMessage.dst - The peerId of the peer who receiving the Candidate.
     * @param {string} candidateMessage.roomName - The name of the room user is joining.
     * @param {string} candidateMessage.src - The peerId of the peer who sent the Candidate.
     */

  }, {
    key: 'handleCandidate',
    value: function handleCandidate(candidateMessage) {
      var connection = this._getConnection(candidateMessage.src, candidateMessage.connectionId);

      if (connection) {
        connection.handleCandidate(candidateMessage);
      }
    }

    /**
     * Send data to all participants in the room with WebSocket.
     * It emits broadcast event.
     * @param {*} data - The data to send.
     */

  }, {
    key: 'send',
    value: function send(data) {
      var message = {
        roomName: this.name,
        data: data
      };
      this.emit(MeshRoom.MESSAGE_EVENTS.broadcast.key, message);
    }

    /**
     * Close all connections in the room.
     */

  }, {
    key: 'close',
    value: function close() {
      for (var peerId in this.connections) {
        if (this.connections.hasOwnProperty(peerId)) {
          this.connections[peerId].forEach(function (connection) {
            connection.close();
          });
        }
      }
      var message = {
        roomName: this.name
      };
      this.emit(MeshRoom.MESSAGE_EVENTS.leave.key, message);
      this.emit(MeshRoom.EVENTS.close.key);
    }

    /**
     * Replace the stream being sent on all MediaConnections   with a new one.
     * @param {MediaStream} newStream - The stream to replace the old stream with.
     */

  }, {
    key: 'replaceStream',
    value: function replaceStream(newStream) {
      this._localStream = newStream;
      for (var peerId in this.connections) {
        if (this.connections.hasOwnProperty(peerId)) {
          this.connections[peerId].forEach(function (connection) {
            if (connection.type === 'media') {
              connection.replaceStream(newStream);
            }
          });
        }
      }
    }

    /**
     * Append a connection to peer's array of connections, stored in room.connections.
     * @param {string} peerId - User's peerID.
     * @param {MediaConnection|DataConnection} connection - An instance of MediaConnection or DataConnection.
     * @private
     */

  }, {
    key: '_addConnection',
    value: function _addConnection(peerId, connection) {
      if (!this.connections[peerId]) {
        this.connections[peerId] = [];
      }
      this.connections[peerId].push(connection);
    }

    /**
     * Start connections and add handlers.
     * @param {Array} peerIds - Array of peerIds you are creating connections for.
     * @param {string} type - Either 'data' or 'media'.
     * @param {Object} options - Options to pass to the connection constructor.
     * @private
     */

  }, {
    key: '_makeConnections',
    value: function _makeConnections(peerIds, type, options) {
      var _this2 = this;

      peerIds.filter(function (peerId) {
        return peerId !== _this2._peerId;
      }).forEach(function (peerId) {
        var connection = void 0;

        switch (type) {
          case 'data':
            connection = new _dataConnection2.default(peerId, options);
            break;
          case 'media':
            connection = new _mediaConnection2.default(peerId, options);
            break;
          default:
            return;
        }

        _this2._addConnection(peerId, connection);
        _this2._setupMessageHandlers(connection);

        _logger2.default.log(type + ' connection to ' + peerId + ' created in ' + _this2.name);
      });
    }

    /**
     * Delete a connection according to given peerId.
     * @param {string} peerId - The id of the peer that will be deleted.
     * @private
     */

  }, {
    key: '_deleteConnections',
    value: function _deleteConnections(peerId) {
      if (this.connections[peerId]) {
        delete this.connections[peerId];
      }
    }

    /**
     * Return a connection according to given peerId and connectionId.
     * @param {string} peerId - User's PeerId.
     * @param {string} connectionId - An ID to uniquely identify the connection.
     * @return {Connection} A connection according to given peerId and connectionId.
     * @private
     */

  }, {
    key: '_getConnection',
    value: function _getConnection(peerId, connectionId) {
      if (this.connections && this.connections[peerId]) {
        var conn = this.connections[peerId].filter(function (connection) {
          return connection.id === connectionId;
        });
        return conn[0];
      }
      return null;
    }

    /**
     * Set up connection event and message handlers.
     * @param {MediaConnection|DataConnection} connection - An instance of MediaConnection or DataConnection.
     * @private
     */

  }, {
    key: '_setupMessageHandlers',
    value: function _setupMessageHandlers(connection) {
      var _this3 = this;

      connection.on(_connection2.default.EVENTS.offer.key, function (offerMessage) {
        offerMessage.roomName = _this3.name;
        _this3.emit(MeshRoom.MESSAGE_EVENTS.offer.key, offerMessage);
      });

      connection.on(_connection2.default.EVENTS.answer.key, function (answerMessage) {
        answerMessage.roomName = _this3.name;
        _this3.emit(MeshRoom.MESSAGE_EVENTS.answer.key, answerMessage);
      });

      connection.on(_connection2.default.EVENTS.candidate.key, function (candidateMessage) {
        candidateMessage.roomName = _this3.name;
        _this3.emit(MeshRoom.MESSAGE_EVENTS.candidate.key, candidateMessage);
      });

      if (connection.type === 'media') {
        connection.on(_mediaConnection2.default.EVENTS.stream.key, function (remoteStream) {
          remoteStream.peerId = connection.remoteId;
          _this3.emit(MeshRoom.EVENTS.stream.key, remoteStream);
        });

        connection.on(_mediaConnection2.default.EVENTS.removeStream.key, function (remoteStream) {
          _this3.emit(MeshRoom.EVENTS.removeStream.key, remoteStream);
        });
      }
    }

    /**
     * Events the MeshRoom class can emit.
     * @type {Enum}
     */

  }], [{
    key: 'EVENTS',
    get: function get() {
      return MeshEvents;
    }

    /**
     * Message events the MeshRoom class can emit.
     * @type {Enum}
     */

  }, {
    key: 'MESSAGE_EVENTS',
    get: function get() {
      return MeshMessageEvents;
    }

    /**
     * Get all peer's peerId joining in the room.
     * @event MeshRoom#getPeers
     * @type {object}
     * @property {string} roomName - The Room name.
     * @property {string} type - One of 'media' or 'data'.
      */

    /**
     * Send data to all peers in the room by WebSocket.
     *
     * @event MeshRoom#broadcastByWS
     * @type {object}
     * @property {string} roomName - The Room name.
     * @property {*} data - The data to send.
     */

    /**
     * Send data to all peers in the room by DataChannel.
     *
     * @event MeshRoom#broadcastByDC
     * @type {object}
     * @property {string} roomName - The Room name.
     * @property {*} data - The data to send.
     */

  }]);

  return MeshRoom;
}(_room2.default);

exports.default = MeshRoom;