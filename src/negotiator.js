'use strict';

// const util = require('./util');

class Negotiator {
  constructor() {
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
