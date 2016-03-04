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

    // TODO use util.extend (or Object.assign)
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

  // TODO: move into the negotiator class to handle signalling directly?
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

  close() {
    if (!this.open) {
      return;
    }
    this.open = false;
    this._negotiator.cleanup(this);
    this.emit('close');
  }
}

module.exports = Connection;
