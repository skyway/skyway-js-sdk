'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _enum = require('enum');

var _enum2 = _interopRequireDefault(_enum);

var _negotiator = require('./negotiator');

var _negotiator2 = _interopRequireDefault(_negotiator);

var _connection = require('./connection');

var _connection2 = _interopRequireDefault(_connection);

var _logger = require('../shared/logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MCEvents = new _enum2.default(['stream', 'removeStream']);

MCEvents.extend(_connection2.default.EVENTS.enums);

/**
 * Class that manages data connections to other peers.
 * @extends Connection
 */

var MediaConnection = function (_Connection) {
  _inherits(MediaConnection, _Connection);

  /**
   * Create a data connection to another peer.
   * @param {string} remoteId - The peerId of the peer you are connecting to.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {string} [options.connectionId] - An ID to uniquely identify the connection. Defaults to random string if not specified.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {object} [options.pcConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {object} [options.stream] - The MediaStream to send to the remote peer. Set only when on the caller side.
   * @param {boolean} [options.originator] - true means the peer is the originator of the connection.
   * @param {string} [options.queuedMessages] - An array of messages that were already received before the connection was created.
   * @param {string} [options.payload] - An offer message that triggered creating this object.
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   */
  function MediaConnection(remoteId, options) {
    _classCallCheck(this, MediaConnection);

    var _this = _possibleConstructorReturn(this, (MediaConnection.__proto__ || Object.getPrototypeOf(MediaConnection)).call(this, remoteId, options));

    _this._idPrefix = 'mc_';
    _this.type = 'media';

    /**
     * The local MediaStream.
     * @type {MediaStream}
     */
    _this.localStream = _this._options.stream;

    // Messages stored by peer because MC was not ready yet
    _this._queuedMessages = _this._options.queuedMessages || [];
    _this._pcAvailable = false;

    if (_this._options.originator) {
      _this._negotiator.startConnection({
        type: 'media',
        stream: _this.localStream,
        originator: _this._options.originator,
        pcConfig: _this._options.pcConfig,
        videoBandwidth: _this._options.videoBandwidth,
        audioBandwidth: _this._options.audioBandwidth,
        videoCodec: _this._options.videoCodec,
        audioCodec: _this._options.audioCodec
      });
      _this._pcAvailable = true;
      _this._handleQueuedMessages();
    }
    return _this;
  }

  /**
   * Create and send an answer message.
   * @param {MediaStream} stream - The stream to send to the peer.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   */


  _createClass(MediaConnection, [{
    key: 'answer',
    value: function answer(stream) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if (this.localStream) {
        _logger2.default.warn('localStream already exists on this MediaConnection. Are you answering a call twice?');
        return;
      }

      this._options.payload.stream = stream;

      this.localStream = stream;
      this._negotiator.startConnection({
        type: 'media',
        stream: this.localStream,
        originator: false,
        offer: this._options.payload.offer,
        pcConfig: this._options.pcConfig,
        audioBandwidth: options.audioBandwidth,
        videoBandwidth: options.videoBandwidth,
        videoCodec: options.videoCodec,
        audioCodec: options.audioCodec
      });
      this._pcAvailable = true;

      this._handleQueuedMessages();

      this.open = true;
    }

    /**
     * Replace the stream being sent with a new one.
     * @param {MediaStream} newStream - The stream to replace the old stream with.
     */

  }, {
    key: 'replaceStream',
    value: function replaceStream(newStream) {
      this._negotiator.replaceStream(newStream);
      this.localStream = newStream;
    }

    /**
     * Set up negotiator message handlers.
     * @private
     */

  }, {
    key: '_setupNegotiatorMessageHandlers',
    value: function _setupNegotiatorMessageHandlers() {
      var _this2 = this;

      _get(MediaConnection.prototype.__proto__ || Object.getPrototypeOf(MediaConnection.prototype), '_setupNegotiatorMessageHandlers', this).call(this);

      this._negotiator.on(_negotiator2.default.EVENTS.addStream.key, function (remoteStream) {
        _logger2.default.log('Receiving stream', remoteStream);

        // return if the remoteStream which we will add already exists
        if (_this2.remoteStream && _this2.remoteStream.id === remoteStream.id) {
          return;
        }
        _this2.remoteStream = remoteStream;

        _this2.emit(MediaConnection.EVENTS.stream.key, remoteStream);
      });

      this._negotiator.on(_negotiator2.default.EVENTS.removeStream.key, function (remoteStream) {
        _logger2.default.log('Stream removed', remoteStream);

        // Don't unset if a new stream has already replaced the old one
        if (_this2.remoteStream === remoteStream) {
          _this2.remoteStream = null;
        }
        _this2.emit(MediaConnection.EVENTS.removeStream.key, remoteStream);
      });
    }

    /**
     * Events the MediaConnection class can emit.
     * @type {Enum}
     */

  }], [{
    key: 'EVENTS',
    get: function get() {
      return MCEvents;
    }

    /**
     * MediaStream received from peer.
     *
     * @event MediaConnection#stream
     * @type {MediaStream}
     */

    /**
     * MediaStream from peer was removed.
     *
     * @event MediaConnection#removeStream
     * @type {MediaStream}
     */

  }]);

  return MediaConnection;
}(_connection2.default);

exports.default = MediaConnection;