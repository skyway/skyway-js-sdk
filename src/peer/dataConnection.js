import BinaryPack from 'js-binarypack';
import Enum from 'enum';
import sizeof from 'object-sizeof';

import Negotiator from './negotiator';
import Connection from './connection';
import util from '../shared/util';
import logger from '../shared/logger';
import config from '../shared/config';

const DCEvents = new Enum(['open', 'data', 'error']);

DCEvents.extend(Connection.EVENTS.enums);

const DCSerializations = new Enum(['binary', 'binary-utf8', 'json', 'none']);

/**
 * Class that manages data connections to other peers.
 * @extends Connection
 */
class DataConnection extends Connection {
  /**
   * Create a data connection to another peer.
   * @param {string} remoteId - The peerId of the peer you are connecting to.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {string} [options.connectionId] - An ID to uniquely identify the connection. Defaults to random string if not specified.
   * @param {string} [options.serialization] - How to serialize data when sending. One of 'binary', 'json' or 'none'.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {Object} [options.dcInit] - Options passed to createDataChannel() as a RTCDataChannelInit.
   *                  See https://www.w3.org/TR/webrtc/#dom-rtcdatachannelinit
   * @param {string} [options.queuedMessages] - An array of messages that were already received before the connection was created.
   * @param {string} [options.payload] - An offer message that triggered creating this object.
   */
  constructor(remoteId, options) {
    super(remoteId, options);

    this._idPrefix = 'dc_';
    this.type = 'data';

    this._isOnOpenCalled = false;

    /**
     * Label to easily identify the DataConnection on either peer.
     * @type {string}
     */
    this.label = this._options.label || this.id;

    // Use reliable mode by default
    this.dcInit = this._options.dcInit || {};

    // Serialization is binary by default
    this.serialization = DataConnection.SERIALIZATIONS.binary.key;
    if (this._options.serialization) {
      if (!DataConnection.SERIALIZATIONS.get(this._options.serialization)) {
        // Can't emit error as there hasn't been a chance to set up listeners
        throw new Error('Invalid serialization');
      }
      this.serialization = this._options.serialization;

      if (this._isUnreliableDCInit(this.dcInit)) {
        logger.warn(
          'You can not specify serialization with unreliable mode enabled.'
        );
        this.serialization = DataConnection.SERIALIZATIONS.binary.key;
      }
    }

    // New send code properties
    this._sendBuffer = [];
    this._receivedData = {};
    // Messages stored by peer because DC was not ready yet
    this._queuedMessages = this._options.queuedMessages || [];

    // This replaces the PeerJS 'initialize' method
    this._negotiator.on(Negotiator.EVENTS.dcCreated.key, dc => {
      this._dc = dc;
      this._dc.binaryType = 'arraybuffer';
      this._setupMessageHandlers();

      // Manually call dataChannel.onopen() if the dataChannel opened before the event handler was set.
      // This can happen if the tab is in the background in Chrome as the event loop is handled differently.
      if (!this._isOnOpenCalled && this._dc.readyState === 'open') {
        this._dc.onopen();
      }
    });

    // If this is not the originator, we need to set the pcConfig
    if (this._options.payload) {
      this._options.payload.pcConfig = this._options.pcConfig;
    }
  }

  /**
   * Start connection via negotiator and handle queued messages.
   * @return {Promise<void>} Promise that resolves when starting is done.
   */
  async startConnection() {
    await this._negotiator.startConnection(
      this._options.payload || {
        originator: true,
        type: 'data',
        label: this.label,
        dcInit: this.dcInit,
        pcConfig: this._options.pcConfig,
      }
    );

    this._pcAvailable = true;
    this._handleQueuedMessages();
  }

  /**
   * Set up data channel event and message handlers.
   * @private
   */
  _setupMessageHandlers() {
    this._dc.onopen = () => {
      if (this._isOnOpenCalled) {
        return;
      }

      logger.log('Data channel connection success');
      this.open = true;
      this._isOnOpenCalled = true;
      this.emit(DataConnection.EVENTS.open.key);
    };

    // We no longer need the reliable shim here
    this._dc.onmessage = msg => {
      this._handleDataMessage(msg);
    };

    this._dc.onclose = () => {
      logger.log('DataChannel closed for:', this.id);
      this.close();
    };

    this._dc.onerror = err => {
      logger.error(err);
    };
  }

