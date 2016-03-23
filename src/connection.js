'use strict';

const util       = require('./util');
const Negotiator = require('./negotiator');

const EventEmitter = require('events');
const Enum         = require('enum');

const ConnectionEvents = new Enum([
  'candidate',
  'offer',
  'answer'
]);

class Connection extends EventEmitter {
  constructor(remoteId, options) {
    super();

    options = options || {};

    // Abstract class
    if (this.constructor === Connection) {
      throw new TypeError('Cannot construct Connection instances directly');
    }

    this.options = options;

    this.open = false;
    this.type = undefined;
    this.metadata = this.options.metadata;
    this.remoteId = remoteId;

    this._negotiator = new Negotiator(this);

    this._idPrefix = 'c_';
    this._randomIdSuffix = util.randomToken();

    this._setupNegotiatorMessageHandlers();
  }

  get id() {
    return this.options.connectionId || this._idPrefix + this._randomIdSuffix;
  }

  handleAnswer(answerMessage) {
    if (this._pcAvailable) {
      this._negotiator.handleAnswer(answerMessage.answer);
      this.open = true;
    } else {
      util.log(`Queuing ANSWER message in ${this.id} from ${this.remoteId}`);
      this._queuedMessages.push({type: util.MESSAGE_TYPES.ANSWER.key, payload: answerMessage});
    }
  }

  handleCandidate(candidateMessage) {
    if (this._pcAvailable) {
      this._negotiator.handleCandidate(candidateMessage.candidate);
    } else {
      util.log(`Queuing CANDIDATE message in ${this.id} from ${this.remoteId}`);
      this._queuedMessages.push({type: util.MESSAGE_TYPES.CANDIDATE.key, payload: candidateMessage});
    }
  }

  _handleQueuedMessages() {
    // Process messages queued because PeerConnection not set up.
    for (let message of this._queuedMessages) {
      switch (message.type) {
        case util.MESSAGE_TYPES.ANSWER.key:
          this.handleAnswer(message.payload);
          break;
        case util.MESSAGE_TYPES.CANDIDATE.key:
          this.handleCandidate(message.payload);
          break;
        default:
          util.warn('Unrecognized message type:', message.type, 'from peer:', this.remoteId);
          break;
      }
    }
    this._queuedMessages = [];
  }

  close() {
    if (!this.open) {
      return;
    }
    this.open = false;
    this._negotiator.cleanup();
    this.emit('close');
  }

  _setupNegotiatorMessageHandlers() {
    this._negotiator.on(Negotiator.EVENTS.answerCreated.key, answer => {
      const connectionAnswer = {
        answer:         answer,
        dst:            this.remoteId,
        connectionId:   this.id,
        connectionType: this.type
      };
      this.emit(Connection.EVENTS.answer.key, connectionAnswer);
    });

    this._negotiator.on(Negotiator.EVENTS.offerCreated.key, offer => {
      const connectionOffer = {
        offer:          offer,
        dst:            this.remoteId,
        connectionId:   this.id,
        connectionType: this.type,
        metadata:       this.metadata
      };
      if (this.serialization) {
        connectionOffer.serialization = this.serialization;
      }
      if (this.label) {
        connectionOffer.label = this.label;
      }
      this.emit(Connection.EVENTS.offer.key, connectionOffer);
    });

    this._negotiator.on(Negotiator.EVENTS.iceCandidate.key, candidate => {
      const connectionCandidate = {
        candidate:      candidate,
        dst:            this.remoteId,
        connectionId:   this.id,
        connectionType: this.type
      };
      this.emit(Connection.EVENTS.candidate.key, connectionCandidate);
    });
  }

  get peer() {
    util.warn(`${this.constructor.name}.peer is deprecated and may be removed from a future version. Please use ${this.constructor.name}.remoteId instead.`);
    return this.remoteId;
  }

  static get EVENTS() {
    return ConnectionEvents;
  }
}

module.exports = Connection;
