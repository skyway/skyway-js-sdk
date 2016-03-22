'use strict';

const Connection = require('./connection');
const util       = require('./util');
const Enum       = require('enum');

const DCEvents = new Enum([
  'open',
  'data',
  'error'
]);

class DataConnection extends Connection {
  constructor(remoteId, options) {
    super(remoteId, options);

    this._idPrefix = 'dc_';
    this.type = 'data';
    this.label = this.options.label || this.id;
    this.serialization = this.options.serialization;

    // Data channel buffering.
    this._buffer = [];
    this._isBuffering = false;

    // For storing chunks of large messages
    this._chunkedData = {};

    if (this.options._payload) {
      this._peerBrowser = this.options._payload.browser;
    }

    // Messages stored by peer because DC was not ready yet
    this._queuedMessages = this.options._queuedMessages || [];

    // This replaces the PeerJS 'initialize' method
    this._negotiator.on('dcReady', dc => {
      this._dc = dc;
      this._dc.binaryType = 'arraybuffer';
      this._setupMessageHandlers();
    });

    this._negotiator.startConnection(
      this.options._payload || {
        originator: true,
        type:       'data',
        label:      this.label
      }
    );
    this._pcAvailable = true;

    this._handleQueuedMessages();
  }

  _setupMessageHandlers() {
    this._dc.onopen = () => {
      util.log('Data channel connection success');
      this.open = true;
      this.emit(DataConnection.EVENTS.open.key);
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
          this.emit(DataConnection.EVENTS.data.key, data);
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

    this.emit(DataConnection.EVENTS.data.key, data);
  }

  // New send method
  send(data) {
    if (!this.open) {
      this.emit(DataConnection.EVENTS.error.key, new Error('Connection is not open.' +
        ' You should listen for the `open` event before sending messages.'));
    }

    const numSlices = Math.ceil(data.size/util.chunkedMTU);
    const dataMeta = {
      //name: data.name,
      size: data.size,
      type: file.type,
      totalParts: numSlices
    }

    if (numSlices > 1) {
      // Needs chunking
      for (let sliceIndex = 0; sliceIndex < numSlices; sliceIndex++) {
        const slice = data.slice(sliceIndex * sliceSize, (sliceIndex + 1) * sliceSize);
        dataMeta.index = sliceIndex;
        dataMeta.data = slice;

        // Send chunks
      }
    }

    // Else normal send
  }

  startSendLoop() {
    if(!sendInterval) {
      // Define send interval
    }
  }

  send(data, chunked) {
    if (!this.open) {
      this.emit(DataConnection.EVENTS.error.key, new Error('Connection is not open.' +
        ' You should listen for the `open` event before sending messages.'));
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

  // Called from send()
  //
  // If we are buffering, message is added to the buffer
  // Otherwise try sending, and start buffering if it fails
  _bufferedSend(msg) {
    if (this._isBuffering || !this._trySend(msg)) {
      this._buffer.push(msg);
    }
  }

  // Called from _bufferedSend()
  //
  // Try sending data over the dataChannel
  // If an error occurs, wait and try sending using a buffer
  _trySend(msg) {
    try {
      this._dc.send(msg);
    } catch (error) {
      this._isBuffering = true;

      setTimeout(() => {
        // Try again
        this._isBuffering = false;
        this._tryBuffer();
      }, 100);
      return false;
    }
    return true;
  }

  // Called from _trySend() when buffering
  //
  // Recursively tries to send all messages in the buffer, until the buffer is empty
  _tryBuffer() {
    if (this._buffer.length === 0) {
      return;
    }

    const msg = this._buffer[0];

    if (this._trySend(msg)) {
      this._buffer.shift();
      this._tryBuffer();
    }
  }

  // Called from send()
  //
  // Chunks a blob, then re-calls send() with each chunk in turn
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
