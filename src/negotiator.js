'use strict';

// const util = require('./util');

class Negotiator {
  constructor(socket, connection) {
    this._socket = socket;
    this._connection = connection;
    this._idPrefix = 'pc_';
  }

  startConnection(options) {
    // TODO: Remove lint bypass
    //console.log(options);
  }

  cleanup() {
  }

  handleSDP(type, sdp) {
    // TODO: Remove lint bypass
    //console.log(type, sdp);
  }

  handleCandidate(ice) {
    // TODO: Remove lint bypass
    //console.log(ice);
  }
}

module.exports = Negotiator;
