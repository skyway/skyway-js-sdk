'use strict';

// const util = require('./util');

const EventEmitter = require('events');

class Negotiator extends EventEmitter {
  constructor() {
    super();
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