  /**
   * Handle a data message from the peer.
   * @param {object} msg - The data message to handle.
   * @private
   */
  _handleDataMessage(msg) {
    if (this.serialization === DataConnection.SERIALIZATIONS.none.key) {
      this.emit(DataConnection.EVENTS.data.key, msg.data);
      return;
    } else if (this.serialization === DataConnection.SERIALIZATIONS.json.key) {
      this.emit(DataConnection.EVENTS.data.key, JSON.parse(msg.data));
      return;
    }

    // Everything below is for serialization binary or binary-utf8

    const dataMeta = BinaryPack.unpack(msg.data);

    // If we haven't started receiving pieces of data with a given id, this will be undefined
    // In that case, we need to initialise receivedData[id] to hold incoming file chunks
    let currData = this._receivedData[dataMeta.id];
    if (!currData) {
      currData = this._receivedData[dataMeta.id] = {
        size: dataMeta.size,
        type: dataMeta.type,
        name: dataMeta.name,
        mimeType: dataMeta.mimeType,
        totalParts: dataMeta.totalParts,
        parts: new Array(dataMeta.totalParts),
        receivedParts: 0,
      };
    }
    currData.receivedParts++;
    currData.parts[dataMeta.index] = dataMeta.data;

    if (currData.receivedParts === currData.totalParts) {
      delete this._receivedData[dataMeta.id];

      // recombine the sliced arraybuffers
      const ab = util.joinArrayBuffers(currData.parts);
      const unpackedData = BinaryPack.unpack(ab);

      let finalData;
      switch (currData.type) {
        case 'Blob':
          finalData = new Blob([new Uint8Array(unpackedData)], {
            type: currData.mimeType,
          });
          break;
        case 'File':
          finalData = new File([new Uint8Array(unpackedData)], currData.name, {
            type: currData.mimeType,
          });
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
  send(data) {
    if (!this.open) {
      this.emit(
        DataConnection.EVENTS.error.key,
        new Error(
          'Connection is not open. You should listen for the `open` event before sending messages.'
        )
      );
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

    const packedData = BinaryPack.pack(data);
    const size = packedData.size;
    const type = data.constructor.name;

    const dataMeta = {
      id: util.randomId(),
      type: type,
      size: size,
      totalParts: 0,
    };

    if (type === 'File') {
      dataMeta.name = data.name;
    }
    if (data instanceof Blob) {
      dataMeta.mimeType = data.type;
    }

    // dataMeta contains all possible parameters by now.
    // Adjust the chunk size to avoid issues with sending
    const chunkSize = config.maxChunkSize - sizeof(dataMeta);
    const numSlices = Math.ceil(size / chunkSize);
    dataMeta.totalParts = numSlices;

    // Perform any required slicing
    for (let sliceIndex = 0; sliceIndex < numSlices; sliceIndex++) {
      const slice = packedData.slice(
        sliceIndex * chunkSize,
        (sliceIndex + 1) * chunkSize
      );
      dataMeta.index = sliceIndex;
      dataMeta.data = slice;

      // Add all chunks to our buffer and start the send loop (if we haven't already)
      util.blobToArrayBuffer(BinaryPack.pack(dataMeta), ab => {
        this._sendBuffer.push(ab);
        this._startSendLoop();
      });
    }
  }

  /**
   * Disconnect from remote peer.
   * @fires DataConnection#close
   */
  close(forceClose) {
    super.close(forceClose);

    this._isOnOpenCalled = false;
  }

  /**
   * Start sending messages at intervals to allow other threads to run.
   * @private
   */
  _startSendLoop() {
    if (!this.sendInterval) {
      // Define send interval
      // Try sending a new chunk with every callback
      this.sendInterval = setInterval(() => {
        // Might need more extensive buffering than this:
        const currMsg = this._sendBuffer.shift();
        try {
          this._dc.send(currMsg);
        } catch (error) {
          this._sendBuffer.push(currMsg);
        }

        if (this._sendBuffer.length === 0) {
          clearInterval(this.sendInterval);
          this.sendInterval = undefined;
        }
      }, config.sendInterval);
    }
  }

  /**
   * Check dcInit argument is valid to enable unreliable mode.
   * See https://www.w3.org/TR/webrtc/#dom-rtcdatachannelinit
   * @param {Object} dcInit - Options passed to createDataChannel() as a RTCDataChannelInit.
   *                  See https://www.w3.org/TR/webrtc/#dom-rtcdatachannelinit
   * @return {boolean} Returns this dcInit has valid properties to enable unreliable mode.
   */
  _isUnreliableDCInit(dcInit) {
    if (!dcInit) {
      return false;
    }

    // Either of these props are passed, works on unreliable mode.
    if ('maxRetransmits' in dcInit || 'maxPacketLifeTime' in dcInit) {
      return true;
    }

    return false;
  }

  /**
   * Possible serializations for the DataConnection.
   * @type {Enum}
   */
  static get SERIALIZATIONS() {
    return DCSerializations;
  }

  /**
   * Events the DataConnection class can emit.
   * @type {Enum}
   */
  static get EVENTS() {
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
}

export default DataConnection;
