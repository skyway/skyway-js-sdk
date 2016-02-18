'use strict';

const Connection = require('./connection');
const util = require('./util');

const EventEmitter = require('events');

class MediaConnection extends Connection {
  constructor(peer, options) {
    super(peer, options);

    this._idPrefix = 'mc_';
    this.type = 'media';
    // This should only be set on the caller-side
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
    )

    // Retrieve lost messages stored because PeerConnection not set up.
    // var messages = this.provider._getMessages(this.id);
    // for (var i = 0, ii = messages.length; i < ii; i += 1) {
    //   this.handleMessage(messages[i]);
    // }
    this.open = true;

    console.log(stream);
  }
}

module.exports = MediaConnection;
