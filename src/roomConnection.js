'use strict';

const Connection = require('./connection');
const RoomNegotiator = require('./roomNegotiator');
const util = require('./util');

class RoomConnection extends Connection {
  constructor(remoteId, options) {
    super(remoteId, options);

    this._idPrefix = 'rc_';
    this.type = 'room';
    // We need to reassign _negotiator to be a RoomNegotiator
    this._negotiator = new RoomNegotiator(this);

    this.localStream = this.options._stream;
    this._pcAvailable = false;

    if (this.localStream) {
      this._negotiator.startConnection(
        {
          type:       'room',
          _stream:    this.localStream,
          originator: true
        },
        this.options.pcConfig
      );
      this._pcAvailable = true;
    }

    // There should be no 'answer' method or queued events for a RoomConnection
    // (Every user joins of their own accord)

    this._negotiator.on(Negotiator.EVENTS.addStream.key, remoteStream => {
      util.log('Receiving stream', remoteStream);

      this.remoteStream = remoteStream;
      this.emit('stream', remoteStream);
    });
  }
}

module.exports = RoomConnection;
