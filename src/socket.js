'use strict';

const io = require('socket.io-client');

class Socket {
  constructor(secure, host, port, key) {
    this.secure = secure;
    this.host   = host;
    this.port   = port;
    this.key    = key;

    this.scheme = secure ? 'https' : 'http';
  }

  connect() {
    this.socket = io(this.scheme + '://' + this.host + ':' + this.port);
  }
}

module.exports = Socket;
