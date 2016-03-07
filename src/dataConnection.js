'use strict';

const Connection = require('./connection');
const util = require('./util');

// Log ENUM setup. 'enumify' is only used with `import`, not 'require'.
import {Enum} from 'enumify';
class DCEvents extends Enum {}
DCEvents.initEnum([
  'open',
  'data',
  'error'
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
    this._negotiator.on('dcReady', dc => {
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

  // Handles a DataChannel message (i.e. every time we get data from _dc.onmessage)
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
    // At this stage `data` is one type of: ArrayBuffer, String, JSON

    // Check if we've chunked--if so, piece things back together.
    // We're guaranteed that this isn't 0.
    if (data.parentMsgId) {
      let id = data.parentMsgId;
      let chunkInfo = this._chunkedData[id] || {data: [], count: 0, total: data.totalChunks};

      chunkInfo.data[data.chunkIndex] = data.chunkData;
      chunkInfo.count++;

      if (chunkInfo.total === chunkInfo.count) {
        // Clean up before making the recursive call to `_handleDataMessage`.
        delete this._chunkedData[id];

        // We've received all the chunks--time to construct the complete data.
        // Type is Blob - we need to convert to ArrayBuffer before emitting
        data = new Blob(chunkInfo.data);
        this._handleDataMessage({data: data});
      }

      this._chunkedData[id] = chunkInfo;
      return;
    }

    this.emit(DataConnection.EVENTS.data.name, data);
  }

  send(data, chunked) {
    if (!this.open) {
      this.emit(DataConnection.EVENTS.error.name, new Error('Connection is not open. You should listen for the `open` event before sending messages.'));
    }

    if (this.serialization === 'json') {
      this._bufferedSend(JSON.stringify(data));
    } else if (this.serialization === 'binary' || this.serialization === 'binary-utf8') {
      const blob = util.pack(data);

      // For Chrome-Firefox interoperability, we need to make Firefox "chunk" the data it sends out
      const needsChunking = util.chunkedBrowsers[this._peerBrowser] || util.chunkedBrowsers[util.browser];
      if (needsChunking && !chunked && blob.size > util.chunkedMTU) {
        this._sendChunks(blob);
        return;
      }

      if (util.supports && !util.supports.binaryBlob) {
        // We only do this if we really need to (e.g. blobs are not supported),
        // because this conversion is costly
        util.blobToArrayBuffer(blob, arrayBuffer => {
          this._bufferedSend(arrayBuffer);
        });
      } else {
        this._bufferedSend(blob);
      }
    } else {
      this._bufferedSend(data);
    }
  }

  _bufferedSend(msg) {
    if (this.buffering || !this._trySend(msg)) {
      this._buffer.push(msg);
      this.bufferSize = this._buffer.length;
    }
  }

  // returns true if the send succeeds
  _trySend(msg) {
    try {
      this._dc.send(msg);
    } catch (error) {
      this._buffering = true;

      setTimeout(() => {
        // Try again
        this._buffering = true;
        this._tryBuffer();
      }, 100);
      return false;
    }
    return true;
  }

  // Try to send the first message in the buffer
  _tryBuffer() {
    if (this._buffer.length === 0) {
      return;
    }

    const msg = this._buffer[0];

    if (this._trySend(msg)) {
      this._buffer.shift();
      this.bufferSize = this._buffer.length;
      this._tryBuffer();
    }
  }

  _sendChunks(blob) {
    const blobs = util.chunk(blob);
    for (let i = 0; i < blobs.length; i++) {
      let blob = blobs[i];
      this.send(blob, true);
    }
  }

  static get EVENTS() {
    return DCEvents;
  }
}

module.exports = DataConnection;
