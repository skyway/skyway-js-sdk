'use strict';

const Connection = require('./connection');
const util = require('./util');

class MediaConnection extends Connection {
  constructor(peer, options) {
    super(peer, options);

    this._idPrefix = 'mc_';
    this.type = 'media';
    // This should only be set on the caller-side
    this.localStream = this.options._stream;

    // Messages stored by peer because MC was not ready yet
    this._queuedMessages = this.options._queuedMessages || [];
    this._pcAvailable = false;

    if (this.localStream) {
      this._negotiator.startConnection(
        this,
        {_stream: this.localStream, originator: true}
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

    // Process messages queued because PeerConnection not set up.
    for (let i = 0; i < this._queuedMessages.length; i++) {
      let message = this._queuedMessages.shift();

      switch (message.type) {
        case util.MESSAGE_TYPES.ANSWER.name:
          this.handleAnswer(message.payload);
          break;
        case util.MESSAGE_TYPES.CANDIDATE.name:
          this.handleCandidate(message.payload);
          break;
        default:
          util.warn('Unrecognized message type:', message.type, 'from peer:', this.peer);
          break;
      }
    }

    this.open = true;
  }
}

module.exports = MediaConnection;
