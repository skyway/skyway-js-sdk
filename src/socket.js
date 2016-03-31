'use strict';

const io           = require('socket.io-client');
const util         = require('./util');

const EventEmitter = require('events');

class Socket extends EventEmitter {
  constructor(secure, host, port, key) {
    super();

    this._isOpen = false;
    this._isPeerIdSet = false;
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
      this._isPeerIdSet = true;
    } else {
      query = `apiKey=${this._key}&token=${token}`;
    }

    this._io = io(this._httpUrl, {
      'force new connection': true,
      'query':                query
    });

    this._setupMessageHandlers();
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

    if (this._io.connected === true) {
      this._io.emit(type, message);
    }
  }

  close() {
    if (!this.disconnected) {
      this._io.disconnect();
      this._isOpen = false;
    }
  }

  _setupMessageHandlers() {
    util.MESSAGE_TYPES.enums.forEach(type => {
      if (type.key === util.MESSAGE_TYPES.OPEN.key) {
        this._io.on(type.key, openMessage => {
          if (!openMessage || !openMessage.peerId) {
            return;
          }

          this._isOpen = true;
          if (!this._isPeerIdSet) {
            // set peerId for when reconnecting to the server
            this._io.io.opts.query += `&peerId=${openMessage.peerId}`;
            this._isPeerIdSet = true;
          }

          this._sendQueuedMessages();

          // To inform the peer that the socket successfully connected
          this.emit(type.key, openMessage);
        });
      } else {
        this._io.on(type.key, message => {
          console.log('Socket emitting: ' + type.key);
          this.emit(type.key, message);
        });
      }
    });
  }

  _sendQueuedMessages() {
    for (let data of this._queue) {
      this.send(data.type, data.message);
    }
    this._queue = [];
  }
}

module.exports = Socket;
