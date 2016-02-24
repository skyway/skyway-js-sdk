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
    console.log(options);
  }

  cleanup() {
  }

  handleAnswer(message) {
    // TODO: Remove lint bypass
    console.log(message);
  }

  handleCandidate(message) {
    // TODO: Remove lint bypass
    console.log(message);
  }
}

module.exports = Negotiator;
