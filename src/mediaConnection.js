'use strict';

const Connection = require('./connection');
const Negotiator = require('./negotiator');
const util = require('./util');

const Enum = require('enum');

const MCEvents = new Enum([
  'stream',
  'removeStream'
]);

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

    if (this._options.originator) {
      this._negotiator.startConnection(
        {
          type:       'media',
          stream:     this.localStream,
          originator: this._options.originator,
          pcConfig:   this._options.pcConfig
        }
      );
      this._pcAvailable = true;
      this._handleQueuedMessages();
    }
  }

  /**
   * Create and send an answer message.
   * @param {MediaStream} stream - The stream to send to the peer.
   */
  answer(stream) {
    if (this.localStream) {
      util.warn('localStream already exists on this MediaConnection. Are you answering a call twice?');
      return;
    }

    this._options.payload.stream = stream;

    this.localStream = stream;
    this._negotiator.startConnection(
      {
        type:       'media',
        stream:     this.localStream,
        originator: false,
        offer:      this._options.payload.offer,
        pcConfig:   this._options.pcConfig
      }
    );
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

  _setupNegotiatorMessageHandlers() {
    super._setupNegotiatorMessageHandlers();

    this._negotiator.on(Negotiator.EVENTS.addStream.key, remoteStream => {
      util.log('Receiving stream', remoteStream);

      this.remoteStream = remoteStream;

      this.emit(MediaConnection.EVENTS.stream.key, remoteStream);
    });

    this._negotiator.on(Negotiator.EVENTS.removeStream.key, remoteStream => {
      util.log('Stream removed', remoteStream);

      // Don't unset if a new stream has already replaced the old one
      if (this.remoteStream === remoteStream) {
        this.remoteStream = null;
      }
      this.emit(MediaConnection.EVENTS.removeStream.key, remoteStream);
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

  /**
   * MediaStream from peer was removed.
   *
   * @event MediaConnection#removeStream
   * @type {MediaStream}
   */
}

module.exports = MediaConnection;
