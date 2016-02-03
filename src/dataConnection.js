'use strict';

const Connection = require('./connection');

class DataConnection extends Connection {
  constructor(peer, socket, pcConfig, options) {
    super(peer, socket, pcConfig, options);

    this.type = 'data';
    this._idPrefix = 'dc_';
    this.type = 'data';
    this.label = this.options.label || this.id;
    this.serialization = this.options.serialization;
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
