'use strict';

const Connection = require('./connection');
const util = require('./util');

class MediaConnection extends Connection {
  constructor(remoteId, options) {
    super(remoteId, options);

    this._idPrefix = 'mc_';
    this.type = 'media';
    // This should only be set on the caller-side
    this.localStream = this.options._stream;

    // Messages stored by peer because MC was not ready yet
    this._queuedMessages = this.options._queuedMessages || [];
    this._pcAvailable = false;

    if (this.localStream) {
      this._negotiator.startConnection(
        {
          type:       'media',
          _stream:    this.localStream,
          originator: true
        }
      );
      this._pcAvailable = true;
    }
  }

  addStream(remoteStream) {
    util.log('Receiving stream', remoteStream);

    this.remoteStream = remoteStream;
    // Is 'stream' an appropriate emit message? PeerJS contemplated using 'open' instead
    this.emit('stream', remoteStream);
  }

  // This is only called by the callee
  answer(stream) {
    if (this.localStream) {
      util.warn('localStream already exists on this MediaConnection. Are you answering a call twice?');
      return;
    }

    this.options._payload._stream = stream;

    this.localStream = stream;
    this._negotiator.startConnection(
      this,
      this.options._payload
    );
    this._pcAvailable = true;

    this._handleQueuedMessages();

    this.open = true;
  }
}

module.exports = MediaConnection;
