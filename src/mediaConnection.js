'use strict';

const Connection = require('./connection');

class MediaConnection extends Connection {
  constructor(peerId, peerObj, options) {
    super(peerId, peerObj, options);

    this._idPrefix = 'mc_';
    this.type = 'media';
    this.localStream = this.options._stream;

    if (this.localStream) {
      this._negotiator.startConnection(
        this,
        {_stream: this.localStream, originator: true}
      );
    }
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
