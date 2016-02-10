'use strict';

const util = require('./util');
const Negotiator = require('./negotiator');

class Connection {
  constructor(peerId, peerObj, options) {
    // Abstract class
    if (this.constructor === Connection) {
      throw new TypeError('Cannot construct Connection instances directly');
    }

    // TODO use util.extend (or Object.assign)
    this.options = options;

    this.open = false;
    this.type = undefined;
    this.peerId = peerId;
    this.peerObj = peerObj;
    this.metadata = this.options.metadata;

    this._negotiator = new Negotiator();

    this._idPrefix = 'c_';
  }

  get id() {
    return this.options.connectionId || this._idPrefix + util.randomToken();
  }

  // TODO: move into the negotiator class to handle signalling directly?
  handleMessage(message) {
    var payload = message.payload;

    switch (message.type) {
      case 'ANSWER':
        // Forward to negotiator
        this._negotiator.handleSDP(message.type, this, payload.sdp);
        break;
      case 'CANDIDATE':
        this._negotiator.handleCandidate(this, payload.candidate);
        break;
      default:
        util.warn('Unrecognized message type:',
          message.type, 'from peer:', this.peerId);
        break;
    }
  }

  close() {
  }
}

module.exports = Connection;
