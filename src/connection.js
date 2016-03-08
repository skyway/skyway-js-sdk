'use strict';

const util = require('./util');
const Negotiator = require('./negotiator');

const EventEmitter = require('events');

class Connection extends EventEmitter {
  constructor(options) {
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

    this._negotiator = new Negotiator(this);

    this._idPrefix = 'c_';
    this._randomIdSuffix = util.randomToken();
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
}

module.exports = Connection;
