'use strict';

const assert      = require('assert');
const proxyquire  = require('proxyquire');
const mockSocket  = require('mock-socket');
const SocketIO    = mockSocket.SocketIO;
const Server      = mockSocket.Server;

const Socket = proxyquire('../src/socket', {'socket.io-client': SocketIO});

describe('Socket', () => {
  const serverPort = 5080;
  let server;

  beforeEach(() => {
    server = new Server('http://localhost:' + serverPort);
  });

  afterEach(() => {
    server.close();
  });

  describe('Connecting to the server', () => {
    it('should be able to connect to a server', done => {
      let apiKey = 'apiKey';
      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      server.on('connection', conn => {
        conn.emit('OPEN', 'foobar');
      });

      socket.start();
      socket.socket.on('connect', function() {
        socket.close();
        done();
      });
    });

    it('should be able to connect with a specific peerID', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      server.on('connection', conn => {
        // How to get peerId?
        conn.emit('OPEN', 'foobar');
        console.log(conn);
        //console.log(conn.handshake.query.peerId);
      });

      socket.start(peerId, token);
      socket.socket.on('connect', function() {
        assert.equal(socket.id, peerId);
        socket.close();
        done();
      });
    });

    it('should close socket and properly set disconnect status', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      server.on('connection', conn => {
        conn.emit('OPEN', 'foobar');
      });

      socket.start(peerId, token);
      socket.socket.on('connect', function() {
        socket.close();
        assert.equal(socket.socket.readyState, 3);
        assert.equal(socket.disconnected, true);
        done();
      });
    });

    it('should be able to send some data', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      let data = {value: 'hello world', type: 'string'};
      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      server.on('connection', conn => {
        conn.emit('OPEN', 'foobar');
      });
      server.on('msg', msg => {
        console.log('MSG: ' + msg);
        assert.equal(msg, JSON.stringify(data));
      });

      socket.start(peerId, token);
      socket.socket.on('connect', function() {
        socket.send(data);
        socket.close();
        done();
      });
    });

    it('should send queued messages upon connecting', done => {
      let apiKey = 'apiKey';
      let peerId;
      let token = 'token';
      let data1 = {value: 'hello world', type: 'string'};
      let data2 = {value: 'goodbye world', type: 'string'};
      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      server.on('connection', conn => {
        conn.emit('OPEN', undefined);
      });

      server.on('msg', msg => {
        console.log('MSG: ' + msg);
        this.tmp = JSON.parse(msg);
      });

      socket.start(peerId, token);
      socket.socket.on('connect', function() {
        socket.send(data1);
        assert.equal(socket._queue, [data1]);
        assert.equal(server.receivedData, undefined);
        socket.id = 'peerId';
        //assert.equal(server.receivedData, JSON.stringify(msg));
        socket.close();
        done();
      });

    });
  });
});
