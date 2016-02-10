'use strict';

const io    = require('socket.io-client');
// const util  = require('./util');

class Socket {
  constructor(secure, host, port, key) {
    this.disconnected = true;
    this._queue = [];

    this.socket = null;

    this._key   = key;

    let httpProtocol = secure ? 'https://' : 'http://';
    this._httpUrl = `${httpProtocol}${host}:${port}`;
  }

  start(id, token) {
    // Presumably need a check for whether a peerId is actually specified or not?
    this.id = id;
    this.socket = io(this._httpUrl, {
      'force new connection': true,
      'query':                `apiKey=${this._key}&token=${token}&peerId=${this.id}`
    });

    this.socket.on('OPEN', peerId => {
      this.disconnected = false;

      if (peerId !== undefined) {
        this.id = peerId;
      }

      // This may be redundant, but is here to match peerjs:
      this._sendQueuedMessages();
    });
  }

  send(data) {
    if (this.disconnected) {
      return;
    }

    // If we have no ID yet, queue the message
    if (!this.id) {
      this._queue.push(data);
      return;
    }

    if (!data.type) {
      this.socket.emit('ERR', 'Invalid message');
      return;
    }

    var message = JSON.stringify(data);
    if (this.socket.connected === true) {
      this.socket.emit('MSG', message);
    }
  }

  close() {
    // if (!this.disconnected && (this.socket.readyState === 1)) {
    if (!this.disconnected) {
      this.socket.disconnect();
      this.disconnected = true;
    }
  }

  _sendQueuedMessages() {
    for (var i = 0; i < this._queue.length; i++) {
      // Remove each item from queue in turn and send
      this.send(this._queue.shift());
    }
  }
}

module.exports = Socket;
