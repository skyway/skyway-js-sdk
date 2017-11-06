'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _enum = require('enum');

var _enum2 = _interopRequireDefault(_enum);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Events = ['stream', 'removeStream', 'open', 'close', 'peerJoin', 'peerLeave', 'error', 'data', 'log'];

var MessageEvents = ['offer', 'answer', 'candidate', 'leave', 'close', 'getLog', 'broadcast'];

var RoomEvents = new _enum2.default(Events);
var RoomMessageEvents = new _enum2.default(MessageEvents);

/**
 * Class to manage rooms where one or more users can participate
 * @extends EventEmitter
 */

var Room = function (_EventEmitter) {
  _inherits(Room, _EventEmitter);

  /**
   * Creates a Room instance.
   * @param {string} name - Room name.
   * @param {string} peerId - User's peerId.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {object} [options.stream] - User's medias stream to send other participants.
   * @param {object} [options.pcConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   */
  function Room(name, peerId) {
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    _classCallCheck(this, Room);

    // Abstract class
    var _this = _possibleConstructorReturn(this, (Room.__proto__ || Object.getPrototypeOf(Room)).call(this));

    if (_this.constructor === Room) {
      throw new TypeError('Cannot construct Room instances directly');
    }

    _this.name = name;
    _this._options = options;
    _this._peerId = peerId;
    _this._localStream = _this._options.stream;

    _this._pcConfig = _this._options.pcConfig;
    return _this;
  }

  /**
   * Handle received data message from other paricipants in the room.
   * It emits data event.
   * @param {object} dataMessage - The data message to handle.
   * @param {ArrayBuffer} dataMessage.data - The data that a peer sent in the room.
   * @param {string} dataMessage.src -  The peerId of the peer who sent the data.
   * @param {string} [dataMessage.roomName] -  The name of the room user is joining.
   */


  _createClass(Room, [{
    key: 'handleData',
    value: function handleData(dataMessage) {
      var message = {
        data: dataMessage.data,
        src: dataMessage.src
      };
      this.emit(Room.EVENTS.data.key, message);
    }

    /**
     * Handle received log message.
     * It emits log event with room's logs.
     * @param {Array} logs - An array containing JSON text.
     */

  }, {
    key: 'handleLog',
    value: function handleLog(logs) {
      this.emit(Room.EVENTS.log.key, logs);
    }

    /**
     * Start getting room's logs from SkyWay server.
     */

  }, {
    key: 'getLog',
    value: function getLog() {
      var message = {
        roomName: this.name
      };
      this.emit(Room.MESSAGE_EVENTS.getLog.key, message);
    }

    /**
     * Events the Room class can emit.
     * @type {Enum}
     */

  }], [{
    key: 'EVENTS',
    get: function get() {
      return RoomEvents;
    }

    /**
     * MediaStream received from peer in the room.
     *
     * @event Room#stream
     * @type {MediaStream}
     */

    /**
     * Room is ready.
     *
     * @event Room#open
     */

    /**
     * All connections in the room has closed.
     *
     * @event Room#close
     */

    /**
     * New peer has joined.
     *
     * @event Room#peerJoin
     * @type {string}
     */

    /**
     * A peer has left.
     *
     * @event Room#peerLeave
     * @type {string}
     */

    /**
     * Error occured
     *
     * @event Room#error
     */

    /**
     * Data received from peer.
     *
     * @event Room#data
     * @type {object}
     * @property {string} src - The peerId of the peer who sent the data.
     * @property {*} data - The data that a peer sent in the room.
     */

    /**
     * Room's log received.
     *
     * @event Room#log
     * @type {Array}
     */

    /**
     * Connection closed event.
     *
     * @event Connection#close
     */

    /**
     * Events the Room class can emit.
     * @type {Enum}
     */

  }, {
    key: 'MESSAGE_EVENTS',
    get: function get() {
      return RoomMessageEvents;
    }

    /**
     * Offer created event.
     *
     * @event Room#offer
     * @type {object}
     * @property {RTCSessionDescription} offer - The local offer to send to the peer.
     * @property {string} dst - Destination peerId
     * @property {string} connectionId - This connection's id.
     * @property {string} connectionType - This connection's type.
     * @property {object} metadata - Any extra data to send with the connection.
     */

    /**
     * Answer created event.
     *
     * @event Room#answer
     * @type {object}
     * @property {RTCSessionDescription} answer - The local answer to send to the peer.
     * @property {string} dst - Destination peerId
     * @property {string} connectionId - This connection's id.
     * @property {string} connectionType - This connection's type.
     */

    /**
     * ICE candidate created event.
     *
     * @event Room#candidate
     * @type {object}
     * @property {RTCIceCandidate} candidate - The ice candidate.
     * @property {string} dst - Destination peerId
     * @property {string} connectionId - This connection's id.
     * @property {string} connectionType - This connection's type.
     */

    /**
     * Left the room.
     *
     * @event Room#peerLeave
     * @type {object}
     * @property {string} roomName - The room name.
     */

    /**
     * Get room log from SkyWay server.
     *
     * @event Room#log
     * @type {object}
     * @property {string} roomName - The room name.
     */

  }]);

  return Room;
}(_events2.default);

exports.default = Room;