'use strict';

const Connection = require('./connection');
const util = require('./util');

const EventEmitter = require('events');

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
    console.log(remoteStream);
    util.log('Receiving stream', remoteStream);

    this.remoteStream = remoteStream;

    // I couldn't get this emitter to work (possibly due to scoping issues)
    // But also I'm uncertain where this should be emitted to:

    // this.emit('stream', remoteStream);
    // this._negotiator.emit('stream', remoteStream);
  }

  answer(stream) {
    // TODO: Remove lint bypass
    console.log(stream);
  }
}

module.exports = MediaConnection;
