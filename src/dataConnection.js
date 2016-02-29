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

  /** Called by the Negotiator when the DataChannel is ready. */
  initialize(dc) {
    this._dc = dc;
    this._configureDataChannel();
  }

  _configureDataChannel() {
    if (util.supports.sctp) {
      this._dc.binaryType = 'arraybuffer';
    }

    this._dc.on('OPEN', () => {
      util.log('Data channel connection success');
      self.open = true;
      self.emit('open');
    });
  
    // We no longer need the reliable shim here
    this._dc.on('MSG', msg => {
      self._handleDataMessage(msg);
    });

    this._dc.on('CLOSE', () => {
      util.log('DataChannel closed for:', self.peer);
      self.close();
    });
  }

  send(data, chunked) {
    // TODO: Remove lint bypass
    console.log(data, chunked);
  }
}

module.exports = DataConnection;
