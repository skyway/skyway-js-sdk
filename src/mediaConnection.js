'use strict';

const Connection = require('./connection');

class MediaConnection extends Connection {
  constructor(peer, options) {
    super(peer, options);

    this._idPrefix = 'mc_';
    this.type = 'media';
    this.localStream = this.options._stream;
    // Messages stored by peer because MC was not ready yet:
    this._queuedMessages = options._queuedMessages;

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
