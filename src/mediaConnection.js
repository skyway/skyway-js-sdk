'use strict';

const Connection = require('./connection');

class MediaConnection extends Connection {
  constructor(peer, provider, options) {
    super(peer, provider, options);

    this._idPrefix = 'mc_';
    this.type = 'media';
    this.localStream = this.options._stream;
  }

  addStream(remoteStream) {
    // TODO: Remove lint bypass
    console.log(remoteStream);
  }

  answer(stream) {
    // TODO: Remove lint bypass
    console.log(stream);
  }
}

module.exports = MediaConnection;
