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

    // New send code properties
    this.sendBuffer = [];
    this.receivedData = {};

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

  _handleDataMessage(msg) {
    const dataMeta = util.unpack(msg);
    console.log(dataMeta.type);

    let currData = this.receivedData[dataMeta.id];
    if (!currData) {
      currData = this.receivedData[dataMeta.id] = {
        size:          dataMeta.size,
        type:          dataMeta.type,
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
      let blob = new Blob(currData.parts);

      if (currData.type === 'string') {
        util.blobToBinaryString(blob, str => {
          this.emit(DataConnection.EVENTS.data.key, str);
        });
      } else if (currData.type === 'json') {
        // NOTE: To convert back from Blob type, convert to AB and unpack!
        util.blobToArrayBuffer(blob, ab => {
          this.emit(DataConnection.EVENTS.data.key, util.unpack(ab));
        });
      } else if (currData.type === 'arraybuffer') {
        this.emit(DataConnection.EVENTS.data.key, blob);
      } else {
        // Blob or File
        const file = new File([blob], currData.name, {type: currData.type});
        this.emit(DataConnection.EVENTS.data.key, file);
      }
    }
  }

  // New send method
  send(data) {
    if (!this.open) {
      this.emit(DataConnection.EVENTS.error.key, new Error('Connection is not open.' +
        ' You should listen for the `open` event before sending messages.'));
    }

    const dataMeta = {
      id:   util.generateDataId(),
      size: data.size
    };

    if (typeof data === 'string') {
      dataMeta.type = 'string';
      dataMeta.size = this.getBinarySize(data);
    } else if (typeof data === 'object') {
      dataMeta.type = 'json';
      data = util.pack(data);
      dataMeta.size = data.size;
      console.log('type json');
    } else if (data instanceof ArrayBuffer) {
      dataMeta.type = 'arraybuffer';
    } else if (data instanceof File) {
      dataMeta.name = data.name;
      dataMeta.type = data.type;
    } else {
      // Should be a Blob
      dataMeta.type = data.type;
    }

    const numSlices = Math.ceil(dataMeta.size / util.maxChunkSize);
    dataMeta.totalParts = numSlices;
    console.log('num slices: ' + numSlices);

    // Perform any required slicing
    for (let sliceIndex = 0; sliceIndex < numSlices; sliceIndex++) {
      const slice = data.slice(sliceIndex * util.maxChunkSize, (sliceIndex + 1) * util.maxChunkSize);
      dataMeta.index = sliceIndex;
      dataMeta.data = slice;
      console.log('sliced up');

      // Add all chunks to our buffer and start the send loop (if we haven't already)
      util.blobToArrayBuffer(util.pack(dataMeta), ab => {
        this.sendBuffer.push(ab);
        this.startSendLoop();
      });
    }
  }

  startSendLoop() {
    if (!this.sendInterval) {
      // Define send interval
      // Try sending a new chunk every millisecond
      this.sendInterval = setInterval(() => {
        // Might need more extensive buffering than this:
        let currMsg = this.sendBuffer.shift(1);
        try {
          console.log('Executing?');
          this._dc.send(currMsg);
        } catch (error) {
          this.sendBuffer.push(currMsg);
        }

        if (this.sendBuffer.length === 0) {
          clearInterval(this.sendInterval);
          this.sendInterval = undefined;
        }
      }, 1);
    }
  }

  getBinarySize(string) {
    return Buffer.byteLength(string, 'utf8');
  }

  static get EVENTS() {
    return DCEvents;
  }

}

module.exports = DataConnection;
