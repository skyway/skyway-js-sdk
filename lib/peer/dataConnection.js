'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _jsBinarypack = require('js-binarypack');

var _jsBinarypack2 = _interopRequireDefault(_jsBinarypack);

var _enum = require('enum');

var _enum2 = _interopRequireDefault(_enum);

var _objectSizeof = require('object-sizeof');

var _objectSizeof2 = _interopRequireDefault(_objectSizeof);

var _negotiator = require('./negotiator');

var _negotiator2 = _interopRequireDefault(_negotiator);

var _connection = require('./connection');

var _connection2 = _interopRequireDefault(_connection);

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

var DCEvents = new _enum2.default(['open', 'data', 'error']);

DCEvents.extend(_connection2.default.EVENTS.enums);

var DCSerializations = new _enum2.default(['binary', 'binary-utf8', 'json', 'none']);

/**
 * Class that manages data connections to other peers.
 * @extends Connection
 */

var DataConnection = function (_Connection) {
  _inherits(DataConnection, _Connection);

  /**
   * Create a data connection to another peer.
   * @param {string} remoteId - The peerId of the peer you are connecting to.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {string} [options.connectionId] - An ID to uniquely identify the connection. Defaults to random string if not specified.
   * @param {string} [options.serialization] - How to serialize data when sending. One of 'binary', 'json' or 'none'.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {string} [options.queuedMessages] - An array of messages that were already received before the connection was created.
   * @param {string} [options.payload] - An offer message that triggered creating this object.
   */
  function DataConnection(remoteId, options) {
    _classCallCheck(this, DataConnection);

    var _this = _possibleConstructorReturn(this, (DataConnection.__proto__ || Object.getPrototypeOf(DataConnection)).call(this, remoteId, options));

    _this._idPrefix = 'dc_';
    _this.type = 'data';

    _this._isOnOpenCalled = false;

    /**
     * Label to easily identify the DataConnection on either peer.
     * @type {string}
     */
    _this.label = _this._options.label || _this.id;

    // Serialization is binary by default
    if (_this._options.serialization) {
      if (!DataConnection.SERIALIZATIONS.get(_this._options.serialization)) {
        // Can't emit error as there hasn't been a chance to set up listeners
        throw new Error('Invalid serialization');
      }
      _this.serialization = _this._options.serialization;
    } else {
      _this.serialization = DataConnection.SERIALIZATIONS.binary.key;
    }

    // New send code properties
    _this._sendBuffer = [];
    _this._receivedData = {};
    // Messages stored by peer because DC was not ready yet
    _this._queuedMessages = _this._options.queuedMessages || [];

    // Maybe don't need this anymore
    if (_this._options.payload) {
      _this._peerBrowser = _this._options.payload.browser;
    }

    // This replaces the PeerJS 'initialize' method
    _this._negotiator.on(_negotiator2.default.EVENTS.dcCreated.key, function (dc) {
      _this._dc = dc;
      _this._dc.binaryType = 'arraybuffer';
      _this._setupMessageHandlers();

      // Manually call dataChannel.onopen() if the dataChannel opened before the event handler was set.
      // This can happen if the tab is in the background in Chrome as the event loop is handled differently.
      if (!_this._isOnOpenCalled && _this._dc.readyState === 'open') {
        _this._dc.onopen();
      }
    });

    // If this is not the originator, we need to set the pcConfig
    if (_this._options.payload) {
      _this._options.payload.pcConfig = _this._options.pcConfig;
    }

    _this._negotiator.startConnection(_this._options.payload || {
      originator: true,
      type: 'data',
      label: _this.label,
      pcConfig: _this._options.pcConfig
    });
    _this._pcAvailable = true;

    _this._handleQueuedMessages();
    return _this;
  }

  /**
   * Set up data channel event and message handlers.
   * @private
   */


  _createClass(DataConnection, [{
    key: '_setupMessageHandlers',
    value: function _setupMessageHandlers() {
      var _this2 = this;

      this._dc.onopen = function () {
        if (_this2._isOnOpenCalled) {
          return;
        }

        _logger2.default.log('Data channel connection success');
        _this2.open = true;
        _this2._isOnOpenCalled = true;
        _this2.emit(DataConnection.EVENTS.open.key);
      };

      // We no longer need the reliable shim here
      this._dc.onmessage = function (msg) {
        _this2._handleDataMessage(msg);
      };

      this._dc.onclose = function () {
        _logger2.default.log('DataChannel closed for:', _this2.id);
        _this2.close();
      };

      this._dc.onerror = function (err) {
        _logger2.default.error(err);
      };
    }

    /**
     * Handle a data message from the peer.
     * @param {object} msg - The data message to handle.
     * @private
     */

  }, {
    key: '_handleDataMessage',
    value: function _handleDataMessage(msg) {
      if (this.serialization === DataConnection.SERIALIZATIONS.none.key) {
        this.emit(DataConnection.EVENTS.data.key, msg.data);
        return;
      } else if (this.serialization === DataConnection.SERIALIZATIONS.json.key) {
        this.emit(DataConnection.EVENTS.data.key, JSON.parse(msg.data));
        return;
      }

      // Everything below is for serialization binary or binary-utf8

      var dataMeta = _jsBinarypack2.default.unpack(msg.data);

      // If we haven't started receiving pieces of data with a given id, this will be undefined
      // In that case, we need to initialise receivedData[id] to hold incoming file chunks
      var currData = this._receivedData[dataMeta.id];
      if (!currData) {
        currData = this._receivedData[dataMeta.id] = {
          size: dataMeta.size,
          type: dataMeta.type,
          name: dataMeta.name,
          mimeType: dataMeta.mimeType,
          totalParts: dataMeta.totalParts,
          parts: new Array(dataMeta.totalParts),
          receivedParts: 0
        };
      }
      currData.receivedParts++;
      currData.parts[dataMeta.index] = dataMeta.data;

      if (currData.receivedParts === currData.totalParts) {
        delete this._receivedData[dataMeta.id];

        // recombine the sliced arraybuffers
        var ab = _util2.default.joinArrayBuffers(currData.parts);
        var unpackedData = _jsBinarypack2.default.unpack(ab);

        var finalData = void 0;
        switch (currData.type) {
          case 'Blob':
            finalData = new Blob([new Uint8Array(unpackedData)], { type: currData.mimeType });
            break;
          case 'File':
            finalData = new File([new Uint8Array(unpackedData)], currData.name, { type: currData.mimeType });
            break;
          default:
            finalData = unpackedData;
        }

        this.emit(DataConnection.EVENTS.data.key, finalData);
      }
    }

    /**
     * Send data to peer. If serialization is 'binary', it will chunk it before sending.
     * @param {*} data - The data to send to the peer.
     */

  }, {
    key: 'send',
    value: function send(data) {
      var _this3 = this;

      if (!this.open) {
        this.emit(DataConnection.EVENTS.error.key, new Error('Connection is not open. You should listen for the `open` event before sending messages.'));
        return;
      }

      if (data === undefined || data === null) {
        return;
      }

      if (this.serialization === DataConnection.SERIALIZATIONS.none.key) {
        this._sendBuffer.push(data);
        this._startSendLoop();
        return;
      } else if (this.serialization === DataConnection.SERIALIZATIONS.json.key) {
        this._sendBuffer.push(JSON.stringify(data));
        this._startSendLoop();
        return;
      }

      // Everything below is for serialization binary or binary-utf8

      var packedData = _jsBinarypack2.default.pack(data);
      var size = packedData.size;
      var type = data.constructor.name;

      var dataMeta = {
        id: _util2.default.randomId(),
        type: type,
        size: size,
        totalParts: 0
      };

      if (type === 'File') {
        dataMeta.name = data.name;
      }
      if (data instanceof Blob) {
        dataMeta.mimeType = data.type;
      }

      // dataMeta contains all possible parameters by now.
      // Adjust the chunk size to avoid issues with sending
      var chunkSize = _config2.default.maxChunkSize - (0, _objectSizeof2.default)(dataMeta);
      var numSlices = Math.ceil(size / chunkSize);
      dataMeta.totalParts = numSlices;

      // Perform any required slicing
      for (var sliceIndex = 0; sliceIndex < numSlices; sliceIndex++) {
        var slice = packedData.slice(sliceIndex * chunkSize, (sliceIndex + 1) * chunkSize);
        dataMeta.index = sliceIndex;
        dataMeta.data = slice;

        // Add all chunks to our buffer and start the send loop (if we haven't already)
        _util2.default.blobToArrayBuffer(_jsBinarypack2.default.pack(dataMeta), function (ab) {
          _this3._sendBuffer.push(ab);
          _this3._startSendLoop();
        });
      }
    }

    /**
     * Disconnect from remote peer.
     * @fires DataConnection#close
     */

  }, {
    key: 'close',
    value: function close() {
      _get(DataConnection.prototype.__proto__ || Object.getPrototypeOf(DataConnection.prototype), 'close', this).call(this);

      this._isOnOpenCalled = false;
    }

    /**
     * Start sending messages at intervals to allow other threads to run.
     * @private
     */

  }, {
    key: '_startSendLoop',
    value: function _startSendLoop() {
      var _this4 = this;

      if (!this.sendInterval) {
        // Define send interval
        // Try sending a new chunk with every callback
        this.sendInterval = setInterval(function () {
          // Might need more extensive buffering than this:
          var currMsg = _this4._sendBuffer.shift();
          try {
            _this4._dc.send(currMsg);
          } catch (error) {
            _this4._sendBuffer.push(currMsg);
          }

          if (_this4._sendBuffer.length === 0) {
            clearInterval(_this4.sendInterval);
            _this4.sendInterval = undefined;
          }
        }, _config2.default.sendInterval);
      }
    }

    /**
     * Possible serializations for the DataConnection.
     * @type {Enum}
     */

  }], [{
    key: 'SERIALIZATIONS',
    get: function get() {
      return DCSerializations;
    }

    /**
     * Events the DataConnection class can emit.
     * @type {Enum}
     */

  }, {
    key: 'EVENTS',
    get: function get() {
      return DCEvents;
    }

    /**
     * DataConnection created event.
     *
     * @event DataConnection#open
     */

    /**
     * Data received from peer.
     *
     * @event DataConnection#data
     * @type {*}
     */

    /**
     * Error occurred.
     *
     * @event DataConnection#error
     * @type {Error}
     */

  }]);

  return DataConnection;
}(_connection2.default);

exports.default = DataConnection;