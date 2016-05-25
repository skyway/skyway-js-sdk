'use strict';

const Connection = require('./connection');
const util       = require('./util');
const Enum       = require('enum');
const sizeof     = require('object-sizeof');

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

    // Serialization is binary by default
    if (this.options.serialization) {
      this.serialization = this.options.serialization;
    } else {
      this.serialization = 'binary';
    }

    // New send code properties
    this._sendBuffer = [];
    this._receivedData = {};
    // Messages stored by peer because DC was not ready yet
    this._queuedMessages = this.options._queuedMessages || [];

    // Maybe don't need this anymore
    if (this.options._payload) {
      this._peerBrowser = this.options._payload.browser;
    }

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

  _handleDataMessage(msg) {
    if (this.serialization === 'none') {
      this.emit(DataConnection.EVENTS.data, msg);
      return;
    }

    const dataMeta = util.unpack(msg.data);

    // If we haven't started receiving pieces of data with a given id, this will be undefined
    // In that case, we need to initialise receivedData[id] to hold incoming file chunks
    let currData = this._receivedData[dataMeta.id];
    if (!currData) {
      currData = this._receivedData[dataMeta.id] = {
        size:          dataMeta.size,
        type:          dataMeta.type,
        name:          dataMeta.name,
        mimeType:      dataMeta.mimeType,
        totalParts:    dataMeta.totalParts,
        parts:         new Array(dataMeta.totalParts),
        receivedParts: 0
      };
    }
    currData.receivedParts++;
    currData.parts[dataMeta.index] = dataMeta.data;

    // Expected data types:
    // - String
    // - JSON
    // - Blob (File)
    // - ArrayBuffer

    if (currData.receivedParts === currData.totalParts) {
      let blob;
      if (currData.type === 'file') {
        blob = new File(currData.parts, currData.name, {type: currData.mimeType});
      } else {
        blob = new Blob(currData.parts, {type: currData.mimeType});
      }

      if (this.serialization === 'binary' || this.serialization === 'binary-utf8') {
        if (currData.type === 'string') {
          util.blobToString(blob, str => {
            this.emit(DataConnection.EVENTS.data.key, str);
          });
          return;
        }
        util.blobToArrayBuffer(blob, ab => {
          this.emit(DataConnection.EVENTS.data.key, ab);
        });
      } else if (this.serialization === 'json') {
        // To convert back to JSON from Blob type, we need to convert to AB and unpack
        util.blobToArrayBuffer(blob, ab => {
          this.emit(DataConnection.EVENTS.data.key, util.unpack(ab));
        });
      }
      delete this._receivedData[dataMeta.id];
    }
  }

  send(data) {
    if (!this.open) {
      this.emit(DataConnection.EVENTS.error.key, new Error('Connection is not open.' +
        ' You should listen for the `open` event before sending messages.'));
    }

    let type;
    let size;

    if (this.serialization === 'none') {
      this._sendBuffer.push(data);
      this._startSendLoop();
      return;
    }

    if (this.serialization === 'json') {
      type = 'json';
      // JSON undergoes an extra BinaryPack step for compression
      data = util.pack(data);
      size = data.size;
    } else if (data instanceof File) {
      type = 'file';
      size = data.size;
    } else if (data instanceof Blob) {
      type = 'blob';
      size = data.size;
    } else if (data instanceof ArrayBuffer) {
      type = 'arraybuffer';
      size = data.byteLength;
    } else if (typeof data === 'string') {
      type = 'string';
      size =  Buffer.byteLength(data, 'utf8');
    }

    const dataMeta = {
      id:         util.randomId(),
      type:       type,
      size:       size,
      totalParts: 0
    };

    if (type === 'file') {
      dataMeta.name = data.name;
    }
    if (data instanceof Blob) {
      dataMeta.mimeType = data.type;
    }

    // dataMeta contains all possible parameters by now.
    // Adjust the chunk size to avoid issues with sending
    const chunkSize = util.maxChunkSize - sizeof(dataMeta);
    const numSlices = Math.ceil(size / chunkSize);
    dataMeta.totalParts = numSlices;

    // Perform any required slicing
    for (let sliceIndex = 0; sliceIndex < numSlices; sliceIndex++) {
      const slice = data.slice(sliceIndex * chunkSize, (sliceIndex + 1) * chunkSize);
      dataMeta.index = sliceIndex;
      dataMeta.data = slice;

      // Add all chunks to our buffer and start the send loop (if we haven't already)
      util.blobToArrayBuffer(util.pack(dataMeta), ab => {
        this._sendBuffer.push(ab);
        this._startSendLoop();
      });
    }
  }

  _startSendLoop() {
    if (!this.sendInterval) {
      // Define send interval
      // Try sending a new chunk with every callback
      this.sendInterval = setInterval(() => {
        // Might need more extensive buffering than this:
        let currMsg = this._sendBuffer.shift();
        try {
          this._dc.send(currMsg);
        } catch (error) {
          this._sendBuffer.push(currMsg);
        }

        if (this._sendBuffer.length === 0) {
          clearInterval(this.sendInterval);
          this.sendInterval = undefined;
        }
      }, util.sendInterval);
    }
  }

  static get EVENTS() {
    return DCEvents;
  }
}

module.exports = DataConnection;
