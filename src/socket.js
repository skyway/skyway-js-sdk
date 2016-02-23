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
    return !(this._io.connected && this._isOpen);
  }

  start(id, token) {
    this._io = io(this._httpUrl, {
      'force new connection': true,
      'query':                `apiKey=${this._key}&token=${token}&peerId=${id}`
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

  send(data) {
    if (!data.type) {
      this._io.emit('ERR', 'Invalid message');
      return;
    }

    // If we are not connected yet, queue the message
    if (this.disconnected) {
      this._queue.push(data);
      return;
    }

    var message = JSON.stringify(data);
    if (this._io.connected === true) {
      this._io.emit('MSG', message);
    }
  }

  close() {
    if (!this.disconnected) {
      this._io.disconnect();
      this._isOpen = false;
    }
  }

  _sendQueuedMessages() {
    for (let message of this._queue) {
      this.send(message);
    }
    this._queue = [];
  }
}

module.exports = Socket;
