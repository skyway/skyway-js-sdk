'use strict';

const util = require('./util');
const Negotiator = require('./negotiator');

const EventEmitter = require('events');

class Connection extends EventEmitter {
  constructor(peer, options) {
    super();

    // Abstract class
    if (this.constructor === Connection) {
      throw new TypeError('Cannot construct Connection instances directly');
    }

    // TODO use util.extend (or Object.assign)
    this.options = options;

    this.open = false;
    this.type = undefined;
    this.peer = peer;
    this.peerId = peer.peerId;
    this.metadata = this.options.metadata;

    this._negotiator = new Negotiator();

    this._idPrefix = 'c_';
    this._randomIdSuffix = util.randomToken();
  }

  get id() {
    return this.options.connectionId || this._idPrefix + this._randomIdSuffix;
  }

  // TODO: move into the negotiator class to handle signalling directly?
  handleAnswer(message) {
    if (this._pcAvailable) {
      this._negotiator.handleAnswer(message.answer);
      this.open = true;
    } else {
      this._queuedMessages.push(message);
    }
  }

  handleCandidate(message) {
    if (this._pcAvailable) {
      this._negotiator.handleCandidate(message.candidate);
    } else {
      this._queuedMessages.push(message);
    }
  }

  close() {
  }
}

module.exports = Connection;
