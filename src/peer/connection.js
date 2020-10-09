import EventEmitter from 'events';
import Enum from 'enum';

import Negotiator from './negotiator';
import util from '../shared/util';
import logger from '../shared/logger';
import config from '../shared/config';

const ConnectionEvents = new Enum([
  'candidate',
  'offer',
  'answer',
  'close',
  'forceClose',
]);

/**
 * Class that manages connections to other peers.
 * @extends EventEmitter
 */
class Connection extends EventEmitter {
  /**
   * Create a connection to another peer. Cannot be called directly. Must be called by a subclass.
   * @param {string} remoteId - The peerId of the peer you are connecting to.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {string} [options.connectionId] - An ID to uniquely identify the connection.
   *                                          Defaults to random string if not specified.
   */
  constructor(remoteId, options) {
    super();

    options = options || {};

    // Abstract class
    if (this.constructor === Connection) {
      throw new TypeError('Cannot construct Connection instances directly');
    }

    this._options = options;

    /**
     * Whether the Connection has been opened or not.
     * @type {boolean}
     */
    this.open = false;

    /**
     * The connection type. Either 'media' or 'data'.
     * @type {string}
     */
    this.type = undefined;

    /**
     * Any additional information to send to the peer.
     * @type {object}
     */
    this.metadata = this._options.metadata;

    /**
     * PeerId of the peer this connection is connected to.
     * @type {string}
     */
    this.remoteId = remoteId;

    this._negotiator = new Negotiator();

    this._idPrefix = 'c_';
    this._randomIdSuffix = util.randomToken();

    this._setupNegotiatorMessageHandlers();
  }

  /**
   * An id to uniquely identify the connection.
   */
  get id() {
    return this._options.connectionId || this._idPrefix + this._randomIdSuffix;
  }

  /**
   * Handle an sdp answer message from the remote peer.
   * @param {object} answerMessage - Message object containing sdp answer.
   */
  async handleAnswer(answerMessage) {
    if (this._pcAvailable) {
      await this._negotiator.handleAnswer(answerMessage.answer);
      this.open = true;
      this._handleQueuedMessages();
    } else {
      logger.log(`Queuing ANSWER message in ${this.id} from ${this.remoteId}`);
      this._queuedMessages.push({
        type: config.MESSAGE_TYPES.SERVER.ANSWER.key,
        payload: answerMessage,
      });
    }
  }

  /**
   * Handle a candidate message from the remote peer.
   * @param {object} candidateMessage - Message object containing a candidate.
   */
  handleCandidate(candidateMessage) {
    // The orginator(caller) should wait for the remote ANSWER arrival and
    // setRemoteDescription(ANSWER) before handleCandidate(addIceCandidate).
    if (this._negotiator.originator && !this._negotiator.hasRemoteDescription) {
      this._queuedMessages.push({
        type: config.MESSAGE_TYPES.SERVER.CANDIDATE.key,
        payload: candidateMessage,
      });
      return;
    }

    if (this._pcAvailable) {
      this._negotiator.handleCandidate(candidateMessage.candidate);
    } else {
      logger.log(
        `Queuing CANDIDATE message in ${this.id} from ${this.remoteId}`
      );
      this._queuedMessages.push({
        type: config.MESSAGE_TYPES.SERVER.CANDIDATE.key,
        payload: candidateMessage,
      });
    }
  }

  /**
   * Handle an offer message from the remote peer. Allows an offer to be updated.
   * @param {object} offerMessage - Message object containing an offer.
   */
  updateOffer(offerMessage) {
    if (this.open) {
      this._negotiator.handleOffer(offerMessage.offer);
    } else {
      this._options.payload = offerMessage;
    }
  }

  /**
   * Gives a RTCPeerConnection.
   */
  getPeerConnection() {
    if (!this.open) {
      return null;
    }
    return this._negotiator._pc;
  }

