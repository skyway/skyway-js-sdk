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

    // Serialization is binary by default
    if (this.options.serialization) {
      this.serialization = this.options.serialization;
    } else {
      this.serialization = 'binary';
    }

    // New send code properties
    this.sendBuffer = [];
    this.receivedData = {};
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
    const dataMeta = util.unpack(msg.data);
    console.log(dataMeta.type);

    let currData = this.receivedData[dataMeta.id];
    if (!currData) {
      currData = this.receivedData[dataMeta.id] = {
        size:          dataMeta.size,
        type:          dataMeta.type,
        name:          dataMeta.name,
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
      // Creating a File should simply work as a Blob with a filename
      let blob = new File(currData.parts, currData.name, {type: currData.type});

      if (this.serialization === 'binary' || this.serialization === 'binary-utf8') {
        // We want to convert any type of data to an ArrayBuffer
        util.blobToArrayBuffer(util.pack(blob), ab => {
          // It seems there is an additional BinaryPack step included somewhere
          // if serialization is 'binary'...
          this.emit(DataConnection.EVENTS.data.key, util.unpack(ab));
        });
      } else if (this.serialization === 'json') {
        // To convert back to JSON from Blob type, we need to convert to AB and unpack
        // This is identical to 'binary' serialization processing, but keeping it separate for now
        util.blobToArrayBuffer(blob, ab => {
          this.emit(DataConnection.EVENTS.data.key, util.unpack(ab));
        });
      } else if (this.serialization === 'none') {
        // No serialization
        if (currData.type === 'string') {
          util.blobToBinaryString(blob, str => {
            this.emit(DataConnection.EVENTS.data.key, str);
          });
        } else if (currData.type === 'arraybuffer') {
          util.blobToArrayBuffer(blob, ab => {
            this.emit(DataConnection.EVENTS.data.key, ab);
          });
        } else {
          // Blob or File
          this.emit(DataConnection.EVENTS.data.key, blob);
          delete this.receivedData[dataMeta.id];
        }
      }
    }
  }

  // New send method
  send(data) {
    if (!this.open) {
      this.emit(DataConnection.EVENTS.error.key, new Error('Connection is not open.' +
        ' You should listen for the `open` event before sending messages.'));
    }

    let type;
    let size;
    let name;

    if (this.serialization === 'json') {
      type = 'json';
      // JSON undergoes an extra BinaryPack step for compression
      data = util.pack(data);
      size = data.size;
    }

    if (data instanceof Blob) {
      // Should be a Blob or File
      type = data.type;
      size = data.size;
      name = data.name;
    } else if (data instanceof ArrayBuffer) {
      type = 'arraybuffer';
      size = data.byteLength;
    } else if (typeof data === 'string') {
      type = 'string';
      size =  Buffer.byteLength(data, 'utf8');
    }

    const numSlices = Math.ceil(size / util.maxChunkSize);
    const dataMeta = {
      id:         util.generateDataId(),
      type:       type,
      size:       size,
      name:       name,
      totalParts: numSlices
    };

    // Perform any required slicing
    for (let sliceIndex = 0; sliceIndex < numSlices; sliceIndex++) {
      const slice = data.slice(sliceIndex * util.maxChunkSize, (sliceIndex + 1) * util.maxChunkSize);
      dataMeta.index = sliceIndex;
      dataMeta.data = slice;

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

  static get EVENTS() {
    return DCEvents;
  }
}

module.exports = DataConnection;
