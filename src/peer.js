'use strict';

// const DataConnection  = require('./dataConnection');
// const MediaConnection = require('./mediaConnection');
// const Socket          = require('./socket');
// const util            = require('./util');

class Peer {
  constructor(id, options) {
    this.destroyed = false;
    this.disconnected = false;
    this.open = false;
    this.connections = {};

    this.test = 'lalala';

    if (id && id.constructor === Object) {
      options = id;
      id = undefined;
    } else if (id) {
      id = id.toString();
    }
    // TODO: Remove lint bypass
    console.log(options);
  }

  connect(peer, options) {
    // TODO: Remove lint bypass
    console.log(peer, options);
  }

  call(peer, stream, options) {
    // TODO: Remove lint bypass
    console.log(peer, stream, options);
  }

  getConnection(peer, id) {
    // TODO: Remove lint bypass
    console.log(peer, id);
  }

  emitError(type, err) {
    // TODO: Remove lint bypass
    console.log(type, err);
  }

  destroy() {
  }

  disconnect() {
  }

  reconnect() {
  }

  listAllPeers(cb) {
    // TODO: Remove lint bypass
    console.log(cb);
  }
}

module.exports = Peer;
