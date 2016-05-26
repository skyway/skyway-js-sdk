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

const DCSerializations = new Enum([
  'binary',
  'binary-utf8',
  'json',
  'none'
]);

class DataConnection extends Connection {
  constructor(remoteId, options) {
    super(remoteId, options);

    this._idPrefix = 'dc_';
    this.type = 'data';
    this.label = this.options.label || this.id;

    // Serialization is binary by default
    if (this.options.serialization) {
      if (!DataConnection.SERIALIZATIONS.get(this.options.serialization)) {
        // Can't emit error as there hasn't been a chance to set up listeners
        throw new Error('Invalid serialization');
      }
      this.serialization = this.options.serialization;
    } else {
      this.serialization = DataConnection.SERIALIZATIONS.binary.key;
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
    if (this.serialization === DataConnection.SERIALIZATIONS.none.key) {
      this.emit(DataConnection.EVENTS.data, msg.data);
      return;
    } else if (this.serialization === DataConnection.SERIALIZATIONS.json.key) {
      this.emit(DataConnection.EVENTS.data, JSON.parse(msg.data));
      return;
    }

    // Everything below is for serialization binary or binary-utf8

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

    if (currData.receivedParts === currData.totalParts) {
      delete this._receivedData[dataMeta.id];

      // recombine the sliced arraybuffers
      let ab = util.joinArrayBuffers(currData.parts);
      let unpackedData = util.unpack(ab);

      this.emit(DataConnection.EVENTS.data.key, unpackedData);
    }
  }

  send(data) {
    if (!this.open) {
      this.emit(DataConnection.EVENTS.error.key, new Error('Connection is not open.' +
        ' You should listen for the `open` event before sending messages.'));
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

    let packedData = util.pack(data);
    let size = packedData.size;
    let type = data.constructor.name;

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
      const slice = packedData.slice(sliceIndex * chunkSize, (sliceIndex + 1) * chunkSize);
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

  static get SERIALIZATIONS() {
    return DCSerializations;
  }
}

module.exports = DataConnection;
