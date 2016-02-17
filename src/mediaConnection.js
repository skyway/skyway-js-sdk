'use strict';

const Connection = require('./connection');
const util = require('./util');

class MediaConnection extends Connection {
  constructor(peer, options) {
    super(peer, options);

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
    util.setLogLevel(3);
    util.log('Receiving stream', remoteStream);

    this.remoteStream = remoteStream;
//    this.emit('stream', remoteStream);
  }

  answer(stream) {
    // TODO: Remove lint bypass
    console.log(stream);
  }
}

module.exports = MediaConnection;
