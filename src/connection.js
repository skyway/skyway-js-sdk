'use strict';

const util = require('./util');
const Negotiator = require('./negotiator');

const EventEmitter = require('events');

// Log ENUM setup. 'enumify' is only used with `import`, not 'require'.
import {Enum} from 'enumify';
class ConnectionEvents extends Enum {}
ConnectionEvents.initEnum([
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

  handleAnswer(answer) {
    if (this._pcAvailable) {
      this._negotiator.handleAnswer(answer);
      this.open = true;
    } else {
      this._queuedMessages.push({type: util.MESSAGE_TYPES.ANSWER.name, payload: answer});
    }
  }

  handleCandidate(candidate) {
    if (this._pcAvailable) {
      this._negotiator.handleCandidate(candidate);
    } else {
      this._queuedMessages.push({type: util.MESSAGE_TYPES.CANDIDATE.name, payload: candidate});
    }
  }

  _handleQueuedMessages() {
    // Process messages queued because PeerConnection not set up.
    for (let message of this._queuedMessages) {
      switch (message.type) {
        case util.MESSAGE_TYPES.ANSWER.name:
          this.handleAnswer(message.payload);
          break;
        case util.MESSAGE_TYPES.CANDIDATE.name:
          this.handleCandidate(message.payload);
          break;
        default:
          util.warn('Unrecognized message type:', message.type, 'from peer:', this.peer);
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
    this._negotiator.on(Negotiator.EVENTS.answerCreated.name, answer => {
      const connectionAnswer = {
        answer:         answer,
        dst:            this.remoteId,
        connectionId:   this.id,
        connectionType: this.type
      };
      this.emit(Connection.EVENTS.answer.name, connectionAnswer);
    });

    this._negotiator.on(Negotiator.EVENTS.offerCreated.name, offer => {
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
      this.emit(Connection.EVENTS.offer.name, connectionOffer);
    });

    this._negotiator.on(Negotiator.EVENTS.iceCandidate.name, candidate => {
      const connectionCandidate = {
        candidate:      candidate,
        dst:            this.remoteId,
        connectionId:   this.id,
        connectionType: this.type
      };
      this.emit(Connection.EVENTS.candidate.name, connectionCandidate);
    });
  }

  static get EVENTS() {
    return ConnectionEvents;
  }
}

module.exports = Connection;
