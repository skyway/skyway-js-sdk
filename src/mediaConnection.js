'use strict';

const Connection = require('./connection');

class MediaConnection extends Connection {
  constructor(peer, socket, pcConfig, options) {
    super(peer, socket, pcConfig, options);

    this.type = 'media';
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
