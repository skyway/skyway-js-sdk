'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _enum = require('enum');

var _enum2 = _interopRequireDefault(_enum);

var _negotiator = require('./negotiator');

var _negotiator2 = _interopRequireDefault(_negotiator);

var _util = require('../shared/util');

var _util2 = _interopRequireDefault(_util);

var _logger = require('../shared/logger');

var _logger2 = _interopRequireDefault(_logger);

var _config = require('../shared/config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var ConnectionEvents = new _enum2.default(['candidate', 'offer', 'answer', 'close']);

/**
 * Class that manages connections to other peers.
 * @extends EventEmitter
 */

var Connection = function (_EventEmitter) {
  _inherits(Connection, _EventEmitter);

  /**
   * Create a connection to another peer. Cannot be called directly. Must be called by a subclass.
   * @param {string} remoteId - The peerId of the peer you are connecting to.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {string} [options.connectionId] - An ID to uniquely identify the connection.
   *                                          Defaults to random string if not specified.
   */
  function Connection(remoteId, options) {
    _classCallCheck(this, Connection);

    var _this = _possibleConstructorReturn(this, (Connection.__proto__ || Object.getPrototypeOf(Connection)).call(this));

    options = options || {};

    // Abstract class
    if (_this.constructor === Connection) {
      throw new TypeError('Cannot construct Connection instances directly');
    }

    _this._options = options;

    /**
     * Whether the Connection has been opened or not.
     * @type {boolean}
     */
    _this.open = false;

    /**
     * The connection type. Either 'media' or 'data'.
     * @type {string}
     */
    _this.type = undefined;

    /**
     * Any additional information to send to the peer.
     * @type {object}
     */
    _this.metadata = _this._options.metadata;

    /**
     * PeerId of the peer this connection is connected to.
     * @type {string}
     */
    _this.remoteId = remoteId;

    _this._negotiator = new _negotiator2.default();

    _this._idPrefix = 'c_';
    _this._randomIdSuffix = _util2.default.randomToken();

    _this._setupNegotiatorMessageHandlers();
    return _this;
  }

  /**
   * An id to uniquely identify the connection.
   */


  _createClass(Connection, [{
    key: 'handleAnswer',


    /**
     * Handle an sdp answer message from the remote peer.
     * @param {object} answerMessage - Message object containing sdp answer.
     */
    value: function handleAnswer(answerMessage) {
      if (this._pcAvailable) {
        this._negotiator.handleAnswer(answerMessage.answer);
        this.open = true;
      } else {
        _logger2.default.log('Queuing ANSWER message in ' + this.id + ' from ' + this.remoteId);
        this._queuedMessages.push({ type: _config2.default.MESSAGE_TYPES.SERVER.ANSWER.key, payload: answerMessage });
      }
    }

    /**
     * Handle a candidate message from the remote peer.
     * @param {object} candidateMessage - Message object containing a candidate.
     */

  }, {
    key: 'handleCandidate',
    value: function handleCandidate(candidateMessage) {
      if (this._pcAvailable) {
        this._negotiator.handleCandidate(candidateMessage.candidate);
      } else {
        _logger2.default.log('Queuing CANDIDATE message in ' + this.id + ' from ' + this.remoteId);
        this._queuedMessages.push({ type: _config2.default.MESSAGE_TYPES.SERVER.CANDIDATE.key, payload: candidateMessage });
      }
    }

    /**
     * Handle an offer message from the remote peer. Allows an offer to be updated.
     * @param {object} offerMessage - Message object containing an offer.
     */

  }, {
    key: 'updateOffer',
    value: function updateOffer(offerMessage) {
      if (this.open) {
        this._negotiator.handleOffer(offerMessage.offer);
      } else {
        this._options.payload = offerMessage;
      }
    }

    /**
     * Process messages received before the RTCPeerConnection is ready.
     * @private
     */

  }, {
    key: '_handleQueuedMessages',
    value: function _handleQueuedMessages() {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this._queuedMessages[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var message = _step.value;

          switch (message.type) {
            case _config2.default.MESSAGE_TYPES.SERVER.ANSWER.key:
              this.handleAnswer(message.payload);
              break;
            case _config2.default.MESSAGE_TYPES.SERVER.CANDIDATE.key:
              this.handleCandidate(message.payload);
              break;
            default:
              _logger2.default.warn('Unrecognized message type:', message.type, 'from peer:', this.remoteId);
              break;
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

      this._queuedMessages = [];
    }

    /**
     * Disconnect from remote peer.
     * @fires Connection#close
     */

  }, {
    key: 'close',
    value: function close() {
      if (!this.open) {
        return;
      }
      this.open = false;
      this._negotiator.cleanup();
      this.emit(Connection.EVENTS.close.key);
    }

    /**
     * Handle messages from the negotiator.
     * @private
     */

  }, {
    key: '_setupNegotiatorMessageHandlers',
    value: function _setupNegotiatorMessageHandlers() {
      var _this2 = this;

      this._negotiator.on(_negotiator2.default.EVENTS.answerCreated.key, function (answer) {
        var connectionAnswer = {
          answer: answer,
          dst: _this2.remoteId,
          connectionId: _this2.id,
          connectionType: _this2.type
        };
        _this2.emit(Connection.EVENTS.answer.key, connectionAnswer);
      });

      this._negotiator.on(_negotiator2.default.EVENTS.offerCreated.key, function (offer) {
        var connectionOffer = {
          offer: offer,
          dst: _this2.remoteId,
          connectionId: _this2.id,
          connectionType: _this2.type,
          metadata: _this2.metadata
        };
        if (_this2.serialization) {
          connectionOffer.serialization = _this2.serialization;
        }
        if (_this2.label) {
          connectionOffer.label = _this2.label;
        }
        _this2.emit(Connection.EVENTS.offer.key, connectionOffer);
      });

      this._negotiator.on(_negotiator2.default.EVENTS.iceCandidate.key, function (candidate) {
        var connectionCandidate = {
          candidate: candidate,
          dst: _this2.remoteId,
          connectionId: _this2.id,
          connectionType: _this2.type
        };
        _this2.emit(Connection.EVENTS.candidate.key, connectionCandidate);
      });

      this._negotiator.on(_negotiator2.default.EVENTS.iceConnectionFailed.key, function () {
        _this2.close();
      });
    }

    /**
     * The remote peerId.
     * @type {string}
     * @deprecated Use remoteId instead.
     */

  }, {
    key: 'id',
    get: function get() {
      return this._options.connectionId || this._idPrefix + this._randomIdSuffix;
    }
  }, {
    key: 'peer',
    get: function get() {
      _logger2.default.warn(this.constructor.name + '.peer is deprecated and may be removed from a future version.' + (' Please use ' + this.constructor.name + '.remoteId instead.'));
      return this.remoteId;
    }

    /**
     * Events the Connection can emit.
     * @type {Enum}
     */

  }], [{
    key: 'EVENTS',
    get: function get() {
      return ConnectionEvents;
    }

    /**
     * ICE candidate created event.
     *
     * @event Connection#candidate
     * @type {object}
     * @property {RTCIceCandidate} candidate - The ice candidate.
     * @property {string} dst - Destination peerId
     * @property {string} connectionId - This connection's id.
     * @property {string} connectionType - This connection's type.
     */

    /**
     * Offer created event.
     *
     * @event Connection#offer
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
     * @event Connection#answer
     * @type {object}
     * @property {RTCSessionDescription} answer - The local answer to send to the peer.
     * @property {string} dst - Destination peerId
     * @property {string} connectionId - This connection's id.
     * @property {string} connectionType - This connection's type.
     */

    /**
     * Connection closed event.
     *
     * @event Connection#close
     */

  }]);

  return Connection;
}(_events2.default);

exports.default = Connection;