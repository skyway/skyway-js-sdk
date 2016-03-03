'use strict';

const Connection = require('./connection');
const util = require('./util');

// Log ENUM setup. 'enumify' is only used with `import`, not 'require'.
import {Enum} from 'enumify';
class DCEvents extends Enum {}
DCEvents.initEnum([
  'open',
  'data'
]);

class DataConnection extends Connection {
  constructor(options) {
    super(options);

    this._idPrefix = 'dc_';
    this.type = 'data';
    this.label = this.options.label || this.id;
    this.serialization = this.options.serialization;

    // Data channel buffering.
    this._buffer = [];
    this._buffering = false;
    this.bufferSize = 0;

    // For storing large data.
    this._chunkedData = {};

    if (this.options._payload) {
      this._peerBrowser = this.options._payload.browser;
    }

    this._negotiator.startConnection(
      this,
      this.options._payload || {
        originator: true
      }
    );

    // This replaces the PeerJS 'initialize' method
    this._negotiator.on('dc-ready', dc => {
      this._dc = dc;
      this._setupMessageHandlers();
    });
  }

  _setupMessageHandlers() {
    this._dc.onopen = () => {
      util.log('Data channel connection success');
      this.open = true;
      this.emit(DataConnection.EVENTS.open.name);
    };

    // We no longer need the reliable shim here
    this._dc.onmessage = msg => {
      this._handleDataMessage(msg);
    };

    this._dc.onclose = () => {
      util.log('DataChannel closed for:', this.id);
      this.close();
    };
  }

  // Handles a DataChannel message.
  _handleDataMessage(msg) {
    let data = msg.data;
    let datatype = data.constructor;
    if (this.serialization === 'binary' || this.serialization === 'binary-utf8') {
      if (datatype === Blob) {
        // Convert to ArrayBuffer if datatype is Blob
        util.blobToArrayBuffer(data, ab => {
          data = util.unpack(ab);
          this.emit(DataConnection.EVENTS.data.name, data);
        });
        return;
      } else if (datatype === ArrayBuffer) {
        data = util.unpack(data);
      } else if (datatype === String) {
        // String fallback for binary data for browsers that don't support binary yet
        let ab = util.binaryStringToArrayBuffer(data);
        data = util.unpack(ab);
      }
    } else if (this.serialization === 'json') {
      data = JSON.parse(data);
    }

    // Check if we've chunked--if so, piece things back together.
    // We're guaranteed that this isn't 0.
    if (data.__peerData) {
      util.log('Let\'s try chunking!');
      let id = data.__peerData;
      let chunkInfo = this._chunkedData[id] || {data: [], count: 0, total: data.total};

      chunkInfo.data[data.n] = data.data;
      chunkInfo.count += 1;

      if (chunkInfo.total === chunkInfo.count) {
        // Clean up before making the recursive call to `_handleDataMessage`.
        delete this._chunkedData[id];

        // We've received all the chunks--time to construct the complete data.
        data = new Blob(chunkInfo.data);
        this._handleDataMessage({data: data});
      }

      this._chunkedData[id] = chunkInfo;
      return;
    }

    this.emit(DataConnection.EVENTS.data.name, data);
  }

  send(data, chunked) {
    // TODO: Remove lint bypass
    console.log(data, chunked);
  }

  static get EVENTS() {
    return DCEvents;
  }
}

module.exports = DataConnection;
