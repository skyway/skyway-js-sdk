'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _socket = require('socket.io-client');

var _socket2 = _interopRequireDefault(_socket);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _queryString = require('query-string');

var _queryString2 = _interopRequireDefault(_queryString);

var _config = require('../shared/config');

var _config2 = _interopRequireDefault(_config);

var _logger = require('../shared/logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Class to handle WS/HTTP communication with the signalling server
 * @extends EventEmitter
 */
var Socket = function (_EventEmitter) {
  _inherits(Socket, _EventEmitter);

  /**
   * Creates an instance of Socket.
   * @param {string} key - The apiKey to connect using.
   * @param {Object} options - Socket connection options.
   * @param {boolean} options.secure - True if signalling server supports HTTPS/WSS.
   * @param {string} options.host - The signalling server host.
   * @param {number | string} options.port - The port the signalling server is listening to.
   * @param {boolean} options.dispatcherSecure - True if dispatcher server supports HTTPS/WSS.
   * @param {string} options.dispatcherHost - The signalling server host.
   * @param {number | string} options.dispatcherPort - The port the signalling server is listening to.
   */
  function Socket(key, options) {
    _classCallCheck(this, Socket);

    var _this = _possibleConstructorReturn(this, (Socket.__proto__ || Object.getPrototypeOf(Socket)).call(this));

    _this._isOpen = false;
    _this._isPeerIdSet = false;
    _this._queue = [];

    _this._io = null;
    _this._key = key;
    _this._reconnectAttempts = 0;

    if (options.host && options.port) {
      var httpProtocol = options.secure ? 'https://' : 'http://';
      _this.signalingServerUrl = '' + httpProtocol + options.host + ':' + options.port;
    } else {
      var dispatcherHost = options.dispatcherHost || _config2.default.DISPATCHER_HOST;
      var dispatcherPort = options.dispatcherPort || _config2.default.DISPATCHER_PORT;
      var dispatcherSecure = options.dispatcherSecure || _config2.default.DISPATCHER_SECURE;

      var _httpProtocol = dispatcherSecure ? 'https://' : 'http://';
      _this._dispatcherUrl = '' + _httpProtocol + dispatcherHost + ':' + dispatcherPort + '/signaling';
    }
    return _this;
  }

  /**
   * Whether the socket is connecting to the signalling server or not.
   * @type {boolean}
   */


  _createClass(Socket, [{
    key: 'start',


    /**
     * Connect to the signalling server.
     * @param {string} id - Unique peerId to identify the client.
     * @param {string} token - Token to identify the session.
     * @param {object} credential - The credential used to authenticate peer.
     * @param {number} [credential.timestamp] - Current UNIX timestamp.
     + @param {number} [credential.ttl] - Time to live; The credential expires at timestamp + ttl.
     + @param {string} [credential.authToken] - Credential token calculated with HMAC.
     * @return {Promise} Promise that resolves when starting is done.
     * @fires Socket#error
     */
    value: function start(id, token, credential) {
      var _this2 = this;

      var query = 'apiKey=' + this._key + '&token=' + token;
      if (id) {
        query += '&peerId=' + id;
        this._isPeerIdSet = true;
      }

      if (credential) {
        var encodedCredentialStr = encodeURIComponent(JSON.stringify(credential));
        query += '&credential=' + encodedCredentialStr;
      }

      return new Promise(function (resolve) {
        if (_this2._dispatcherUrl) {
          _this2._getSignalingServer().then(function (serverInfo) {
            var httpProtocol = serverInfo.secure ? 'https://' : 'http://';
            _this2.signalingServerUrl = '' + httpProtocol + serverInfo.host + ':' + serverInfo.port;
            resolve();
          });
        } else {
          resolve();
        }
      }).then(function () {
        _this2._io = (0, _socket2.default)(_this2.signalingServerUrl, {
          'force new connection': true,
          'query': query,
          'reconnectionAttempts': _config2.default.reconnectionAttempts
        });

        _this2._io.on('reconnect_failed', function () {
          _this2._stopPings();
          _this2._connectToNewServer();
        });

        _this2._io.on('error', function (e) {
          _logger2.default.error(e);
        });

        _this2._setupMessageHandlers();
      });
    }

    /**
     * Connect to "new" signaling server. Attempts up to 10 times before giving up and emitting an error on the socket.
     * @param {number} [numAttempts=0] - Current number of attempts.
     * @private
     */

  }, {
    key: '_connectToNewServer',
    value: function _connectToNewServer() {
      var _this3 = this;

      var numAttempts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      // max number of attempts to get a new server from the dispatcher.
      var maxNumberOfAttempts = 10;
      if (numAttempts >= maxNumberOfAttempts || this._reconnectAttempts >= _config2.default.numberServersToTry) {
        this.emit('error', 'Could not connect to server.');
        return;
      }

      // Keep trying until we connect to a new server because consul can take some time to remove from the active list.
      this._getSignalingServer().then(function (serverInfo) {
        if (_this3.signalingServerUrl.indexOf(serverInfo.host) === -1) {
          var httpProtocol = serverInfo.secure ? 'https://' : 'http://';
          _this3.signalingServerUrl = '' + httpProtocol + serverInfo.host + ':' + serverInfo.port;
          _this3._io.io.uri = _this3.signalingServerUrl;
          _this3._io.connect();
          _this3._reconnectAttempts++;
        } else {
          _this3._connectToNewServer(++numAttempts);
        }
      });
    }

    /**
     * Return object including signaling server info.
     * @return {Promise} A promise that resolves with signaling server info
     and rejects if there's no response or status code isn't 200.
     */

  }, {
    key: '_getSignalingServer',
    value: function _getSignalingServer() {
      var _this4 = this;

      return new Promise(function (resolve, reject) {
        var http = new XMLHttpRequest();

        http.timeout = _config2.default.DISPATCHER_TIMEOUT;
        http.open('GET', _this4._dispatcherUrl, true);

        /* istanbul ignore next */
        http.onerror = function () {
          reject(new Error('There was a problem with the dispatcher.'));
        };

        http.ontimeout = function () {
          reject(new Error('The request for the dispather timed out.'));
        };

        http.onreadystatechange = function () {
          if (http.readyState !== 4) {
            return;
          }

          var res = JSON.parse(http.responseText);
          if (http.status === 200) {
            if (res && res.domain) {
              resolve({ host: res.domain, port: 443, secure: true });
              return;
            }
          }

          if (res.error && res.error.message) {
            var message = res.error.message;
            reject(new Error(message));
          } else {
            reject(new Error('There was a problem with the dispatcher.'));
          }
        };

        http.send(null);
      });
    }

    /**
     * Send a message to the signalling server. Queue the messages if not connected yet.
     * @param {string} type - The signalling message type. Message types are defined in config.MESSAGE_TYPES.
     * @param {string | object} message - The message to send to the server.
     */

  }, {
    key: 'send',
    value: function send(type, message) {
      if (!type) {
        this._io.emit('error', 'Invalid message');
        return;
      }

      // If we are not connected yet, queue the message
      if (!this.isOpen) {
        this._queue.push({ type: type, message: message });
        return;
      }

      if (this._io.connected === true) {
        this._io.emit(type, message);
      }
    }

    /**
     * Disconnect from the signalling server.
     */

  }, {
    key: 'close',
    value: function close() {
      if (this.isOpen) {
        this._stopPings();
        this._io.disconnect();
        this._isOpen = false;
      }
    }

    /**
     * Reconnect to the signaling server.
     */

  }, {
    key: 'reconnect',
    value: function reconnect() {
      this._io.connect();
    }

    /**
     * Update Credential by sending the new credential to the signaling server.
     * Also set the new one to the Socket.io.opts's query string for reconnection.
     * @param {object} newCredential - The new credential generated by user.
     * @param {number} [newCredential.timestamp] - Current UNIX timestamp.
     + @param {number} [newCredential.ttl] - Time to live; The credential expires at timestamp + ttl.
     + @param {string} [newCredential.authToken] - Credential token calculated with HMAC.
     */

  }, {
    key: 'updateCredential',
    value: function updateCredential(newCredential) {
      // Parse the current queryString and replace the new credential with old one
      var parseQuery = _queryString2.default.parse(this._io.io.opts.query);
      if (parseQuery.credential) {
        parseQuery.credential = encodeURIComponent(JSON.stringify(newCredential));
      } else {
        // For future development; here we can tell the the developer
        // which connection(p2p/turn/sfu) should be authenticated.
        _logger2.default.warn('Adding a credential when one wasn\'t specified before.');
      }
      this._io.io.opts.query = _queryString2.default.stringify(parseQuery);

      this.send(_config2.default.MESSAGE_TYPES.CLIENT.UPDATE_CREDENTIAL.key, newCredential);
    }

    /**
     * Set up the signalling message handlers.
     * @private
     * @fires Socket#OPEN
     * @fires Socket#OFFER
     * @fires Socket#ANSWER
     * @fires Socket#CANDIDATE
     * @fires Socket#LEAVE
     * @fires Socket#AUTH_EXPIRES_IN
     * @fires Socket#ROOM_OFFER
     * @fires Socket#ROOM_USER_JOIN
     * @fires Socket#ROOM_USER_LEAVE
     * @fires Socket#ROOM_DATA
     */

  }, {
    key: '_setupMessageHandlers',
    value: function _setupMessageHandlers() {
      var _this5 = this;

      _config2.default.MESSAGE_TYPES.SERVER.enums.forEach(function (type) {
        if (type.key === _config2.default.MESSAGE_TYPES.SERVER.OPEN.key) {
          _this5._io.on(type.key, function (openMessage) {
            if (!openMessage || !openMessage.peerId) {
              return;
            }
            if (!_this5._isPeerIdSet) {
              // set peerId for when reconnecting to the server
              _this5._io.io.opts.query += '&peerId=' + openMessage.peerId;
              _this5._isPeerIdSet = true;
            }
            _this5._reconnectAttempts = 0;

            _this5._startPings();
            _this5._sendQueuedMessages();

            if (!_this5._isOpen) {
              _this5._isOpen = true;

              // To inform the peer that the socket successfully connected
              _this5.emit(type.key, openMessage);
            }
          });
        } else {
          _this5._io.on(type.key, function (message) {
            _this5.emit(type.key, message);
          });
        }
      });
    }

    /**
     * Send messages that were queued when the client wasn't connected to the signalling server yet.
     * @private
     */

  }, {
    key: '_sendQueuedMessages',
    value: function _sendQueuedMessages() {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this._queue[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var data = _step.value;

          this.send(data.type, data.message);
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

      this._queue = [];
    }

    /**
     * Start sending ping messages if they aren't already
     * @private
     */

  }, {
    key: '_startPings',
    value: function _startPings() {
      var _this6 = this;

      if (!this._pingIntervalId) {
        this._pingIntervalId = setInterval(function () {
          _this6.send(_config2.default.MESSAGE_TYPES.CLIENT.PING.key);
        }, _config2.default.pingInterval);
      }
    }

    /**
     * Stop sending ping messages
     * @private
     */

  }, {
    key: '_stopPings',
    value: function _stopPings() {
      clearInterval(this._pingIntervalId);
      this._pingIntervalId = undefined;
    }

    /**
     * Error occurred.
     *
     * @event Connection#error
     * @type {Error}
     */

    /**
     * Socket opened.
     *
     * @event Socket#OPEN
     * @type {object}
     * @property {string} peerId - The peerId of the client.
     * @property {string} [turnCredential] - The turn credentials for this client.
     */

    /**
     * Signalling server error.
     *
     * @event Socket#ERROR
     * @type {string}
     */

    /**
     * ICE candidate received from peer.
     *
     * @event Socket#CANDIDATE
     * @type {object}
     * @property {RTCIceCandidate} candidate - The ice candidate.
     * @property {string} src - Sender peerId.
     * @property {string} dst - Recipient peerId.
     * @property {string} connectionId - The connection id.
     * @property {string} connectionType - The connection type.
     */

    /**
     * Offer received from peer.
     *
     * @event Socket#OFFER
     * @type {object}
     * @property {RTCSessionDescription} offer - The remote peer's offer.
     * @property {string} src - Sender peerId.
     * @property {string} dst - Recipient peerId.
     * @property {string} connectionId - The connection id.
     * @property {string} connectionType - The connection type.
     * @property {object} metadata - Any extra data sent with the connection.
     */

    /**
     * Answer received from peer.
     *
     * @event Socket#ANSWER
     * @type {object}
     * @property {RTCSessionDescription} answer - The remote peer's answer.
     * @property {string} src - Sender peerId.
     * @property {string} dst - Recipient peerId.
     * @property {string} connectionId - The connection id.
     * @property {string} connectionType - The connection type.
     */

    /**
     * Peer has left.
     *
     * @event Socket#LEAVE
     * @type {string}
     */

    /**
     * Message sent to peer has failed.
     *
     * @event Socket#EXPIRE
     * @type {string}
     */

    /**
     * Room offer sdp received.
     *
     * @event Socket#ROOM_OFFER
     * @type {object}
     * @property {string} roomName - The name of the room the offer is for.
     * @property {RTCSessionDescription} offer - The offer object.
     */

    /**
     * User has joined the room.
     *
     * @event Socket#ROOM_USER_JOIN
     * @type {object}
     * @property {string} src - The peerId of the user who joined the room.
     * @property {string} roomName - The name of the room joined.
     */

    /**
     * User has left the room.
     *
     * @event Socket#ROOM_USER_LEAVE
     * @type {object}
     * @property {string} src - The peerId of the user who left the room.
     * @property {string} roomName - The name of the room left.
     */

    /**
     * Received a data message from a user in a room.
     *
     * @event Socket#ROOM_DATA
     * @type {object}
     * @property {string} src - The peerId of the user who sent the message.
     * @property {string} roomName - The name of the room left.
     * @property {*} data - The data that was sent.
     */

  }, {
    key: 'isOpen',
    get: function get() {
      return Boolean(this._io && this._io.connected && this._isOpen);
    }
  }]);

  return Socket;
}(_events2.default);

exports.default = Socket;