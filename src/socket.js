'use strict';

const io    = require('socket.io-client');
// const util  = require('./util');

class Socket {
  constructor(secure, host, port, key) {
    this.disconnected = false;

    this._key    = key;

    let httpProtocol = secure ? 'https://' : 'http://';
    this._httpUrl = `${httpProtocol}${host}:${port}`;
  }

  start(id, token) {
    this.id = id;

    this.socket = io(this._httpUrli, {
      'force new connection': true,
      'query': `apiKey=${this._key}&token=${token}&peerId=${this.id}`,
      'extraHeaders': {Origin: `http://${dbHelper.activeDomain}`}
    });
  }

  send(data) {
    // TODO: Remove lint bypass
    console.log(data);
  }

  close() {
  }
}

module.exports = Socket;