  /**
   * Process messages received before the RTCPeerConnection is ready.
   * @private
   */
  _handleQueuedMessages() {
    for (const message of this._queuedMessages) {
      switch (message.type) {
        // Should we remove this ANSWER block
        // because ANSWER should be handled immediately?
        case config.MESSAGE_TYPES.SERVER.ANSWER.key:
          this.handleAnswer(message.payload);
          break;
        case config.MESSAGE_TYPES.SERVER.CANDIDATE.key:
          this.handleCandidate(message.payload);
          break;
        default:
          logger.warn(
            'Unrecognized message type:',
            message.type,
            'from peer:',
            this.remoteId
          );
          break;
      }
    }
    this._queuedMessages = [];
  }

  /**
   * Disconnect from remote peer.
   * @fires Connection#close
   */
  close(forceClose = false) {
    if (!this.open) {
      return;
    }

    this.open = false;
    this._negotiator.cleanup();
    this.emit(Connection.EVENTS.close.key);

    if (forceClose) {
      this.emit(Connection.EVENTS.forceClose.key);
    }
  }

  /**
   * Handle messages from the negotiator.
   * @private
   */
  _setupNegotiatorMessageHandlers() {
    this._negotiator.on(Negotiator.EVENTS.answerCreated.key, answer => {
      const connectionAnswer = {
        answer: answer,
        dst: this.remoteId,
        connectionId: this.id,
        connectionType: this.type,
      };
      this.emit(Connection.EVENTS.answer.key, connectionAnswer);
    });

    this._negotiator.on(Negotiator.EVENTS.offerCreated.key, offer => {
      const connectionOffer = {
        offer: offer,
        dst: this.remoteId,
        connectionId: this.id,
        connectionType: this.type,
        metadata: this.metadata,
      };
      if (this.serialization) {
        connectionOffer.serialization = this.serialization;
      }
      if (this.label) {
        connectionOffer.label = this.label;
      }
      if (this.dcInit) {
        connectionOffer.dcInit = this.dcInit;
      }
      this.emit(Connection.EVENTS.offer.key, connectionOffer);
    });

    this._negotiator.on(Negotiator.EVENTS.iceCandidate.key, candidate => {
      const connectionCandidate = {
        candidate: candidate,
        dst: this.remoteId,
        connectionId: this.id,
        connectionType: this.type,
      };
      this.emit(Connection.EVENTS.candidate.key, connectionCandidate);
    });

    this._negotiator.on(Negotiator.EVENTS.iceConnectionFailed.key, () => {
      this.close();
    });
  }

  /**
   * The remote peerId.
   * @type {string}
   * @deprecated Use remoteId instead.
   */
  get peer() {
    logger.warn(
      `${this.constructor.name}.peer is deprecated and may be removed from a future version.` +
        ` Please use ${this.constructor.name}.remoteId instead.`
    );
    return this.remoteId;
  }

  /**
   * Events the Connection can emit.
   * @type {Enum}
   */
  static get EVENTS() {
    return ConnectionEvents;
  }

  /**
   * ICE candidate created event.
   *
   * @event Connection#candidate
   * @type {object}
   * @property {RTCIceCandidate} candidate - The ice candidate.
   * @property {string} dst - Destination peerId
   * @property {string} connectionId - This connection's id.
   * @property {string} connectionType - This connection's type.
   */

  /**
   * Offer created event.
   *
   * @event Connection#offer
   * @type {object}
   * @property {RTCSessionDescription} offer - The local offer to send to the peer.
   * @property {string} dst - Destination peerId
   * @property {string} connectionId - This connection's id.
   * @property {string} connectionType - This connection's type.
   * @property {object} metadata - Any extra data to send with the connection.
   */

  /**
   * Answer created event.
   *
   * @event Connection#answer
   * @type {object}
   * @property {RTCSessionDescription} answer - The local answer to send to the peer.
   * @property {string} dst - Destination peerId
   * @property {string} connectionId - This connection's id.
   * @property {string} connectionType - This connection's type.
   */

  /**
   * Connection closed event.
   *
   * @event Connection#close
   */

  /**
   * Requested to close the connection.
   *
   * @event Connection#forceClose
   */
}

export default Connection;
