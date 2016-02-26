'use strict';

const Connection = require('./connection');

class DataConnection extends Connection {
  constructor(options) {
    super(options);

    this._idPrefix = 'dc_';
    this.type = 'data';
    this.label = this.options.label || this.id;
    this.serialization = this.options.serialization;

    // Data channel buffering.
    this._buffer = [];
    this._buffering = false;
    this.bufferSize = 0;

    // For storing large data.
    this._chunkedData = {};

    if (this.options._payload) {
      this._peerBrowser = this.options._payload.browser;
    }

    this._negotiator.startConnection(
      this,
      this.options._payload || {
        originator: true
      }
    );
  }

  initialize(dc) {
    // TODO: Remove lint bypass
    console.log(dc);
  }

  send(data, chunked) {
    // TODO: Remove lint bypass
    console.log(data, chunked);
  }
}

module.exports = DataConnection;
