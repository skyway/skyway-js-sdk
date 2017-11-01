'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _enum = require('enum');

var _enum2 = _interopRequireDefault(_enum);

var _room = require('./room');

var _room2 = _interopRequireDefault(_room);

var _negotiator = require('./negotiator');

var _negotiator2 = _interopRequireDefault(_negotiator);

var _logger = require('../shared/logger');

var _logger2 = _interopRequireDefault(_logger);

var _sdpUtil = require('../shared/sdpUtil');

var _sdpUtil2 = _interopRequireDefault(_sdpUtil);

var _util = require('../shared/util');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MessageEvents = ['offerRequest', 'candidate'];

var SFUEvents = new _enum2.default([]);
SFUEvents.extend(_room2.default.EVENTS.enums);
var SFUMessageEvents = new _enum2.default(MessageEvents);
SFUMessageEvents.extend(_room2.default.MESSAGE_EVENTS.enums);

/**
 * Class that manages SFU type room.
 * @extends Room
 */

var SFURoom = function (_Room) {
  _inherits(SFURoom, _Room);

  /**
   * Creates a SFU type room.
   * @param {string} name - Room name.
   * @param {string} peerId - peerId - User's peerId.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {MediaStream} [options.stream] - The MediaStream to send to the remote peer.
   * @param {object} [options.pcConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   */
  function SFURoom(name, peerId, options) {
    _classCallCheck(this, SFURoom);

    var _this = _possibleConstructorReturn(this, (SFURoom.__proto__ || Object.getPrototypeOf(SFURoom)).call(this, name, peerId, options));

    _this.remoteStreams = {};
    _this.members = [];

    _this._open = false;
    _this._msidMap = {};
    _this._unknownStreams = {};

    _this._negotiator = new _negotiator2.default();
    return _this;
  }

  /**
   * Send Offer request message to SFU server.
   * @param {MediaStream} [stream] - A media stream to send.
   */


  _createClass(SFURoom, [{
    key: 'call',
    value: function call(stream) {
      if (stream) {
        this._localStream = stream;
      }

      var data = {
        roomName: this.name
      };

      this.emit(SFURoom.MESSAGE_EVENTS.offerRequest.key, data);
    }

    /**
     * Handles Offer message from SFU server.
     * It create new RTCPeerConnection object.
     * @param {object} offerMessage - Message object containing Offer SDP.
     * @param {object} offerMessage.offer - Object containing Offer SDP text.
     */

  }, {
    key: 'handleOffer',
    value: function handleOffer(offerMessage) {
      var offer = offerMessage.offer;

      // Chrome and Safari can't handle unified plan messages so convert it to Plan B
      // We don't need to convert the answer back to Unified Plan because the server can handle Plan B
      if (_util2.default.detectBrowser() !== 'firefox') {
        offer = _sdpUtil2.default.unifiedToPlanB(offer);
      }

      // Handle SFU Offer and send Answer to Server
      if (this._connectionStarted) {
        this._negotiator.handleOffer(offer);
      } else {
        this._negotiator.startConnection({
          type: 'media',
          stream: this._localStream,
          pcConfig: this._options.pcConfig,
          offer: offer
        });
        this._setupNegotiatorMessageHandlers();
        this._connectionStarted = true;
      }
    }

    /**
     * Handle messages from the negotiator.
     * @private
     */

  }, {
    key: '_setupNegotiatorMessageHandlers',
    value: function _setupNegotiatorMessageHandlers() {
      var _this2 = this;

      this._negotiator.on(_negotiator2.default.EVENTS.addStream.key, function (stream) {
        var remoteStream = stream;

        if (_this2._msidMap[remoteStream.id]) {
          remoteStream.peerId = _this2._msidMap[remoteStream.id];

          // return if the remoteStream's peerID is my peerID
          if (remoteStream.peerId === _this2._peerId) {
            return;
          }

          // return if the cachedStream which we will add already exists
          var cachedStream = _this2.remoteStreams[remoteStream.id];
          if (cachedStream && cachedStream.id === remoteStream.id) {
            return;
          }
          _this2.remoteStreams[remoteStream.id] = remoteStream;
          _this2.emit(SFURoom.EVENTS.stream.key, remoteStream);

          _logger2.default.log('Received remote media stream for ' + remoteStream.peerId + ' in ' + _this2.name);
        } else {
          _this2._unknownStreams[remoteStream.id] = remoteStream;
        }
      });

      this._negotiator.on(_negotiator2.default.EVENTS.removeStream.key, function (stream) {
        delete _this2.remoteStreams[stream.id];
        delete _this2._msidMap[stream.id];
        delete _this2._unknownStreams[stream.id];

        _this2.emit(SFURoom.EVENTS.removeStream.key, stream);
      });

      this._negotiator.on(_negotiator2.default.EVENTS.negotiationNeeded.key, function () {
        // Renegotiate by requesting an offer then sending an answer when one is created.
        var offerRequestMessage = {
          roomName: _this2.name
        };
        _this2.emit(SFURoom.MESSAGE_EVENTS.offerRequest.key, offerRequestMessage);
      });

      this._negotiator.on(_negotiator2.default.EVENTS.answerCreated.key, function (answer) {
        var answerMessage = {
          roomName: _this2.name,
          answer: answer
        };
        _this2.emit(SFURoom.MESSAGE_EVENTS.answer.key, answerMessage);
      });

      this._negotiator.on(_negotiator2.default.EVENTS.iceConnectionFailed.key, function () {
        _this2.close();
      });

      this._negotiator.on(_negotiator2.default.EVENTS.iceCandidate.key, function (candidate) {
        var candidateMessage = {
          roomName: _this2.name,
          candidate: candidate
        };
        _this2.emit(SFURoom.MESSAGE_EVENTS.candidate.key, candidateMessage);
      });
    }

    /**
     * Handles Join message from SFU server.
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
        this._open = true;

        this.call(this._localStream);
        this.emit(SFURoom.EVENTS.open.key);

        // At this stage the Server has acknowledged us joining a room
        return;
      }

      this.members.push(src);
      this.emit(SFURoom.EVENTS.peerJoin.key, src);
    }

    /**
     * Handles Leave message from SFU server.
     * It emits peerLeave message.
     * @param {Object} leaveMessage - Message from SFU server.
     */

  }, {
    key: 'handleLeave',
    value: function handleLeave(leaveMessage) {
      if (!this._open) {
        return;
      }

      var src = leaveMessage.src;

      var index = this.members.indexOf(src);
      if (index >= 0) {
        this.members.splice(index, 1);
      }

      this.emit(SFURoom.EVENTS.peerLeave.key, src);
    }

    /**
     * Send data to all participants in the room with WebSocket.
     * It emits broadcast event.
     * @param {*} data - The data to send.
     */

  }, {
    key: 'send',
    value: function send(data) {
      if (!this._open) {
        return;
      }

      var message = {
        roomName: this.name,
        data: data
      };
      this.emit(SFURoom.MESSAGE_EVENTS.broadcast.key, message);
    }

    /**
     * Close PeerConnection and emit leave and close event.
     */

  }, {
    key: 'close',
    value: function close() {
      if (!this._open) {
        return;
      }

      if (this._negotiator) {
        this._negotiator.cleanup();
      }

      this._open = false;

      var message = {
        roomName: this.name
      };
      this.emit(SFURoom.MESSAGE_EVENTS.leave.key, message);
      this.emit(SFURoom.EVENTS.close.key);
    }

    /**
     * Replace the stream being sent with a new one.
     * @param {MediaStream} newStream - The stream to replace the old stream with.
     */

  }, {
    key: 'replaceStream',
    value: function replaceStream(newStream) {
      this._localStream = newStream;
      this._negotiator.replaceStream(newStream);
    }

    /**
     * Update the entries in the msid to peerId map.
     * @param {Object} msids - Object with msids as the key and peerIds as the values.
     */

  }, {
    key: 'updateMsidMap',
    value: function updateMsidMap() {
      var msids = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      this._msidMap = msids;

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = Object.keys(this._unknownStreams)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var msid = _step.value;

          if (this._msidMap[msid]) {
            var remoteStream = this._unknownStreams[msid];
            remoteStream.peerId = this._msidMap[remoteStream.id];

            delete this._unknownStreams[msid];

            if (remoteStream.peerId === this._peerId) {
              return;
            }

            this.remoteStreams[remoteStream.id] = remoteStream;
            this.emit(SFURoom.EVENTS.stream.key, remoteStream);
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

    /**
     * Events the SFURoom class can emit.
     * @type {Enum}
     */

  }], [{
    key: 'EVENTS',
    get: function get() {
      return SFUEvents;
    }

    /**
     * Message events the MeshRoom class can emit.
     * @type {Enum}
     */

  }, {
    key: 'MESSAGE_EVENTS',
    get: function get() {
      return SFUMessageEvents;
    }

    /**
     * Send offer request to SkyWay server.
     *
     * @event SFURoom#offerRequest
     * @type {object}
     * @property {string} roomName - The Room name.
      */

    /**
     * Send data to all peers in the room by WebSocket.
     *
     * @event SFURoom#broadcast
     * @type {object}
     * @property {string} roomName - The Room name.
     * @property {*} data - The data to send.
     */

  }]);

  return SFURoom;
}(_room2.default);

exports.default = SFURoom;