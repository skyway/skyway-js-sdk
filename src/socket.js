'use strict';

const io           = require('socket.io-client');

const EventEmitter = require('events');

class Socket extends EventEmitter {
  constructor(secure, host, port, key) {
    super();

    this._isOpen = false;
    this._queue = [];

    this._io  = null;
    this._key = key;

    let httpProtocol = secure ? 'https://' : 'http://';
    this._httpUrl = `${httpProtocol}${host}:${port}`;
  }

  get disconnected() {
    return !((this._io && this._io.connected) && this._isOpen);
  }

  start(id, token) {
    let query;
    if (id) {
      query = `apiKey=${this._key}&token=${token}&peerId=${id}`;
    } else {
      query = `apiKey=${this._key}&token=${token}`;
    }

    this._io = io(this._httpUrl, {
      'force new connection': true,
      'query':                query
    });

    this._io.on('OPEN', peerId => {
      if (peerId) {
        this._isOpen = true;
      }

      // This may be redundant, but is here to match peerjs:
      this._sendQueuedMessages();

      // To inform the peer that the socket successfully connected
      this.emit('OPEN', peerId);
    });
  }

  send(type, message) {
    if (!type) {
      this._io.emit('error', 'Invalid message');
      return;
    }

    // If we are not connected yet, queue the message
    if (this.disconnected) {
      this._queue.push({type: type, message: message});
      return;
    }

    let messageString = JSON.stringify(message);
    if (this._io.connected === true) {
      this._io.emit(type, messageString);
    }
  }

  close() {
    if (!this.disconnected) {
      this._io.disconnect();
      this._isOpen = false;
    }
  }

  _sendQueuedMessages() {
    for (let data of this._queue) {
      this.send(data.type, data.message);
    }
    this._queue = [];
  }
}

module.exports = Socket;
