import Enum from 'enum';

import Negotiator from './negotiator';
import Connection from './connection';
import logger from '../shared/logger';

const MCEvents = new Enum(['stream']);

MCEvents.extend(Connection.EVENTS.enums);

/**
 * Class that manages data connections to other peers.
 * @extends Connection
 */
class MediaConnection extends Connection {
  /**
   * Create a data connection to another peer.
   * @param {string} remoteId - The peerId of the peer you are connecting to.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {string} [options.connectionId] - An ID to uniquely identify the connection. Defaults to random string if not specified.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {object} [options.pcConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {object} [options.stream] - The MediaStream to send to the remote peer. Set only when on the caller side.
   * @param {boolean} [options.originator] - true means the peer is the originator of the connection.
   * @param {string} [options.queuedMessages] - An array of messages that were already received before the connection was created.
   * @param {string} [options.payload] - An offer message that triggered creating this object.
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   * @param {boolean} [options.videoReceiveEnabled] - A flag to set video recvonly
   * @param {boolean} [options.audioReceiveEnabled] - A flag to set audio recvonly
   */
  constructor(remoteId, options) {
    super(remoteId, options);

    this._idPrefix = 'mc_';
    this.type = 'media';

    /**
     * The local MediaStream.
     * @type {MediaStream}
     */
    this.localStream = this._options.stream;

    // Messages stored by peer because MC was not ready yet
    this._queuedMessages = this._options.queuedMessages || [];
    this._pcAvailable = false;
  }

  /**
   * Start connection via negotiator and handle queued messages.
   * @return {Promise<void>} Promise that resolves when starting is done.
   */
  async startConnection() {
    if (!this._options.originator) {
      return;
    }

    await this._negotiator.startConnection({
      type: 'media',
      stream: this.localStream,
      originator: this._options.originator,
      pcConfig: this._options.pcConfig,
      videoBandwidth: this._options.videoBandwidth,
      audioBandwidth: this._options.audioBandwidth,
      videoCodec: this._options.videoCodec,
      audioCodec: this._options.audioCodec,
      videoReceiveEnabled: this._options.videoReceiveEnabled,
      audioReceiveEnabled: this._options.audioReceiveEnabled,
    });

    this._pcAvailable = true;
    this._handleQueuedMessages();
  }

  /**
   * Create and send an answer message.
   * @param {MediaStream} stream - The stream to send to the peer.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   */
  answer(stream, options = {}) {
    if (this.localStream) {
      logger.warn(
        'localStream already exists on this MediaConnection. Are you answering a call twice?'
      );
      return;
    }

    this._options.payload.stream = stream;

    this.localStream = stream;
    this._negotiator.startConnection({
      type: 'media',
      stream: this.localStream,
      originator: false,
      offer: this._options.payload.offer,
      pcConfig: this._options.pcConfig,
      audioBandwidth: options.audioBandwidth,
      videoBandwidth: options.videoBandwidth,
      videoCodec: options.videoCodec,
      audioCodec: options.audioCodec,
    });
    this._pcAvailable = true;

    this._handleQueuedMessages();

    this.open = true;
  }

  /**
   * Replace the stream being sent with a new one.
   * @param {MediaStream} newStream - The stream to replace the old stream with.
   */
  replaceStream(newStream) {
    this._negotiator.replaceStream(newStream);
    this.localStream = newStream;
  }

  /**
   * Set up negotiator message handlers.
   * @private
   */
  _setupNegotiatorMessageHandlers() {
    super._setupNegotiatorMessageHandlers();

    this._negotiator.on(Negotiator.EVENTS.addStream.key, remoteStream => {
      logger.log('Receiving stream', remoteStream);

      // return if the remoteStream which we will add already exists
      if (this.remoteStream && this.remoteStream.id === remoteStream.id) {
        return;
      }
      this.remoteStream = remoteStream;

      this.emit(MediaConnection.EVENTS.stream.key, remoteStream);
    });
  }

  /**
   * Events the MediaConnection class can emit.
   * @type {Enum}
   */
  static get EVENTS() {
    return MCEvents;
  }

  /**
   * MediaStream received from peer.
   *
   * @event MediaConnection#stream
   * @type {MediaStream}
   */
}

export default MediaConnection;
