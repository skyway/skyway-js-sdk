'use strict';

const Connection = require('./connection');
const util = require('./util');

class MediaConnection extends Connection {
  constructor(options) {
    super(options);

    this._idPrefix = 'mc_';
    this.type = 'media';
    this.localStream = this.options._stream;
    // Messages stored by peer because MC was not ready yet:
    this._queuedMessages = options._queuedMessages;

    if (this.localStream) {
      this._negotiator.startConnection(
        {
          type:       'media',
          _stream:    this.localStream,
          originator: true
        }
      );
    }
  }

  addStream(remoteStream) {
    util.log('Receiving stream', remoteStream);

    this.remoteStream = remoteStream;
    // Is 'stream' an appropriate emit message? PeerJS contemplated using 'open' instead
    this.emit('stream', remoteStream);
  }

  answer(stream) {
    // TODO: Remove lint bypass
    console.log(stream);
  }
}

module.exports = MediaConnection;
